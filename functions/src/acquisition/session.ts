import { createHash, randomUUID } from 'node:crypto';
import type { Session, TrackingContext } from '@zwam/types';
import { checkCircuitBreaker } from '../lib/circuit-breaker.js';
import { getFirestoreAdmin, verifyAuthToken } from '../lib/firebase-admin.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { deriveAttribution } from './attribution.js';
import { isValidUuidV4 } from './validation.js';

export interface CreateSessionParams {
  clientId: string;
  landingId: string;
  anonymousId: string;
  clientIp?: string;
  authToken?: string;
  verifiedUserId?: string;
  deviceInfo: {
    device_type?: string;
    browser?: string;
    browser_version?: string;
    os?: string;
    os_version?: string;
    screen_width?: number;
    screen_height?: number;
    viewport_width?: number;
    viewport_height?: number;
    language?: string;
    timezone?: string;
    user_agent?: string;
    referrer?: string;
  };
  trackingContext: TrackingContext;
}

export interface CreateSessionResult {
  session: Session;
  isReused: boolean;
}

const INACTIVITY_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

export async function createOrReuseSessionLogic(
  params: CreateSessionParams,
): Promise<CreateSessionResult> {
  const {
    clientId,
    landingId,
    anonymousId,
    clientIp,
    authToken,
    verifiedUserId: preVerifiedUserId,
    deviceInfo,
    trackingContext,
  } = params;

  // 1. Validate anonymous_id UUID v4 format
  if (!isValidUuidV4(anonymousId)) {
    throw new Error('BadRequest: Invalid anonymous_id UUID v4 format.');
  }

  // 2. Rate limiting (20 requests / min per SHA-256(IP + anonymous_id))
  const ip = clientIp || '127.0.0.1';
  const hashKey = createHash('sha256')
    .update(`${ip}_${anonymousId}`)
    .digest('hex');
  const rateLimitKey = `sess_create_${hashKey}`;
  const rateLimit = await checkRateLimit(rateLimitKey, 20, 60000);
  if (!rateLimit.allowed) {
    throw new Error(
      `TooManyRequests: Session creation rate limit exceeded. Retry in ${rateLimit.retryAfterSeconds}s.`,
    );
  }

  // 3. Circuit Breaker & Server-side resolution of landing_version_id
  const { landing } = await checkCircuitBreaker(clientId, landingId);
  if (
    !landing.published_version_id ||
    landing.published_version_id.trim().length === 0
  ) {
    throw new Error(
      `BadRequest: Landing '${landingId}' does not have an active published_version_id.`,
    );
  }
  const serverLandingVersionId = landing.published_version_id;

  // 4. Server-side verification of user_id via Firebase Auth token
  let verifiedUserId = preVerifiedUserId;
  if (!verifiedUserId && authToken) {
    verifiedUserId = await verifyAuthToken(authToken);
  }

  const db = getFirestoreAdmin();
  const now = new Date();
  const nowIso = now.toISOString();

  // 5. Concurrency-safe atomic transaction using deterministic active session pointer
  const activePointerRef = db
    .collection('active_sessions')
    .doc(`${clientId}_${landingId}_${anonymousId}`);

  return db.runTransaction(async (transaction) => {
    const activeSnap = await transaction.get(activePointerRef);

    if (activeSnap.exists) {
      const activeData = activeSnap.data();
      const existingSessionId = activeData?.session_id as string | undefined;

      if (existingSessionId) {
        const sessionRef = db.collection('sessions').doc(existingSessionId);
        const sessionSnap = await transaction.get(sessionRef);

        if (sessionSnap.exists) {
          const existingSession = sessionSnap.data() as Session;
          const activityMs = new Date(
            existingSession.last_activity_at,
          ).getTime();

          // Reuse if within 3 minutes (180,000 ms)
          if (now.getTime() - activityMs < INACTIVITY_THRESHOLD_MS) {
            const updatePayload: Partial<Session> = {
              last_activity_at: nowIso,
              ...(verifiedUserId ? { user_id: verifiedUserId } : {}),
            };

            transaction.update(
              sessionRef,
              updatePayload as Record<string, unknown>,
            );
            transaction.update(activePointerRef, { last_activity_at: nowIso });

            return {
              session: {
                ...existingSession,
                last_activity_at: nowIso,
                ...(verifiedUserId ? { user_id: verifiedUserId } : {}),
              },
              isReused: true,
            };
          }
        }
      }
    }

    // Create NEW Session with frozen tracking_context & derived attribution
    const sessionId = randomUUID();
    const attribution = deriveAttribution(trackingContext);

    const newSession: Session = {
      session_id: sessionId,
      client_id: clientId,
      landing_id: landingId,
      landing_version_id: serverLandingVersionId,
      anonymous_id: anonymousId,
      ...(verifiedUserId ? { user_id: verifiedUserId } : {}),

      started_at: nowIso,
      last_activity_at: nowIso,

      device_type: deviceInfo.device_type || 'desktop',
      browser: deviceInfo.browser || 'unknown',
      browser_version: deviceInfo.browser_version || 'unknown',
      os: deviceInfo.os || 'unknown',
      os_version: deviceInfo.os_version || 'unknown',

      screen_width: deviceInfo.screen_width || 0,
      screen_height: deviceInfo.screen_height || 0,
      viewport_width: deviceInfo.viewport_width || 0,
      viewport_height: deviceInfo.viewport_height || 0,

      language: deviceInfo.language || 'en',
      timezone: deviceInfo.timezone || 'UTC',

      user_agent: deviceInfo.user_agent || '',
      referrer: deviceInfo.referrer || trackingContext.referrer || '',

      tracking_context: trackingContext,
      attribution,
    };

    const sessionRef = db.collection('sessions').doc(sessionId);
    transaction.set(sessionRef, newSession);
    transaction.set(activePointerRef, {
      session_id: sessionId,
      client_id: clientId,
      landing_id: landingId,
      anonymous_id: anonymousId,
      last_activity_at: nowIso,
    });

    return {
      session: newSession,
      isReused: false,
    };
  });
}
