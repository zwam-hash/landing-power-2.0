import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Safely initializes the Firebase Admin SDK.
 * Uses local environment variables or defaults to project ID 'zwam-bi'.
 */
export function initFirebaseAdmin(): App {
  if (getApps().length === 0) {
    return initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'zwam-bi',
    });
  }
  return getApp();
}

/**
 * Returns the Firestore Admin instance safely initialized.
 */
export function getFirestoreAdmin(): Firestore {
  initFirebaseAdmin();
  return getFirestore();
}

/**
 * Returns the Firebase Auth Admin instance safely initialized.
 */
export function getAuthAdmin(): Auth {
  initFirebaseAdmin();
  return getAuth();
}

/**
 * Verifies a Firebase Auth ID token server-side.
 * Returns the verified Auth UID if valid, or undefined if invalid/missing.
 */
export async function verifyAuthToken(
  authToken?: string,
): Promise<string | undefined> {
  if (!authToken || authToken.trim().length === 0) {
    return undefined;
  }
  try {
    const auth = getAuthAdmin();
    const decoded = await auth.verifyIdToken(authToken);
    return decoded.uid;
  } catch {
    return undefined;
  }
}
