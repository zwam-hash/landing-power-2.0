import type { Event, EventType } from '@zwam/types';
import { AcquisitionApiClient } from './client.js';
import { clearActiveSession, ensureActiveSession } from './session.js';

function generateEventUuidV4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error(
    'Crypto API is unavailable in this environment to generate a valid UUID v4.',
  );
}

export async function emitTrackingEvent(
  clientId: string,
  landingId: string,
  eventType: EventType,
  metadata?: Record<string, unknown>,
  apiClient?: AcquisitionApiClient,
): Promise<Event> {
  const client = apiClient || new AcquisitionApiClient();
  let session = await ensureActiveSession(clientId, landingId, client);
  const eventId = generateEventUuidV4();
  const occurredAt = new Date().toISOString();
  const page = typeof window !== 'undefined' ? window.location.pathname : '/';

  try {
    const res = await client.ingestEvent({
      eventId,
      clientId,
      landingId,
      sessionId: session.session_id,
      eventType,
      occurredAt,
      page,
      metadata,
    });
    session.last_activity_at = res.event.received_at;
    return res.event;
  } catch (err: any) {
    // If backend returns session expired error, clear active session, obtain a new session and retry once
    if (err?.message && /expired/i.test(err.message)) {
      clearActiveSession();
      session = await ensureActiveSession(clientId, landingId, client);
      const res = await client.ingestEvent({
        eventId,
        clientId,
        landingId,
        sessionId: session.session_id,
        eventType,
        occurredAt,
        page,
        metadata,
      });
      session.last_activity_at = res.event.received_at;
      return res.event;
    }
    throw err;
  }
}
