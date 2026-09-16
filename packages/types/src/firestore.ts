/**
 * Structure representing a Firestore Timestamp object without importing Firebase Admin/Client SDK libraries directly.
 * Keeps pure domain types decoupled from specific SDK implementations.
 */
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

/**
 * Union type for timestamp fields in Firestore document persistence models.
 * Accepts JS Date, ISO String, or Firestore Timestamp / FieldValue sentinel.
 */
export type FirestoreTimestampField = Date | string | FirestoreTimestamp;

/**
 * Helper utility type to map date fields in a domain model to Firestore persistence fields.
 */
export type WithFirestoreTimestamps<T> = {
  [K in keyof T]: T[K] extends Date | string
    ? FirestoreTimestampField
    : T[K] extends Date | string | undefined
      ? FirestoreTimestampField | undefined
      : T[K];
};
