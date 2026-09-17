import { getFirestoreAdmin } from './firebase-admin.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Distributed Fixed Window Rate Limiter using Firestore.
 * Generates deterministic bucket keys per 1-minute window: `rate_limits/{key}_window_{bucketMinute}`.
 * Limits writing to at most 1 ephemeral document per key per minute window.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60000,
): Promise<RateLimitResult> {
  const db = getFirestoreAdmin();
  const now = Date.now();
  const bucketMinute = Math.floor(now / windowMs);
  const docId = `${key}_win_${bucketMinute}`;
  const docRef = db.collection('rate_limits').doc(docId);

  const expiresAt = new Date(now + 300000); // 5-minute TTL for auto-cleanup

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);

    if (!snap.exists) {
      transaction.set(docRef, {
        count: 1,
        expires_at: expiresAt,
        window_start: new Date(bucketMinute * windowMs),
      });
      return {
        allowed: true,
        remaining: limit - 1,
        retryAfterSeconds: 0,
      };
    }

    const data = snap.data();
    const currentCount = (data?.count as number) || 0;

    if (currentCount >= limit) {
      const windowEndMs = (bucketMinute + 1) * windowMs;
      const retryAfterSeconds = Math.ceil((windowEndMs - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    }

    transaction.update(docRef, {
      count: currentCount + 1,
    });

    return {
      allowed: true,
      remaining: limit - (currentCount + 1),
      retryAfterSeconds: 0,
    };
  });
}
