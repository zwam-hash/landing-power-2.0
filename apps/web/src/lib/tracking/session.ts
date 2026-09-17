import type { Session } from '@zwam/types';
import { getOrCreateAnonymousId } from './anonymous-id.js';
import { captureDeviceInfo, captureRawTrackingContext } from './attribution.js';
import { AcquisitionApiClient } from './client.js';

let activeSession: Session | null = null;
const INACTIVITY_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

export function clearActiveSession(): void {
  activeSession = null;
}

export async function ensureActiveSession(
  clientId: string,
  landingId: string,
  apiClient: AcquisitionApiClient,
): Promise<Session> {
  const nowMs = Date.now();

  if (activeSession) {
    const lastActivityMs = new Date(activeSession.last_activity_at).getTime();
    if (nowMs - lastActivityMs < INACTIVITY_THRESHOLD_MS) {
      return activeSession;
    }
    // Expired session: clear local reference to force acquiring a new session
    activeSession = null;
  }

  const anonymousId = getOrCreateAnonymousId();
  const deviceInfo = captureDeviceInfo();
  const trackingContext = captureRawTrackingContext();

  const result = await apiClient.createOrReuseSession({
    clientId,
    landingId,
    anonymousId,
    deviceInfo,
    trackingContext,
  });

  activeSession = result.session;
  return activeSession;
}

export function getActiveSession(): Session | null {
  return activeSession;
}
