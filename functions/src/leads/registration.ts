import { randomUUID } from 'node:crypto';
import type { Lead, RegistrationSource, Session } from '@zwam/types';
import { checkCircuitBreaker } from '../lib/circuit-breaker.js';
import { getFirestoreAdmin } from '../lib/firebase-admin.js';
import { isValidUuidV4 } from '../acquisition/validation.js';

export interface RegisterLeadParams {
  clientId: string;
  landingId: string;
  sessionId: string;
  anonymousId: string;
  registrationSource: RegistrationSource;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
}

export interface RegisterLeadResult {
  lead: Lead;
  isNew: boolean;
}

export async function registerLeadLogic(
  params: RegisterLeadParams,
): Promise<RegisterLeadResult> {
  const {
    clientId,
    landingId,
    sessionId,
    anonymousId,
    registrationSource,
    name,
    email,
    phone,
    company,
    city,
  } = params;

  // 1. Input validations
  if (!isValidUuidV4(anonymousId)) {
    throw new Error('BadRequest: Invalid anonymous_id UUID v4 format.');
  }

  if (!name || name.trim().length === 0) {
    throw new Error('BadRequest: Lead registration requires a valid name.');
  }

  const normEmail = email ? email.toLowerCase().trim() : undefined;
  const normPhone = phone ? phone.replace(/[^\d+]/g, '') : undefined;
  const normName = name.trim();
  const normCompany = company ? company.trim() : undefined;
  const normCity = city ? city.trim() : undefined;

  if (!normEmail && !normPhone) {
    throw new Error(
      'BadRequest: Lead registration requires at least an email or phone number.',
    );
  }

  // 2. Circuit Breaker
  await checkCircuitBreaker(clientId, landingId);

  // 3. Verify Session exists and matches client_id & landing_id
  const db = getFirestoreAdmin();
  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  if (!sessionSnap.exists) {
    throw new Error(`NotFound: Session '${sessionId}' does not exist.`);
  }

  const session = sessionSnap.data() as Session;
  if (session.client_id !== clientId || session.landing_id !== landingId) {
    throw new Error(
      `Forbidden: Registration client_id '${clientId}' or landing_id '${landingId}' does not match session client_id '${session.client_id}' / landing_id '${session.landing_id}'.`,
    );
  }

  if (session.anonymous_id !== anonymousId) {
    throw new Error(
      `Forbidden: Registration anonymous_id '${anonymousId}' does not match session anonymous_id '${session.anonymous_id}'.`,
    );
  }

  // 4. Deduplication Logic:
  // Rules: (phone + email) OR (phone + name) OR (email)
  let matchedLead: Lead | null = null;

  // Match 1: Search by email if email is present
  if (normEmail) {
    const emailSnap = await db
      .collection('leads')
      .where('client_id', '==', clientId)
      .where('email', '==', normEmail)
      .get();

    if (!emailSnap.empty) {
      matchedLead = emailSnap.docs[0].data() as Lead;
    }
  }

  // Match 2: Search by phone if no email match was found and phone is present
  if (!matchedLead && normPhone) {
    const phoneSnap = await db
      .collection('leads')
      .where('client_id', '==', clientId)
      .where('phone', '==', normPhone)
      .get();

    for (const doc of phoneSnap.docs) {
      const candidate = doc.data() as Lead;
      const candidateName = candidate.name.toLowerCase().trim();
      const candidateEmail = candidate.email
        ? candidate.email.toLowerCase().trim()
        : undefined;

      const sameEmail = Boolean(
        normEmail && candidateEmail && candidateEmail === normEmail,
      );
      const sameName = Boolean(candidateName === normName.toLowerCase());

      if (sameEmail || sameName) {
        matchedLead = candidate;
        break;
      }
    }
  }

  const nowIso = new Date().toISOString();

  // 5. Update existing Lead or Create New Lead
  if (matchedLead) {
    const finalEmail = normEmail || matchedLead.email;
    const finalPhone = normPhone || matchedLead.phone;
    const finalCompany = normCompany || matchedLead.company;
    const finalCity = normCity || matchedLead.city;

    const updatedLead: Lead = {
      ...matchedLead,
      name: normName,
      ...(finalEmail ? { email: finalEmail } : {}),
      ...(finalPhone ? { phone: finalPhone } : {}),
      ...(finalCompany ? { company: finalCompany } : {}),
      ...(finalCity ? { city: finalCity } : {}),
      registration_session_id: sessionId,
      registration_source: registrationSource,
      updated_at: nowIso,
    };

    await db.collection('leads').doc(matchedLead.lead_id).set(updatedLead);

    return {
      lead: updatedLead,
      isNew: false,
    };
  }

  const leadId = randomUUID();
  const newLead: Lead = {
    lead_id: leadId,
    client_id: clientId,
    anonymous_id: anonymousId,
    name: normName,
    ...(normEmail ? { email: normEmail } : {}),
    ...(normPhone ? { phone: normPhone } : {}),
    ...(normCompany ? { company: normCompany } : {}),
    ...(normCity ? { city: normCity } : {}),
    registration_session_id: sessionId,
    registration_source: registrationSource,
    created_at: nowIso,
    updated_at: nowIso,
    status: 'new',
  };

  await db.collection('leads').doc(leadId).set(newLead);

  return {
    lead: newLead,
    isNew: true,
  };
}
