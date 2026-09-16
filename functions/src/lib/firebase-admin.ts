import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

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
