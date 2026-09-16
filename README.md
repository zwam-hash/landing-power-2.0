# BI Control Center

Foundation for Landing Power / BI Control Center.

The product connects acquisition, campaigns, landings, behavior, leads, scoring, opportunities, sales, revenue and BI.

## Current status

Module 0 is initialized. No product module is implemented yet.

## Decisions

- `client_id` is the only root identifier for customer operational data.
- ZWAM administration and customer operations are separate domains.
- Firebase Cloud Functions 2nd Gen and TypeScript are the backend baseline.
- Firestore is the operational database; derived metrics remain recalculable.
- npm is the package manager.
- Vitest is the unit test runner.

See [docs/architecture.md](docs/architecture.md) and [docs/decisions/0001-foundation.md](docs/decisions/0001-foundation.md).
