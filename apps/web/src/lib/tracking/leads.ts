import type { Event, Lead } from '@zwam/types';
import { getOrCreateAnonymousId } from './anonymous-id.js';
import { AcquisitionApiClient } from './client.js';
import { emitTrackingEvent } from './events.js';
import { ensureActiveSession } from './session.js';

export interface FormRegistrationParams {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
}

export interface WhatsAppPreformParams {
  name: string;
  city?: string;
  phone?: string; // Optional if phone can be extracted from session
}

/**
 * Tracks user click on WhatsApp CTA button.
 * Emits whatsapp_click behavioral event without creating a Lead and without PII in metadata.
 */
export async function trackWhatsAppClick(
  clientId: string,
  landingId: string,
  apiClient?: AcquisitionApiClient,
): Promise<Event> {
  const client = apiClient || new AcquisitionApiClient();
  await ensureActiveSession(clientId, landingId, client);

  // Ingest whatsapp_click event without PII in metadata
  return emitTrackingEvent(clientId, landingId, 'whatsapp_click', {}, client);
}

/**
 * Submits web form registration, emits form_submit event (without PII in metadata), and registers Lead.
 */
export async function submitFormRegistration(
  clientId: string,
  landingId: string,
  params: FormRegistrationParams,
  apiClient?: AcquisitionApiClient,
): Promise<Lead> {
  const client = apiClient || new AcquisitionApiClient();
  const session = await ensureActiveSession(clientId, landingId, client);
  const anonymousId = getOrCreateAnonymousId();

  // Ingest form_submit custom behavioral event WITHOUT PII in metadata
  await emitTrackingEvent(
    clientId,
    landingId,
    'custom',
    { event_name: 'form_submit' },
    client,
  );

  const res = await client.registerLead({
    clientId,
    landingId,
    sessionId: session.session_id,
    anonymousId,
    registrationSource: 'form',
    ...params,
  });

  return res.lead;
}

/**
 * Submits WhatsApp preform identification to register Lead.
 * Does NOT generate whatsapp_click event.
 */
export async function submitWhatsAppPreform(
  clientId: string,
  landingId: string,
  params: WhatsAppPreformParams,
  apiClient?: AcquisitionApiClient,
): Promise<Lead> {
  const client = apiClient || new AcquisitionApiClient();
  const session = await ensureActiveSession(clientId, landingId, client);
  const anonymousId = getOrCreateAnonymousId();

  const res = await client.registerLead({
    clientId,
    landingId,
    sessionId: session.session_id,
    anonymousId,
    registrationSource: 'whatsapp_preform',
    ...params,
  });

  return res.lead;
}
