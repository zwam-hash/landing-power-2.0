# Architecture — ZWAM 2.0

## 1. Core Principles & Isolation

- **Primary Customer Key:** `client_id` is the root operational identifier across all customer data.
- **Tenancy Rules:** No `tenant_id` or `customer_id` aliases exist anywhere in domain models or persistence schemas.
- **Domain vs CRM:** ZWAM is an Acquisition Intelligence platform. ZWAM is NOT a CRM. CRM integration is treated as an external integration destination.
- **Source of Truth Policy:** Derived metrics never overwrite primary append-oriented historical operational records.

## 2. Shared Domain Layer (`@zwam/types`)

The project uses a dedicated lightweight workspace package `packages/types` (`@zwam/types`) containing pure TypeScript types, interfaces, and status unions/enums.

### Domains Defined

1. **Core:** `Client`, `ClientContact`, `User`, `Membership`, `Contract`, `Subscription`, `Module`, `ClientModule`.
2. **Acquisition:** `Landing`, `LandingVersion`, `Campaign`, `Adset`, `Ad`, `Session`, `TrackingContext`, `Event`, `Attribution`.
3. **Leads:** `Lead`, `LeadAttribution`, `LeadScore`, `ScoreBreakdown`, `ScoreFlags`.
4. **Commercial:** `Opportunity`, `Sale`, `Revenue`.
5. **Integrations:** `Integration`, `CRMRecord`, `CapiLog`.
6. **Operations:** `AuditLog`, `Usage`.

## 3. Timestamp & Persistence Convention

- **Domain Types:** Use `Date | string` to remain platform-agnostic and usable in both frontend and serverless environments.
- **Firestore Persistence:** Use `WithFirestoreTimestamps<T>` and `FirestoreTimestampField` (`Date | string | FirestoreTimestamp`), isolating domain logic from Firebase Admin/SDK specifics.
- **Standard Field Names:** `created_at`, `updated_at`, `occurred_at`, `published_at`, `sold_at`, `first_seen_at`, `last_seen_at`.

## 4. Security & Environment Configuration

- **Firestore Rules:** Enforces strict _deny-by-default_ (`allow read, write: if false;`).
- **Firebase Project Target:** Confirmed project ID `zwam-bi` configured in `.firebaserc` and `apps/web/src/lib/firebase.ts`.
- **Backend Admin:** `functions/src/lib/firebase-admin.ts` provides safe SDK initialization for Cloud Functions 2nd Gen.
- **Emulators:** Local testing utilizes Firebase Emulator Suite (Auth: 9099, Functions: 5001, Firestore: 8080, Storage: 9199, UI: 4000) without accessing or requiring production credentials.
