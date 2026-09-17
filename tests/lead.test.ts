import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  type Client,
  type Landing,
  createOrReuseSessionLogic,
  getFirestoreAdmin,
  registerLeadLogic,
} from '../functions/src/index.js';

describe('Module 4 — Lead & Registration Engine (Local / Emulator Mode)', () => {
  const db = getFirestoreAdmin();

  const clientActive: Client = {
    client_id: 'lead_client_01',
    company_name: 'Lead Client Active',
    business_sector: 'SaaS',
    legal_name: 'Lead Active Inc',
    contact_email: 'lead@client.com',
    contact_phone: '+123456789',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const landingActive: Landing = {
    landing_id: 'lead_landing_01',
    client_id: 'lead_client_01',
    name: 'Landing Lead Test',
    slug: 'lead-test',
    status: 'published',
    monthly_fee: 100,
    published_version_id: 'v1.0.0',
    operational_status: 'active',
    billing_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    await db
      .collection('clients')
      .doc(clientActive.client_id)
      .set(clientActive);
    await db
      .collection('landings')
      .doc(landingActive.landing_id)
      .set(landingActive);

    // Clean leads collection to ensure test isolation
    const leadsSnap = await db
      .collection('leads')
      .where('client_id', '==', clientActive.client_id)
      .get();
    for (const doc of leadsSnap.docs) {
      await doc.ref.delete();
    }
  });

  // =========================================================================
  // 1. LEAD CREATION & HISTORICAL LINKAGE
  // =========================================================================
  describe('Lead Creation & Historical Linkage', () => {
    it('creates a Lead upon valid form registration and links to anonymous_id', async () => {
      const anonymousId = randomUUID();

      // Create Session 1
      const sess1 = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: { utm_source: 'google', utm_medium: 'cpc' },
      });

      // Submit Form Registration on Session 1
      const res = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess1.session.session_id,
        anonymousId,
        registrationSource: 'form',
        name: 'Carlos Perez',
        email: 'carlos@example.com',
        phone: '+5491112345678',
        city: 'Buenos Aires',
      });

      expect(res.isNew).toBe(true);
      expect(res.lead.lead_id).toBeDefined();
      expect(res.lead.client_id).toBe(clientActive.client_id);
      expect(res.lead.anonymous_id).toBe(anonymousId);
      expect(res.lead.registration_session_id).toBe(sess1.session.session_id);
      expect(res.lead.registration_source).toBe('form');
      expect(res.lead.status).toBe('new');

      // Verify lead document persisted in Firestore
      const leadSnap = await db.collection('leads').doc(res.lead.lead_id).get();
      expect(leadSnap.exists).toBe(true);
      expect(leadSnap.data()?.email).toBe('carlos@example.com');
    });

    it('links Lead with historical sessions without altering historical session documents', async () => {
      const anonymousId = randomUUID();

      // Session 1
      const sess1 = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: { utm_source: 'meta' },
      });

      // Session 2 (simulate 4 minutes later)
      const fourMinutesAgo = new Date(Date.now() - 240000).toISOString();
      await db
        .collection('sessions')
        .doc(sess1.session.session_id)
        .update({ last_activity_at: fourMinutesAgo });
      await db
        .collection('active_sessions')
        .doc(
          `${clientActive.client_id}_${landingActive.landing_id}_${anonymousId}`,
        )
        .update({ last_activity_at: fourMinutesAgo });

      const sess2 = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: { utm_source: 'google' },
      });

      // Registration occurs on Session 2
      const res = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess2.session.session_id,
        anonymousId,
        registrationSource: 'form',
        name: 'Maria Gomez',
        email: 'maria@example.com',
      });

      expect(res.lead.anonymous_id).toBe(anonymousId);

      // Verify Session 1 & Session 2 historical documents remain intact in Firestore
      const sess1Snap = await db
        .collection('sessions')
        .doc(sess1.session.session_id)
        .get();
      const sess2Snap = await db
        .collection('sessions')
        .doc(sess2.session.session_id)
        .get();

      expect(sess1Snap.exists).toBe(true);
      expect(sess2Snap.exists).toBe(true);
      expect((sess1Snap.data() as any).sessions).toBeUndefined(); // NO sessions[] array stored inside Lead or Session
    });
  });

  // =========================================================================
  // 2. DEDUPLICATION RULES
  // =========================================================================
  describe('Lead Deduplication Rules', () => {
    it('deduplicates Lead by same email and updates existing Lead', async () => {
      const anonymousId = randomUUID();
      const sess = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      // First Registration
      const res1 = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess.session.session_id,
        anonymousId,
        registrationSource: 'form',
        name: 'Juan Perez',
        email: 'juan@example.com',
      });
      expect(res1.isNew).toBe(true);

      // Second Registration with same email, updated phone and city
      const res2 = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess.session.session_id,
        anonymousId,
        registrationSource: 'form',
        name: 'Juan Perez Updated',
        email: 'JUAN@example.com', // Case insensitive check
        phone: '+5491199998888',
        city: 'Cordoba',
      });

      expect(res2.isNew).toBe(false);
      expect(res2.lead.lead_id).toBe(res1.lead.lead_id);
      expect(res2.lead.name).toBe('Juan Perez Updated');
      expect(res2.lead.phone).toBe('+5491199998888');
      expect(res2.lead.city).toBe('Cordoba');
    });

    it('deduplicates Lead by same phone + same name when email is absent', async () => {
      const anonymousId = randomUUID();
      const sess = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      // Initial registration by phone + name
      const res1 = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess.session.session_id,
        anonymousId,
        registrationSource: 'whatsapp_preform',
        name: 'Lucas Rossi',
        phone: '+5491155554444',
      });
      expect(res1.isNew).toBe(true);

      // Subsequent registration with same phone + same name
      const res2 = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess.session.session_id,
        anonymousId,
        registrationSource: 'form',
        name: 'Lucas Rossi',
        phone: '+5491155554444',
        email: 'lucas@example.com',
      });

      expect(res2.isNew).toBe(false);
      expect(res2.lead.lead_id).toBe(res1.lead.lead_id);
      expect(res2.lead.email).toBe('lucas@example.com');
    });

    it('creates NEW Lead if only phone matches but name and email differ', async () => {
      const anonymousId = randomUUID();
      const sess = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      // Lead 1: Phone + Name A
      const res1 = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess.session.session_id,
        anonymousId,
        registrationSource: 'whatsapp_preform',
        name: 'Persona A',
        phone: '+5491100001111',
      });

      // Registration with same phone but DIFFERENT name & DIFFERENT email
      const res2 = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess.session.session_id,
        anonymousId,
        registrationSource: 'whatsapp_preform',
        name: 'Persona B',
        phone: '+5491100001111',
      });

      // Solo celular does NOT deduplicate if name/email differ
      expect(res2.isNew).toBe(true);
      expect(res2.lead.lead_id).not.toBe(res1.lead.lead_id);
    });
  });

  // =========================================================================
  // 3. WHATSAPP PREFORM FLOW
  // =========================================================================
  describe('WhatsApp Preform Flow', () => {
    it('creates Lead with whatsapp_preform registration source', async () => {
      const anonymousId = randomUUID();
      const sess = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      const res = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess.session.session_id,
        anonymousId,
        registrationSource: 'whatsapp_preform',
        name: 'Esteban Quito',
        phone: '+5491177776666',
        city: 'Mendoza',
      });

      expect(res.lead.registration_source).toBe('whatsapp_preform');
      expect(res.lead.name).toBe('Esteban Quito');
      expect(res.lead.phone).toBe('+5491177776666');
    });

    it('rejects registration without email or phone', async () => {
      const anonymousId = randomUUID();
      const sess = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      await expect(
        registerLeadLogic({
          clientId: clientActive.client_id,
          landingId: landingActive.landing_id,
          sessionId: sess.session.session_id,
          anonymousId,
          registrationSource: 'whatsapp_preform',
          name: 'Usuario Sin Contacto',
        }),
      ).rejects.toThrow(
        /BadRequest: Lead registration requires at least an email or phone/,
      );
    });
  });

  // =========================================================================
  // 4. ISOLATION & VALIDATIONS
  // =========================================================================
  describe('Isolation & Security', () => {
    it('rejects Lead registration if session client_id or landing_id mismatches', async () => {
      const anonymousId = randomUUID();
      const sess = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      await expect(
        registerLeadLogic({
          clientId: 'other_client',
          landingId: landingActive.landing_id,
          sessionId: sess.session.session_id,
          anonymousId,
          registrationSource: 'form',
          name: 'Hacker',
          email: 'hacker@example.com',
        }),
      ).rejects.toThrow(
        /NotFound: Client .*|Forbidden: Registration client_id .* or landing_id .* does not match/,
      );
    });

    it('rejects Lead registration if anonymous_id does not match session anonymous_id', async () => {
      const sessionAnonymousId = randomUUID();
      const sess = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId: sessionAnonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      const mismatchedAnonymousId = randomUUID();
      await expect(
        registerLeadLogic({
          clientId: clientActive.client_id,
          landingId: landingActive.landing_id,
          sessionId: sess.session.session_id,
          anonymousId: mismatchedAnonymousId,
          registrationSource: 'form',
          name: 'Mismatched User',
          email: 'mismatch@example.com',
        }),
      ).rejects.toThrow(
        /Forbidden: Registration anonymous_id .* does not match session anonymous_id/,
      );
    });
  });

  // =========================================================================
  // 5. EMAIL-ONLY DEDUPLICATION & PII REMOVAL VERIFICATION
  // =========================================================================
  describe('Post-Review Deduplication & PII Verification', () => {
    it('deduplicates Lead by email alone even if name is updated and phone is omitted', async () => {
      const anonymousId = randomUUID();
      const sess = await createOrReuseSessionLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        anonymousId,
        deviceInfo: { device_type: 'desktop' },
        trackingContext: {},
      });

      // Lead 1: Email + Name + Phone
      const res1 = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess.session.session_id,
        anonymousId,
        registrationSource: 'form',
        name: 'Original Name',
        email: 'sole_email@example.com',
        phone: '+5491188887777',
      });
      expect(res1.isNew).toBe(true);

      // Lead 2: Same Email, Different Name, NO Phone
      const res2 = await registerLeadLogic({
        clientId: clientActive.client_id,
        landingId: landingActive.landing_id,
        sessionId: sess.session.session_id,
        anonymousId,
        registrationSource: 'form',
        name: 'Updated Name',
        email: 'sole_email@example.com',
      });

      expect(res2.isNew).toBe(false);
      expect(res2.lead.lead_id).toBe(res1.lead.lead_id);
      expect(res2.lead.created_at).toBe(res1.lead.created_at);
      expect(res2.lead.name).toBe('Updated Name');
      expect(res2.lead.phone).toBe('+5491188887777'); // Phone preserved
    });
  });
});
