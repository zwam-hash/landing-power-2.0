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

- **Canonical Document ID Invariant:** `membership_id` = `{user_id}_{client_id}` (e.g. `user_a_uid_client_a`)
- `user_id` (string, FK -> `users.user_id`)
- `client_id` (string, FK -> `clients.client_id`)
- `role` (`Role`: `'client_master'` | `'marketing'` | `'commercial'` | `'agency'`)
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

### `modules` & `client_modules`

Global module definitions and client-specific module configurations.

- `modules`: `module_id` (PK), `key`, `name`, `description`, `status`
- `client_modules`: `client_module_id` (PK), `client_id`, `module_id`, `status`, `configuration` (`Record<string, unknown>`)

---

## 2. Acquisition Domain Contracts

### `landings`

Landing pages owned by a client organization.

- `landing_id` (string, PK)
- `client_id` (string, FK -> `clients.client_id`)
- `name`, `slug` (string)
- `status` (`LandingStatus`: `'draft'` | `'published'` | `'archived'`)
- `monthly_fee` (number)
- `draft_version_id`, `published_version_id` (string optional)
- `operational_status` (`LandingOperationalStatus`: `'active'` | `'inactive'` | `'maintenance'`)
- `billing_status` (`LandingBillingStatus`: `'active'` | `'past_due'` | `'cancelled'`)
- `created_at`, `updated_at` (Timestamp)

### `landing_versions`

Immutable content/configuration versions of a landing page.

- `landing_version_id` (string, PK)
- `landing_id` (string, FK -> `landings.landing_id`)
- `client_id` (string, FK -> `clients.client_id`)
- `version_number` (number)
- `status` (`LandingVersionStatus`: `'draft'` | `'published'` | `'archived'`)
- `configuration` (`Record<string, unknown>`)
- `created_at`, `updated_at` (Timestamp)

### `sessions`

Visitor sessions on a landing page.

- `session_id` (string, PK)
- `client_id` (string, FK -> `clients.client_id`)
- `landing_id` (string, FK -> `landings.landing_id`)
- `landing_version_id` (string, resolved server-side from `published_version_id`)
- `anonymous_id` (string, persistent browser identifier from `localStorage`)
- `started_at` (Timestamp)
- `last_activity_at` (Timestamp — updated on valid events; session inactive if `now - last_activity_at >= 3m`)
- `tracking_context` (`TrackingContext`: RAW `utm_*`, `fbclid`, `fbp`, `fbc`, `gclid`, `wbraid`, `gbraid`, `ttclid`, `referrer`, `landing_url`)
- `attribution` (`Attribution`: `source_type`, `platform`, `campaign_id`, `adset_id`, `ad_id`, `confidence`)
- `device` (`DeviceContext`: `user_agent`, `language`, `screen_resolution`, `viewport_size`)
- `status` (`SessionStatus`: `'active'` | `'expired'` | `'converted'`)

### `events`

Behavioral and transactional events captured during visitor interaction.

- `event_id` (string, PK / UUID v4 for idempotency)
- `session_id` (string, FK -> `sessions.session_id`)
- `client_id` (string, FK -> `clients.client_id`)
- `landing_id` (string, FK -> `landings.landing_id`)
- `landing_version_id` (string)
- `anonymous_id` (string)
- `event_type` (`EventType`: `'page_view'` | `'scroll_depth'` | `'cta_click'` | `'form_start'` | `'form_submit'` | `'lead_captured'` | `'outbound_click'` | `'custom'`)
- `event_name` (string)
- `occurred_at` (Timestamp — client-side timestamp)
- `received_at` (Timestamp — server-generated timestamp)
- `metadata` (`Record<string, unknown>`)
- `schema_version` (number)

### `campaigns`, `adsets`, `ads`

Optional ad hierarchy enrichment models for paid traffic.

- `campaign_id` / `adset_id` / `ad_id` (string, PK)
- `client_id` (string, FK -> `clients.client_id`)
- `platform` (`AttributionPlatform`: `'meta'` | `'google'` | `'instagram'` | `'tiktok'` | `'linkedin'` | `'other'`)
- `name` (string)
- `external_id` (string)
- `status` (`CampaignStatus` / `AdsetStatus` / `AdStatus`: `'active'` | `'paused'` | `'archived'`)
- `utm_campaign` / `utm_content` / `utm_term` (string optional)

### `rate_limits`

Ephemeral Firestore documents tracking request window limits.

- `rate_limit_id` (string, PK: `{key}_win_{minuteBucket}`)
- `client_id` (string)
- `minute_bucket` (number)
- `request_count` (number)
- `expires_at` (Timestamp — TTL set to 5 minutes after bucket window)

---

## 3. Leads & Commercial Domain Contracts

### `leads` & `sales`

Operational client records isolated strictly by `client_id`.

- `lead_id` / `sale_id` (string, PK)
- `client_id` (string, FK -> `clients.client_id`)
- `status` (`LeadStatus` / `SaleStatus`)
