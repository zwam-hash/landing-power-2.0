import type { Event, EventType, Session } from '@zwam/types';
import { checkCircuitBreaker } from '../lib/circuit-breaker.js';
import { getFirestoreAdmin } from '../lib/firebase-admin.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import {
  isValidEventType,
  isValidUuidV4,
  validateEventMetadata,
} from './validation.js';

export interface IngestEventParams {
  eventId: string;
  clientId: string;
  landingId: string;
  sessionId: string;
  eventType: EventType;
  occurredAt: string;
  page?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestEventResult {
  event: Event;
  isDuplicate: boolean;
}

const INACTIVITY_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

export async function ingestEventLogic(
  params: IngestEventParams,
): Promise<IngestEventResult> {
  const {
    eventId,
    clientId,
    landingId,
    sessionId,
    eventType,
    occurredAt,
    page,
    metadata,
  } = params;

  // 1. Input format validations
  if (!isValidUuidV4(eventId)) {
    throw new Error('BadRequest: Invalid event_id UUID v4 format.');
  }

  if (!isValidEventType(eventType)) {
    throw new Error(
      `BadRequest: Invalid event_type '${eventType}'. Must be one of the 8 allowed types.`,
    );
  }

  // 2. Circuit Breaker
  await checkCircuitBreaker(clientId, landingId);

  // 3. Fetch Session & Validate ownership & expiration
  const db = getFirestoreAdmin();
  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  if (!sessionSnap.exists) {
    throw new Error(`NotFound: Session '${sessionId}' does not exist.`);
  }

  const session = sessionSnap.data() as Session;
  if (session.client_id !== clientId || session.landing_id !== landingId) {
    throw new Error(
      `Forbidden: Event client_id '${clientId}' or landing_id '${landingId}' does not match session client_id '${session.client_id}' / landing_id '${session.landing_id}'.`,
    );
  }

  const now = new Date();
  const lastActivityMs = new Date(session.last_activity_at).getTime();
  if (now.getTime() - lastActivityMs >= INACTIVITY_THRESHOLD_MS) {
    throw new Error(
      `Forbidden: Session '${sessionId}' has expired due to inactivity (>3m).`,
    );
  }

  // 4. Rate Limiting (60 req / min per session_id)
  const rateLimit = await checkRateLimit(sessionId, 60, 60000);
  if (!rateLimit.allowed) {
    throw new Error(
      `TooManyRequests: Event rate limit exceeded for session '${sessionId}' (max 60 req/min). Retry in ${rateLimit.retryAfterSeconds}s.`,
    );
  }

  // 5. Idempotency Check: check if event_id already persisted
  const eventDocRef = db.collection('events').doc(eventId);
  const existingEventSnap = await eventDocRef.get();
  if (existingEventSnap.exists) {
    return {
      event: existingEventSnap.data() as Event,
      isDuplicate: true,
    };
  }

  // 6. Validate metadata & restricted fields
  const safeMetadata = validateEventMetadata(eventType, metadata);

  // 7. Server-generated received_at
  const receivedAtIso = now.toISOString();

  const newEvent: Event = {
    event_id: eventId,
    client_id: clientId,
    landing_id: landingId,
    session_id: sessionId,
    event_type: eventType,
    occurred_at: occurredAt || receivedAtIso,
    received_at: receivedAtIso,
    page: page || session.referrer || '/',
    metadata: safeMetadata,
  };

  // 8. Persist Event document & update session last_activity_at
  await eventDocRef.set(newEvent);

  await db.collection('sessions').doc(sessionId).update({
    last_activity_at: receivedAtIso,
  });

  const activePointerRef = db
    .collection('active_sessions')
    .doc(`${clientId}_${landingId}_${session.anonymous_id}`);
  const activeSnap = await activePointerRef.get();
  if (activeSnap.exists && activeSnap.data()?.session_id === sessionId) {
    await activePointerRef.update({
      last_activity_at: receivedAtIso,
    });
  }

  return {
    event: newEvent,
    isDuplicate: false,
  };
}
