const ANONYMOUS_ID_STORAGE_KEY = 'zwam_anonymous_id';

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC 4122 Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 Variant 10xx
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error(
    'Crypto API is unavailable in this environment to generate a valid UUID v4.',
  );
}

/**
 * Retrieves or generates the canonical anonymous_id for the browser.
 * Uses localStorage ONLY so multiple tabs in the same browser share the same anonymous identity.
 */
export function getOrCreateAnonymousId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return generateUuidV4();
  }

  let anonymousId = localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY);

  if (!anonymousId || anonymousId.trim().length === 0) {
    anonymousId = generateUuidV4();
    localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, anonymousId);
  }

  return anonymousId;
}
