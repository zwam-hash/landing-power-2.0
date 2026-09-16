import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
import { firebaseApp } from './firebase.js';

let authInstance: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
  }
  return authInstance;
}

export async function loginWithEmailPassword(
  email: string,
  pass: string,
): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  return signInWithEmailAndPassword(auth, email, pass);
}

export async function logoutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  return signOut(auth);
}

export function subscribeAuthState(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}
