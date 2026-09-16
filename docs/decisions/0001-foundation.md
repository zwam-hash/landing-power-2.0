# ADR 0001: Foundation choices

- Status: accepted for Module 0
- Date: 2026-09-08

## Context

The previous workspace contained partial frontend, backend and Firebase configuration. It was intentionally discarded to avoid inheriting undocumented behavior.

## Decisions

1. Start from a clean monorepo with `apps/web` and `functions` workspaces.
2. Use npm consistently.
3. Use TypeScript with strict compiler settings for application and backend code.
4. Use Vitest for unit tests.
5. Use Firebase Cloud Functions 2nd Gen, Firestore, Authentication, Storage and Hosting as the platform baseline.
6. Use `client_id` as the sole customer isolation key.
7. Keep secrets in Google Secret Manager and store only references and metadata in Firestore.

## Consequences

Module 1 must establish Firebase configuration, TypeScript toolchains, emulator support and the initial data foundation before feature modules begin.
