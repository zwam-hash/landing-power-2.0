# Data Model Specification — ZWAM 2.0 (Module 2 Identity & Security)

This document provides a technical specification of the domain entities, key fields, relationships, and status enums defined in `@zwam/types`.

---

## 1. Core Identity & Security Domain

### `users`

Global user identities mapped 1:1 from Firebase Auth UIDs.

- `user_id` (string, PK / Auth UID)
- `email` (string)
- `display_name` (string)
- `status` (`UserStatus`: `'active'` | `'disabled'` | `'pending'`)
- `is_global_admin` (boolean optional — flags global ZWAM admin status)
- `created_at`, `updated_at` (Timestamp)

### `memberships`

Source of truth for user authorization and membership scoping per client organization.

- `membership_id` (string, PK)
- `user_id` (string, FK -> `users.user_id`)
- `client_id` (string, FK -> `clients.client_id`)
- `role` (`Role`: `'client_master'` | `'marketing'` | `'commercial'` | `'agency'` | `'zwam_admin'`)
- `data_scope` (`DataScope`: `'global'` | `'client'` | `'team'` | `'assigned'`)
- `permissions` (string array of `Permission`: e.g. `['leads.view', 'sales.create']`)
- `status` (`MembershipStatus`: `'active'` | `'invited'` | `'disabled'`)
- `created_at`, `updated_at` (Timestamp)

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

---

## 3. Leads & Commercial Domain

### `leads` & `sales`

Operational client records isolated strictly by `client_id`.

- `lead_id` / `sale_id` (string, PK)
- `client_id` (string, FK -> `clients.client_id`)
- `status` (`LeadStatus` / `SaleStatus`)
