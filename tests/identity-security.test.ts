import { describe, expect, it, beforeEach } from 'vitest';
import {
  type Client,
  type Membership,
  type User,
  initFirebaseAdmin,
  getFirestoreAdmin,
  requireAuthenticatedUser,
  requireMembership,
  requireClientAccess,
  requirePermission,
  requireActiveClient,
} from '../functions/src/index.js';

describe('Module 2 — Identity, Memberships & Security Guards (Local / Emulator Mode)', () => {
  const db = getFirestoreAdmin();

  // Test Fixtures
  const userA: User = {
    user_id: 'user_a_uid',
    email: 'usera@acme.com',
    display_name: 'User A',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const userDisabled: User = {
    user_id: 'user_disabled_uid',
    email: 'disabled@acme.com',
    display_name: 'User Disabled',
    status: 'disabled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const globalAdmin: User = {
    user_id: 'global_admin_uid',
    email: 'admin@zwam.io',
    display_name: 'Global ZWAM Admin',
    status: 'active',
    is_global_admin: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const clientA: Client = {
    client_id: 'client_a',
    company_name: 'Client A Corp',
    business_sector: 'Retail',
    legal_name: 'Client A Corp S.A.',
    contact_email: 'contact@clienta.com',
    contact_phone: '+11111111',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const clientB: Client = {
    client_id: 'client_b',
    company_name: 'Client B Ltd',
    business_sector: 'Finance',
    legal_name: 'Client B Ltd',
    contact_email: 'contact@clientb.com',
    contact_phone: '+22222222',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const membershipUserAClientA: Membership = {
    membership_id: 'user_a_uid_client_a',
    user_id: 'user_a_uid',
    client_id: 'client_a',
    role: 'commercial',
    data_scope: 'client',
    permissions: ['leads.view', 'sales.view', 'sales.create'],
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const membershipUserAClientB: Membership = {
    membership_id: 'user_a_uid_client_b',
    user_id: 'user_a_uid',
    client_id: 'client_b',
    role: 'marketing',
    data_scope: 'client',
    permissions: ['marketing.view', 'marketing.manage'],
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const inactiveMembership: Membership = {
    membership_id: 'user_a_uid_client_c',
    user_id: 'user_a_uid',
    client_id: 'client_c',
    role: 'commercial',
    data_scope: 'assigned',
    permissions: ['leads.view'],
    status: 'disabled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    // Seed Firestore emulator/local DB memory with test documents
    await db.collection('users').doc(userA.user_id).set(userA);
    await db.collection('users').doc(userDisabled.user_id).set(userDisabled);
    await db.collection('users').doc(globalAdmin.user_id).set(globalAdmin);

    await db.collection('clients').doc(clientA.client_id).set(clientA);
    await db.collection('clients').doc(clientB.client_id).set(clientB);

    await db
      .collection('memberships')
      .doc(membershipUserAClientA.membership_id)
      .set(membershipUserAClientA);
    await db
      .collection('memberships')
      .doc(membershipUserAClientB.membership_id)
      .set(membershipUserAClientB);
    await db
      .collection('memberships')
      .doc(inactiveMembership.membership_id)
      .set(inactiveMembership);
  });

  // CASO 1: USER A -> CLIENT A -> acceso permitido
  it('CASE 1: Grants access when User A has an active membership for Client A', async () => {
    const result = await requireClientAccess('user_a_uid', 'client_a');
    expect(result.user.user_id).toBe('user_a_uid');
    expect(result.membership?.client_id).toBe('client_a');
    expect(result.isGlobalAdmin).toBe(false);
  });

  // CASO 2: USER A -> intenta acceder a CLIENT C (sin membership) -> acceso DENEGADO
  it('CASE 2: Denies access when User A attempts to access an unauthorized client without membership', async () => {
    await expect(
      requireClientAccess('user_a_uid', 'unauthorized_client'),
    ).rejects.toThrow(/Forbidden: User does not have an active membership/);
  });

  // CASO 3: USER A -> CLIENT A -> permission existente -> permitido
  it('CASE 3: Grants permission when User A has the required permission for Client A', async () => {
    const result = await requirePermission(
      'user_a_uid',
      'client_a',
      'sales.create',
    );
    expect(result.user.user_id).toBe('user_a_uid');
    expect(result.membership?.permissions).toContain('sales.create');
  });

  // CASO 4: USER A -> CLIENT A -> permission inexistente -> denegado
  it('CASE 4: Denies permission when User A lacks the required permission for Client A', async () => {
    await expect(
      requirePermission('user_a_uid', 'client_a', 'users.manage'),
    ).rejects.toThrow(
      /Forbidden: User lacks the required permission 'users.manage'/,
    );
  });

  // CASO 5: USER A -> membership inactive -> denegado
  it('CASE 5: Denies access when the membership is inactive/disabled', async () => {
    await expect(requireClientAccess('user_a_uid', 'client_c')).rejects.toThrow(
      /Forbidden: User does not have an active membership/,
    );
  });

  // CASO 6: USER A -> usuario disabled/inactive -> denegado
  it('CASE 6: Denies authentication and access when the user account is disabled', async () => {
    await expect(requireAuthenticatedUser('user_disabled_uid')).rejects.toThrow(
      /Unauthorized: User account is inactive or disabled/,
    );
  });

  // CASO 7: GLOBAL ZWAM ADMIN -> CLIENT A -> permitido según política global
  it('CASE 7: Grants access to Global ZWAM Admin for any client without requiring a specific membership', async () => {
    const result = await requirePermission(
      'global_admin_uid',
      'client_a',
      'users.manage',
    );
    expect(result.user.user_id).toBe('global_admin_uid');
    expect(result.isGlobalAdmin).toBe(true);
  });

  // CASO 8: USER A -> pertenece a CLIENT A y CLIENT B -> acceso válido a ambos según sus memberships
  it('CASE 8: Validates independent multi-client access for User A across Client A and Client B', async () => {
    const accessA = await requireClientAccess('user_a_uid', 'client_a');
    expect(accessA.membership?.role).toBe('commercial');

    const accessB = await requireClientAccess('user_a_uid', 'client_b');
    expect(accessB.membership?.role).toBe('marketing');

    // Permission check for Client B
    const permB = await requirePermission(
      'user_a_uid',
      'client_b',
      'marketing.manage',
    );
    expect(permB.membership?.client_id).toBe('client_b');

    // Cross-permission rejection check: sales.create is valid on Client A, but NOT on Client B
    await expect(
      requirePermission('user_a_uid', 'client_b', 'sales.create'),
    ).rejects.toThrow(/Forbidden: User lacks the required permission/);
  });

  // CASO 9: Invariante de Document ID canónico (sin fallback)
  it('CASE 9: Rejects membership records stored with non-canonical Document IDs', async () => {
    // Save a membership with fields pointing to user_a_uid and client_d, but with a non-canonical doc ID 'invalid_id_format'
    const nonCanonicalMembership: Membership = {
      membership_id: 'invalid_id_format',
      user_id: 'user_a_uid',
      client_id: 'client_d',
      role: 'commercial',
      data_scope: 'client',
      permissions: ['leads.view'],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db
      .collection('memberships')
      .doc(nonCanonicalMembership.membership_id)
      .set(nonCanonicalMembership);

    // Require client access for client_d must be rejected because getMembershipForClient resolves strictly via doc('user_a_uid_client_d')
    await expect(requireClientAccess('user_a_uid', 'client_d')).rejects.toThrow(
      /Forbidden: User does not have an active membership/,
    );
  });
});
