# Data Model Specification — ZWAM 2.0 (Module 1 Data Foundation)

This document provides a technical specification of the domain entities, key fields, relationships, and status enums defined in `@zwam/types`.

---

## 1. Core Domain

### `clients`

Root entity for customer organizations.

- `client_id` (string, PK)
- `company_name` (string)
- `business_sector` (string)
- `legal_name` (string)
- `contact_email` (string)
- `contact_phone` (string)
- `status` (`ClientStatus`: `'active'` | `'inactive'` | `'suspended'` | `'pending'`)
- `created_at`, `updated_at` (Timestamp)

### `client_contacts`

Key contacts within a client organization.

- `contact_id` (string, PK)
- `client_id` (string, FK -> `clients.client_id`)
- `name`, `email`, `phone`, `role` (string)
- `status` (`ClientContactStatus`: `'active'` | `'inactive'`)
- `created_at`, `updated_at` (Timestamp)

### `users`

Global user identities mapped from Firebase Auth UIDs.

- `user_id` (string, PK / Auth UID)
- `email`, `display_name` (string)
- `status` (`UserStatus`: `'active'` | `'disabled'` | `'pending'`)
- `created_at`, `updated_at` (Timestamp)

### `memberships`

Role and permission mapping connecting users to client organizations.

- `membership_id` (string, PK)
- `user_id` (string, FK -> `users.user_id`)
- `client_id` (string, FK -> `clients.client_id`)
- `role` (string)
- `permissions` (string array)
- `status` (`MembershipStatus`: `'active'` | `'invited'` | `'disabled'`)
- `created_at`, `updated_at` (Timestamp)

---

## 2. Acquisition Domain

### `landings`

Landing pages owned by a client.

- `landing_id` (string, PK)
- `client_id` (string, FK -> `clients.client_id`)
- `name`, `slug` (string)
- `status` (`LandingStatus`: `'draft'` | `'published'` | `'archived'`)
- `monthly_fee` (number)
- `draft_version_id`, `published_version_id` (string optional)
- `operational_status` (`LandingOperationalStatus`: `'active'` | `'inactive'` | `'maintenance'`)
- `billing_status` (`LandingBillingStatus`: `'active'` | `'past_due'` | `'cancelled'`)
- `created_at`, `updated_at` (Timestamp)

### `sessions` & `events`

Web session context and behavior tracking logs.

- Key isolation: `client_id` + `landing_id` + `session_id`.
- Captures `utm_*`, `fbclid`, `gclid`, `ttclid`, `fbp`, `fbc`.

---

## 3. Leads & Commercial Domain

### `leads`

Acquired prospective customers.

- `lead_id` (string, PK)
- `client_id` (string, FK -> `clients.client_id`)
- `landing_id`, `session_id` (string, FK)
- `name`, `email`, `phone` (string)
- `attribution` (Attribution object)
- `lead_score` (number)
- `lead_quality` (`LeadQuality`: `'priority'` | `'high'` | `'medium'` | `'low'` | `'cold'`)
- `recommended_action` (`RecommendedAction`: `'immediate_priority'` | `'fast_contact'` | `'follow_up'` | `'nurturing'` | `'remarketing'`)
- `created_at`, `updated_at` (Timestamp)

### `opportunities` & `sales`

Commercial conversion tracking.

- `opportunity_id` (string, PK)
- `sale_id` (string, PK)
- `client_id` (string, FK -> `clients.client_id`)
- `lead_id` (string, FK -> `leads.lead_id`)
- `value`, `currency` (number, string)
- `status` (`OpportunityStatus` / `SaleStatus`)

---

## 4. Integrations & Operations

### `integrations`, `crm_records`, `capi_logs`, `audit_logs`, `usage`

- All customer operational integration records retain `client_id` as the root isolation field.
