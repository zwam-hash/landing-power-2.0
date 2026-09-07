# PROJECT_STATE.md — Landing Power 2.0
**Fecha:** Septiembre 2026
**Estado:** Greenfield (Desarrollo Aislado desde Cero)
**Estrategia:** Multi-tenant estricto + Closed-Loop Attribution

1. Decisiones de Arquitectura Aprobadas
- Espacio Master ZWAM: Colecciones normalizadas (clients, users, landings, landing_versions).
- Espacio Tenant: Aislamiento por client_id (campaigns, sessions, leads, sales, integrations).
- RBAC (5 Niveles): Master/Superadmin, Owner, Marketing, Sales, Agency.
- Reglas de Negocio Incorporadas:
  * Circuit Breaker: Bloqueo de ingestión si client_id o landing_id están inactivos/suspendidos.
  * Versionado Doble: Manejo de draft_version_id y published_version_id.
  * Totalizador MRR: Cálculo automático Base Plan + SUM(monthly_fee).
  * Cuotas Límite: Control duro de consumo (max_landings, max_monthly_leads, max_capi_events).

2. Stack Tecnológico Seleccionado
- Landing: HTML5/JS Moderno o Astro (PageSpeed 100/100).
- Dashboard: React 19 + Vite + Tailwind CSS v4 + Shadcn UI + TanStack Table + Tremor/Recharts.
- Backend: Cloud Functions v2 (Node 24) + Firestore (Proyecto limpio GCP/Firebase).

3. Roadmap de Ejecución
- [x] Fase 0: Definición Arquitectura y Esquema BD Normalizado.
- [x] Fase 1: Setup Monorepo + Git + Registro de Contexto.
- [x] Fase 2: Reglas de Seguridad Firestore (irestore.rules con RBAC).
- [ ] Fase 3: Backend Ingestión & Circuit Breaker (Node 24).
- [ ] Fase 4: Acquisition Intelligence Dashboard (React 19).
- [ ] Fase 5: Landing Comercial 2.0.
