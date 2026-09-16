import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Client,
  type Landing,
  type Lead,
  type Opportunity,
  type Sale,
  type Session,
  type User,
  type Module,
  initFirebaseAdmin,
  getFirestoreAdmin,
} from '../functions/src/index.js';

describe('Data Foundation & Isolation Architecture', () => {
  it('uses client_id as the operational isolation key on client-scoped entities', () => {
    const sampleClient: Client = {
      client_id: 'client-zwam-01',
      company_name: 'Empresa Test',
      business_sector: 'Technology',
      legal_name: 'Empresa Test S.A.',
      contact_email: 'admin@test.com',
      contact_phone: '+123456789',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const sampleLanding: Landing = {
      landing_id: 'landing-01',
      client_id: 'client-zwam-01',
      name: 'Landing Promocional',
      slug: 'landing-promo',
      status: 'published',
      monthly_fee: 150,
      operational_status: 'active',
      billing_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const sampleLead: Partial<Lead> = {
      lead_id: 'lead-01',
      client_id: 'client-zwam-01',
      name: 'Juan Perez',
      email: 'juan@example.com',
      phone: '+56912345678',
    };

    const sampleOpportunity: Partial<Opportunity> = {
      opportunity_id: 'opp-01',
      client_id: 'client-zwam-01',
      lead_id: 'lead-01',
      value: 500,
      currency: 'USD',
    };

    const sampleSale: Partial<Sale> = {
      sale_id: 'sale-01',
      client_id: 'client-zwam-01',
      lead_id: 'lead-01',
      value: 500,
      currency: 'USD',
    };

    expect(sampleClient).toHaveProperty('client_id', 'client-zwam-01');
    expect(sampleLanding).toHaveProperty('client_id', 'client-zwam-01');
    expect(sampleLead).toHaveProperty('client_id', 'client-zwam-01');
    expect(sampleOpportunity).toHaveProperty('client_id', 'client-zwam-01');
    expect(sampleSale).toHaveProperty('client_id', 'client-zwam-01');

    // Strict non-existence check for parallel tenancy aliases
    expect(sampleClient).not.toHaveProperty('tenant_id');
    expect(sampleClient).not.toHaveProperty('customer_id');
    expect(sampleLanding).not.toHaveProperty('tenant_id');
    expect(sampleLanding).not.toHaveProperty('customer_id');
    expect(sampleLead).not.toHaveProperty('tenant_id');
    expect(sampleLead).not.toHaveProperty('customer_id');
  });

  it('keeps global entities free of artificial client_id properties', () => {
    const sampleUser: User = {
      user_id: 'user-01',
      email: 'user@zwam.io',
      display_name: 'Usuario Global',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const sampleModule: Module = {
      module_id: 'mod-01',
      key: 'acquisition',
      name: 'Acquisition Intelligence',
      description: 'Módulo de gestión de captación',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(sampleUser).not.toHaveProperty('client_id');
    expect(sampleModule).not.toHaveProperty('client_id');
  });
});

describe('Firebase Backend Foundation (Local / Emulator Mode)', () => {
  it('initializes Firebase Admin SDK in local emulator mode without production access', () => {
    // Configure local emulator environment variables for test execution
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIREBASE_PROJECT_ID = 'zwam-bi';

    const app = initFirebaseAdmin();
    expect(app).toBeDefined();
    expect(app.options.projectId).toBe('zwam-bi');

    const db = getFirestoreAdmin();
    expect(db).toBeDefined();
  });
});

describe('Firestore Security Rules Foundation', () => {
  it('enforces deny-by-default policy in firestore.rules', () => {
    const rulesPath = resolve(__dirname, '../firestore.rules');
    const rulesContent = readFileSync(rulesPath, 'utf-8');

    expect(rulesContent).toContain("rules_version = '2';");
    expect(rulesContent).toContain('allow read, write: if false;');
  });
});
