# Architecture — ZWAM 2.0

## 1. Core Principles & Isolation

- **Primary Customer Key:** `client_id` is the root operational identifier across all customer data.
- **Tenancy Rules:** No `tenant_id` or `customer_id` aliases exist anywhere in domain models or persistence schemas.
- **Domain vs CRM:** ZWAM is an Acquisition Intelligence platform. ZWAM is NOT a CRM. CRM integration is treated as an external integration destination.
- **Source of Truth Policy:** Derived metrics never overwrite primary append-oriented historical operational records.

---

## 2. Identity, Memberships & Security Model (Module 2)

### 2.1 Identity Source

- **Firebase Authentication** is the sole identity provider.
- Firebase Auth UID is mapped 1:1 to `user_id` in Firestore (`users/{user_id}`).

### 2.2 Memberships as Source of Truth & Canonical Document ID Invariant

- The relation `USER ↔ CLIENT` is stored and validated directly in Firestore `memberships/{membership_id}`.
- **Canonical Document ID Invariant:** All membership documents MUST use the strict canonical Document ID format `${user_id}_${client_id}` (e.g. `memberships/user_a_uid_client_a`).
- `getMembershipForClient(authUid, clientId)` resolves **exclusively** via `memberships/${authUid}_${clientId}` in O(1) time without field query fallbacks. Records without this ID format are treated as invalid.
- **Why Custom Claims are NOT the primary source:** Storing memberships in Firestore avoids data duplication, sync delays, and token size limits, while supporting multi-client memberships dynamically without requiring token refreshes.

### 2.3 Roles, Granular Permissions & Data Scope

- **Membership Roles (Client-Scoped):** Functional groupings (`client_master`, `marketing`, `commercial`, `agency`). `zwam_admin` is NOT a membership role.
- **Permissions:** Action-level granular strings (`leads.view`, `sales.create`, `users.manage`, `memberships.manage`, `bi.view`, `settings.manage`).
- **Data Scope:** Contract defining _data boundary access_ (`global`, `client`, `team`, `assigned`), cleanly separated from tool permissions. Complete assigned/team query evaluation logic will be implemented as operational modules (Leads/Commercial) are introduced.

#### Conceptual Flow:

```text
USER (Auth UID)
  └── MEMBERSHIP
        ├── DOCUMENT ID: {user_id}_{client_id}
        ├── CLIENT_ID (e.g. "acme_corp")
        ├── ROLE (e.g. "commercial")
        ├── PERMISSIONS (e.g. ["leads.view", "sales.create"])
        └── DATA SCOPE (e.g. "assigned" vs "client")
```

### 2.4 Multi-Client Support

A single user can hold independent active memberships for multiple distinct `client_id`s:

```text
USER A (user_a_uid)
  ├── membership (doc: user_a_uid_client_a) ──> CLIENT A (Role: commercial)
  └── membership (doc: user_a_uid_client_b) ──> CLIENT B (Role: marketing)
```

### 2.5 Global ZWAM Admin

- Represented **exclusively** by `is_global_admin: true` on `users/{user_id}`.
- Global ZWAM admins operate across multiple client organizations with `'global'` scope without creating artificial individual membership documents per client.

### 2.6 Backend Authorization (`functions/src/lib/auth-guard.ts`)

Backend Cloud Functions and APIs enforce authorization through reusable guards:

- `requireAuthenticatedUser(authUid)`
- `requireMembership(authUid, clientId)`
- `requireClientAccess(authUid, clientId)`
- `requirePermission(authUid, clientId, permission)`
- `requireActiveClient(clientId)`

---

## 3. Module Registry Boundary (`Module` vs `ClientModule`)

- **`Module`:** Global definition of a ZWAM module (e.g., `key: "acquisition"`, `name: "Acquisition Intelligence"`).
- **`ClientModule`:** Client-specific instance and status (`client_id`, `module_id`, `status`, `configuration: Record<string, unknown>`).

---

## 4. Shared Domain Layer (`@zwam/types`)

The project uses a dedicated lightweight workspace package `packages/types` (`@zwam/types`) containing pure TypeScript types, interfaces, and status unions/enums.

### Domains Defined

1. **Core:** `Client`, `ClientContact`, `User`, `Membership`, `Contract`, `Subscription`, `Module`, `ClientModule`.
2. **Acquisition:** `Landing`, `LandingVersion`, `Campaign`, `Adset`, `Ad`, `Session`, `TrackingContext`, `Event`, `Attribution`.
3. **Leads:** `Lead`, `LeadAttribution`, `LeadScore`, `ScoreBreakdown`, `ScoreFlags`.
4. **Commercial:** `Opportunity`, `Sale`, `Revenue`.
5. **Integrations:** `Integration`, `CRMRecord`, `CapiLog`.
6. **Operations:** `AuditLog`, `Usage`.

---

## 5. Timestamp & Persistence Convention

- **Domain Types:** Use `Date | string` to remain platform-agnostic.
- **Firestore Persistence:** Use `WithFirestoreTimestamps<T>` and `FirestoreTimestampField` (`Date | string | FirestoreTimestamp`).
- **Standard Field Names:** `created_at`, `updated_at`, `occurred_at`, `published_at`, `sold_at`, `first_seen_at`, `last_seen_at`.

---

## 6. Security & Environment Configuration

- **Firestore Rules:** Enforces strict _deny-by-default_ (`allow read, write: if false;`) with helper validation functions for authentication and client isolation (`hasClientAccess(clientId)`, `isGlobalAdmin()`).
- **Firebase Project Target:** Confirmed project ID `zwam-bi` configured in `.firebaserc` and `apps/web/src/lib/firebase.ts`.
- **Backend Admin:** `functions/src/lib/firebase-admin.ts` provides safe SDK initialization for Cloud Functions 2nd Gen.
- **Emulators:** Local testing utilizes Firebase Emulator Suite (Auth: 9099, Functions: 5001, Firestore: 8080, Storage: 9199, UI: 4000) without accessing or requiring production credentials.
