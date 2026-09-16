import type { Client, Membership, User } from '@zwam/types';
import { getFirestoreAdmin } from './firebase-admin.js';

/**
 * Fetches the user profile document from Firestore (`users/{authUid}`).
 */
export async function getUserProfile(authUid: string): Promise<User | null> {
  const db = getFirestoreAdmin();
  const snap = await db.collection('users').doc(authUid).get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as User;
}

/**
 * Fetches all active memberships associated with the given authUid.
 */
export async function getUserMemberships(
  authUid: string,
): Promise<Membership[]> {
  const db = getFirestoreAdmin();
  const snap = await db
    .collection('memberships')
    .where('user_id', '==', authUid)
    .where('status', '==', 'active')
    .get();

  return snap.docs.map((doc) => doc.data() as Membership);
}

/**
 * Fetches an active membership for a specific user and client_id.
 */
export async function getMembershipForClient(
  authUid: string,
  clientId: string,
): Promise<Membership | null> {
  const db = getFirestoreAdmin();
  const snap = await db
    .collection('memberships')
    .where('user_id', '==', authUid)
    .where('client_id', '==', clientId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }
  return snap.docs[0].data() as Membership;
}

/**
 * Validates that the request has a valid, active user profile.
 */
export async function requireAuthenticatedUser(
  authUid?: string,
): Promise<User> {
  if (!authUid) {
    throw new Error('Unauthenticated: Authentication required.');
  }

  const user = await getUserProfile(authUid);
  if (!user || user.status !== 'active') {
    throw new Error('Unauthorized: User account is inactive or disabled.');
  }

  return user;
}

/**
 * Validates that the user has an active membership for the given client_id.
 */
export async function requireMembership(
  authUid: string,
  clientId: string,
): Promise<Membership> {
  const membership = await getMembershipForClient(authUid, clientId);
  if (!membership || membership.status !== 'active') {
    throw new Error(
      `Forbidden: User does not have an active membership for client '${clientId}'.`,
    );
  }
  return membership;
}

/**
 * Validates client access for a user.
 * Global ZWAM admins bypass single-client membership restrictions.
 */
export async function requireClientAccess(
  authUid: string,
  clientId: string,
): Promise<{ user: User; membership?: Membership; isGlobalAdmin: boolean }> {
  const user = await requireAuthenticatedUser(authUid);

  if (user.is_global_admin === true) {
    return { user, isGlobalAdmin: true };
  }

  const membership = await requireMembership(authUid, clientId);
  return { user, membership, isGlobalAdmin: false };
}

/**
 * Validates that the user has both client access and the required permission.
 * Global ZWAM admins bypass permission checks.
 */
export async function requirePermission(
  authUid: string,
  clientId: string,
  requiredPermission: string,
): Promise<{ user: User; membership?: Membership; isGlobalAdmin: boolean }> {
  const access = await requireClientAccess(authUid, clientId);

  if (access.isGlobalAdmin) {
    return access;
  }

  const permissions = access.membership?.permissions || [];
  if (!permissions.includes(requiredPermission)) {
    throw new Error(
      `Forbidden: User lacks the required permission '${requiredPermission}' for client '${clientId}'.`,
    );
  }

  return access;
}

/**
 * Validates that the client organization exists and is in an active operational status.
 */
export async function requireActiveClient(clientId: string): Promise<Client> {
  const db = getFirestoreAdmin();
  const snap = await db.collection('clients').doc(clientId).get();

  if (!snap.exists) {
    throw new Error(`NotFound: Client '${clientId}' does not exist.`);
  }

  const client = snap.data() as Client;
  if (client.status !== 'active') {
    throw new Error(
      `Forbidden: Client '${clientId}' is not active (status: ${client.status}).`,
    );
  }

  return client;
}
