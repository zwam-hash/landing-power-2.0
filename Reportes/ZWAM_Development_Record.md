# ZWAM 2.0 — Registro Histórico Permanente del Desarrollo

Este documento constituye la bitácora técnica acumulativa y fuente única de verdad respecto a las decisiones de arquitectura, modelos de datos, contratos funcionales, código implementado, correcciones y evoluciones de **ZWAM 2.0 (Landing Power + BI)**.

---

## 2026-09-17 10:00 — Módulo 0 (Foundation)

Se estableció la infraestructura base del proyecto monorepo npm con TypeScript strict, ES2022, NodeNext, ESLint, Prettier, Vitest y Firebase Admin SDK en entorno local y emulado.

### Contexto y Definición Inicial

- **Estructura del Proyecto:** Monorepo npm con aplicaciones `apps/web` (React/Next.js UI) y `functions` (Cloud Functions Gen 2 / Backend API), compartiendo el paquete de tipos `@zwam/types` (`packages/types`).
- **Configuración de Firebase:** Firebase Project ID configurado a `zwam-bi` en `.firebaserc` y `apps/web/src/lib/firebase.ts`. Reglas de Firestore y Storage configuradas inicialmente en modo _deny-all_ por defecto (`allow read, write: if false;`).
- **Entorno de Ejecución:** Node.js 20+, TypeScript strict mode, resolución de módulos `NodeNext`, testing con Vitest en emuladores locales de Firebase (Auth: 9099, Firestore: 8080, Functions: 5001, Storage: 9199, UI: 4000) sin tocar credenciales de producción.

---

## 2026-09-17 11:30 — Módulo 1 (Data Model & Client Isolation)

Se diseñó e implementó la base del modelo de dominio y la estrategia de aislamiento multi-tenant centrada estrictamente en `client_id` como raíz operacional.

### Aislamiento por `client_id`

- **Invariante Operacional:** `client_id` es el identificador principal de aislamiento en la base de datos.
- **Prohibiciones Explícitas:** No existe `tenant_id` ni `customer_id` como equivalente o abstracción paralela de tenancy.
- **Alcance del Dominio:** ZWAM es una plataforma de Inteligencia de Adquisición. No es un CRM completo; los CRM externos se tratan como destinos de integración.
- **Entidades de Fundación (`@zwam/types`):** `Client`, `ClientContact`, `Contract`, `Subscription`, `Module`, `ClientModule`.

---

## 2026-09-17 13:00 — Módulo 2 (Identity, Memberships & Security)

Se implementó el sistema de identidad centralizado en Firebase Auth, la gestión de membresías dinámicas cliente-usuario y los guards de autorización server-side.

### Modelo de Identidad y Seguridad

- **Identidad:** Mapeo 1:1 de Firebase Auth UID a `users/{user_id}` en Firestore.
- **Invariante de ID Canónico de Membresía:** Todas las membresías se persisten obligatoriamente con el Document ID canónico `memberships/{authUid}_{clientId}`. Las consultas `getMembershipForClient(authUid, clientId)` resuelven en O(1) directamente por clave de documento sin realizar fallbacks de consulta de campos.
- **Global ZWAM Admin:** Representado exclusivamente por `is_global_admin: true` en el documento `users/{user_id}`. Se eliminó la función/rol artificial `zwam_admin` de las membresías.
- **Guards Server-side (`functions/src/lib/auth-guard.ts`):** `requireAuthenticatedUser`, `requireMembership`, `requireClientAccess`, `requirePermission`, `requireActiveClient`.

---

## 2026-09-17 14:30 — Módulo 3 (Acquisition Intelligence Engine)

Se implementó el motor de ingestión de tráfico y comportamiento (Campaign → Adset → Ad → Landing → Session → Events → Attribution) con reglas de sesión estrictas, preservación RAW de tracking, circuit breaker, rate limiting y salvaguardas de seguridad.

### Ingestión y Reglas Operacionales de Adquisición

- **Persistencia de Identidad Anónima:** `anonymous_id` (UUID v4) persistido **exclusivamente en `localStorage`** (nunca `sessionStorage`).
- **Regla de Inactividad de 3 Minutos:** Una sesión permanece activa si `now - last_activity_at < 3 minutos` (180,000 ms). **Sin heartbeats, latidos ni pings sintéticos**. `last_activity_at` se actualiza únicamente ante ingestión de eventos reales o creación/reutilización válida de sesión.
- **Resolución Server-Side de `landing_version_id`:** `landing_version_id = landing.published_version_id`. Sin fallbacks a `draft_version_id` ni a `'v1'`. Si no existe versión publicada, la sesión se rechaza.
- **Coordinación Atómica en Firestore (`active_sessions`):** Uso de puntero atómico `active_sessions/{client_id}_{landing_id}_{anonymous_id}` dentro de una transacción `db.runTransaction` para prevenir race conditions y duplicados ante peticiones concurrentes. La fuente de verdad histórica completa permanece en `sessions`.
- **Autenticación Opcional Server-Side:** `session.user_id` solo se asigna si el token de Firebase Auth es verificado server-side vía `verifyAuthToken`. La ingestión pública anónima continúa funcionando sin exigir token.
- **Salvaguardas:** Circuit Breaker (`client.status === 'active'` y `landing.operational_status === 'active'`), Rate Limiting (20 req/min en creación de sesión, 60 req/min en eventos vía Firestore `rate_limits`), e idempotencia por `event_id` (UUID v4) con timestamp del servidor `received_at`.
- **Hito de Validación:** Módulo 3 cerrado con **35/35 tests pasados** y commit checkpoint `a1e0f5b feat: complete module 3 acquisition`.

---

## 2026-09-17 15:40 — Módulo 4

Se implementó el modelo Lead, la lógica de Registration, deduplicación de Leads, vinculación mediante anonymous_id con el historial de Sessions y el flujo de registro mediante formulario y preformulario de WhatsApp.

### 1. Definición Funcional y Contrato de Lead

- **Relación del Flujo Operacional:**
  ```text
  VISIT → SESSION → EVENTS → REGISTRATION → LEAD → PURCHASE → CLIENT
  ```
- **Principio Fundamental:** Un Lead NO se crea por mera intención (ej. un clic en botón de WhatsApp no crea Lead por sí solo). Un Lead nace únicamente a partir de una **Registration** válida (formulario web o preformulario de WhatsApp completado).
- **Modelo de Datos (`leads/{lead_id}`):**
  - `lead_id`: string (PK UUID v4)
  - `client_id`: string (FK -> `clients.client_id`)
  - `anonymous_id`: string (vínculo con el historial de sesiones y eventos del visitante)
  - `name`: string
  - `email`: string (opcional / normalizado a minúsculas)
  - `phone`: string (opcional / normalizado a dígitos numéricos)
  - `company`: string (opcional)
  - `city`: string (opcional)
  - `registration_session_id`: string (FK -> `sessions.session_id`)
  - `registration_source`: `'form'` | `'whatsapp_preform'`
  - `created_at`: Date | string
  - `updated_at`: Date | string
  - `status`: `'new'` | `'contacted'` | `'qualified'` | `'unqualified'` | `'converted'`
- **Exclusiones Explícitas:** No se incluyeron campos de score, calidad comercial, oportunidad, compra, ingresos, CRM status ni agente comercial en este módulo.

### 2. Trazabilidad Histórica y Persistencia de `anonymous_id`

- **Vinculación Histórica:** La colección `leads` contiene el `anonymous_id` para consultar retroactivamente todas las sesiones anteriores del visitante (`sessions WHERE anonymous_id == lead.anonymous_id`).
- **Sin Listas Crecientes:** **NO** se creó un array `lead.sessions[]` dentro del documento Lead. Las sesiones se mantienen como documentos independientes en la colección `sessions`.
- **Invarianza de Históricos:** Las sesiones y eventos del pasado no sufren modificaciones ni borrados cuando se crea o actualiza un Lead.

### 3. Flujo de WhatsApp y Preformulario

- El evento `whatsapp_click` por sí mismo registra únicamente un evento de comportamiento en la sesión.
- Para generar un Lead a partir de WhatsApp se requiere la Registration vía Preformulario:
  - Si el número de WhatsApp no está disponible en la sesión, el preformulario solicita: Nombre, Ciudad y WhatsApp.
  - Si el número es conocido, el preformulario solicita: Nombre y Ciudad.

### 4. Motor de Deduplicación de Leads

- **Regla de Coincidencia de Deduplicación:**
  - `(phone + email)` **O** `(phone + name)` **O** `email`
- **Criterios de Aplicación:**
  - Si se registra el mismo celular + mismo email → actualiza Lead existente.
  - Si se registra el mismo celular + mismo nombre → actualiza Lead existente.
  - Si se registra el mismo email (con o sin celular) → actualiza Lead existente.
  - Registrar solo celular o solo nombre sin email ni combinación cel+nombre **no es suficiente** para deduplicar (crea un nuevo Lead).
- **Preservación en Actualización:** Al actualizar un Lead existente, se preservan intactos el `lead_id`, `created_at`, `status` y `anonymous_id`, actualizando únicamente los datos de contacto, la sesión de registro reciente `registration_session_id`, la fuente `registration_source` y la fecha de modificación `updated_at`.

### 5. Separación Estricta entre Lead Deduplication y CAPI

- La deduplicación de contacto comercial de Lead es totalmente independiente de la futura deduplicación de eventos para Conversions API (CAPI).

### 6. Componentes de Código Creados / Modificados

- `packages/types/src/enums.ts`: Añadido el tipo `RegistrationSource` (`'form' | 'whatsapp_preform'`).
- `packages/types/src/domain.ts`: Actualizada la interfaz `Lead` para alinearse 100% al contrato del Módulo 4.
- `functions/src/leads/registration.ts`: Creado el servicio backend `registerLeadLogic` con validaciones, deduplicación, resolución de sesión y persistencia en Firestore.
- `functions/src/index.ts`: Re-exportado el módulo de registro de leads.
- `apps/web/src/lib/tracking/client.ts`: Añadido el método `registerLead` a `AcquisitionApiClient`.
- `apps/web/src/lib/tracking/leads.ts`: Creadas las funciones auxiliares `submitFormRegistration` y `submitWhatsAppPreform`.
- `apps/web/src/lib/tracking/index.ts`: Re-exportados los helpers de tracking de leads.
- `tests/lead.test.ts`: Creada la suite completa de pruebas de integración y negocio para el Módulo 4.

### 7. Validación del Módulo 4

- `npm run typecheck` — 0 errores de compilación TypeScript.
- `npm run lint` — 0 advertencias / errores de ESLint.
- `npm run format:check` — 100% archivos formateados con Prettier.
- `npm test` — Pruebas pasadas satisfactoriamente (incluyendo Lead creation, historical linkage, deduplication rules, WhatsApp preform y aislamiento).

---

## 2026-09-17 16:00 — Módulo 4 — Correcciones post-revisión

Se implementó la validación estricta de coincidencia entre session.anonymous_id y el anonymous_id enviado en la Registration, se separó semánticamente el evento whatsapp_click de la identificación del preformulario de WhatsApp, se eliminó la presencia de PII en la metadata de los eventos de comportamiento y se agregaron pruebas específicas de deduplicación únicamente por email e integridad de identidad de sesión.

### 1. Validación Estricta Session ↔ `anonymous_id`

- **Cambio:** En `functions/src/leads/registration.ts`, tras verificar la existencia de la sesión y la pertenencia de `client_id` y `landing_id`, se añadió la validación obligatoria `session.anonymous_id === anonymousId`.
- **Motivo:** Garantizar la integridad de identidad e impedir que una solicitud utilice un `session_id` legítimo con un `anonymous_id` perteneciente a otra entidad/navegador.

### 2. Corrección Semántica de `whatsapp_click` y Separación de Preformulario

- **Cambio:** En `apps/web/src/lib/tracking/leads.ts`:
  - Se creó el helper explícito `trackWhatsAppClick()` para registrar el evento de comportamiento `whatsapp_click` inmediatamente al hacer clic en el botón CTA de WhatsApp (sin PII y sin crear Lead).
  - Se modificó `submitWhatsAppPreform()` para que procese **únicamente** la identificación y registro del Lead vía `client.registerLead()`, sin emitir el evento `whatsapp_click`.
- **Motivo:** Mantener el contrato `whatsapp_click ≠ Lead`. El clic representa comportamiento del visitante, mientras que la Registration en el preformulario representa la conversión a contacto identificado.

### 3. Eliminación de PII de Metadata de Eventos

- **Cambio:** Se eliminó el campo `name` y cualquier otro dato personal (`email`, `phone`, `city`, `company`) de los objetos de metadata de los eventos emitidos por el SDK cliente.
- **Form Submit Custom Event:** Emitido como `custom` con `metadata = { event_name: 'form_submit' }`.
- **WhatsApp Click Event:** Emitido con `metadata = {}`.

### 4. Cobertura de Pruebas Adicionales (`tests/lead.test.ts`)

- **Test de Deduplicación por Email Únicamente:** Valida que un nuevo registro con el mismo email pero distinto nombre y sin teléfono no cree un nuevo Lead, sino que actualice el existente preservando `lead_id` y `created_at`.
- **Test de Integridad Session ↔ `anonymous_id`:** Valida que el envío de un `anonymous_id` distinto al de la sesión sea rechazado con un error `Forbidden`.
- **Test de Desvinculación Clic/Preformulario:** Valida que `trackWhatsAppClick` registre el evento sin crear un documento Lead.

## 2026-09-17 16:30 — Módulo 5 — Lead Qualification / Scoring

Se implementó el motor de Lead Qualification y Lead Scoring (`calculateLeadScoreLogic`) para ZWAM 2.0. El desarrollo incluyó la ampliación de los contratos de tipo en `@zwam/types` (`ScoringRule`, `ScoreFlags`, `Lead`), la creación de la lógica de evaluación comercial derivada histórica en `functions/src/leads/scoring.ts`, la exportación de las funciones en `functions/src/index.ts`, la creación de la suite de pruebas unitarias/integración `tests/scoring.test.ts` con 7 nuevos tests (llegando a 52/52 tests en el proyecto) y la verificación completa del sistema mediante `format`, `typecheck`, `lint` y `test`.

### 1. Objetivo de M5

Establecer la capa comercial de evaluación numérica (`LeadScore`) y cualitativa (`LeadQuality`) derivada del comportamiento histórico observado del Lead a través de sus `Sessions` y `Events` asociados mediante `anonymous_id`.

### 2. Modelo de Score y Escala

- **Escala de Score:** Numérica de 0 a 100 (`0` = ausencia de señales; `100` = máxima acumulación de señales).
- **Quality (Derivada):**
  - `'hot'`: Score >= 70 (Acción recomendada: `'immediate_priority'`)
  - `'warm'`: 35 <= Score < 70 (Acción recomendada: `'follow_up'`)
  - `'cold'`: Score < 35 (Acción recomendada: `'nurturing'`)
- **Desglose (`ScoreBreakdown`):**
  - `behavior_score`: Puntos provenientes de `page_view`, `engaged_time`, `multiple_sessions`.
  - `intent_score`: Puntos provenientes de `high_intent`, `package_click`, `form_start`, `whatsapp_click`.
  - `context_score`: Puntos provenientes de `is_paid_traffic`.

### 3. Motor de Reglas Configurables, Pesos y Caps (v1)

- `page_view`: Peso +2, Cap 10 puntos (máx. 5 vistas contabilizadas).
- `engaged_time`: Peso +5, Cap 15 puntos.
- `high_intent`: Peso +20, Cap 40 puntos.
- `package_click`: Peso +15, Cap 30 puntos.
- `form_start`: Peso +10, Cap 20 puntos.
- `whatsapp_click`: Peso +15, Cap 30 puntos.
- `multiple_sessions`: Peso +10, Cap 10 puntos.
- `is_paid_traffic`: Peso +10, Cap 10 puntos.
- **Prevención de Inflación por Repetición:** Las reglas aplican límites por señal (`cap`) garantizando que eventos de baja intención (e.g. 100 `page_view`s) no superen su límite relativo.

### 4. Flags Estructurados (`ScoreFlags`)

- `is_paid_traffic`: Evalúa si alguna sesión histórica provino de tráfico pagado (`source_type === 'paid'`).
- `is_returning_user`: Evalúa si el visitante tiene más de 1 sesión histórica (`sessionCount > 1`).
- `has_high_intent`: Indica si registró al menos un evento `high_intent`.
- `whatsapp_interest`: Indica si registró al menos un evento `whatsapp_click`.
- `package_interest`: Indica si registró al menos un evento `package_click`.
- `multiple_sessions`: Indica recurrencia entre sesiones.

### 5. Fuente Histórica y Determinismo

- **Derivación por Identidad:** Consulta las sesiones históricas en `sessions` vinculadas por `client_id` y `anonymous_id`, y los eventos en `events` asociados a esas sesiones. No agrega arreglos `sessions[]` dentro del documento Lead.
- **Idempotencia:** El cálculo es idéntico y determinista ante la misma historia y versión del algoritmo (`calculation_version = 'v1'`). Recalcular actualiza `last_calculated_at` sin duplicar puntos ni corruptar datos.
- **Aislamiento por Cliente:** Todas las consultas a Firestore (`leads`, `sessions`, `events`) están estrictamente filtradas por `client_id`. Jamás se incorporan datos de otro cliente.

### 6. Archivos Modificados / Creados

- `packages/types/src/enums.ts` (modificado: valores `'hot'` y `'warm'` añadidos a `LeadQuality`).
- `packages/types/src/domain.ts` (modificado: interfaz `ScoringRule`, campos extendidos en `ScoreFlags` y `Lead`).
- `functions/src/leads/scoring.ts` (creado: `calculateLeadScoreLogic` y `DEFAULT_V1_SCORING_RULES`).
- `functions/src/index.ts` (modificado: exportación de `scoring.ts`).
- `tests/scoring.test.ts` (creado: 8 casos de prueba exhaustivos para M5).
- `Reportes/ZWAM_Development_Record.md` (actualizado).

### 7. Pruebas y Resultados

- `npm run format` -> Exitoso.
- `npm run typecheck` -> 0 errores.
- `npm run lint` -> 0 errores / warnings.
- `npm run format:check` -> OK.
- `npm test` -> 5 suites de prueba pasadas, 53/53 tests exitosos.

### 8. Desviaciones y Alcance Estricto

- Sin desviaciones contractuales.
- No se implementaron capas posteriores de `Opportunity`, `Purchase`, `Sale`, `Revenue`, `CRM`, `CAPI` ni `Meta Ads Sync`.

## 2026-09-17 16:45 — Módulo 5 — Corrección de Lead Qualification / Scoring

Se aplicaron las correcciones contractuales obligatorias sobre el Módulo 5 (Lead Qualification / Scoring).

### 1. Modificaciones Realizadas

1. **`engaged_time` como señal de conteo:**
   - `engaged_time` se evalúa strictly como una señal/evento de presencia (+5 puntos por evento, acotado a un cap de 15).
   - No se lee ni exige ninguna metadata de duración, segundos o milisegundos, manteniendo total coherencia con el contrato de eventos de M3.

2. **Detección de Tráfico Pagado (`is_paid_traffic`):**
   - El motor de scoring consume exclusivamente `Session.attribution.source_type === 'paid'` ya resuelto por M3.
   - M5 no procesa ni reinterpreta parámetros RAW (`utm_source`, `utm_medium`, `fbclid`, `gclid`). La atribución permanece acoplada exclusivamente a Session.

3. **Normalización de `LeadQuality`:**
   - Se eliminaron los valores legacy `'priority'`, `'high'`, `'medium'`, `'low'` de `LeadQuality` en `packages/types/src/enums.ts`.
   - El tipo `LeadQuality` queda definido estrictamente como `'hot' | 'warm' | 'cold'`.

4. **Eliminación de `LeadAttribution`:**
   - Se eliminó la interfaz no utilizada `LeadAttribution` en `packages/types/src/domain.ts`.
   - Se reafirma que Lead conserva únicamente `registration_session_id` y `anonymous_id`, y que Session es la única fuente de verdad para atribución.

5. **Pruebas de Corrección (`tests/scoring.test.ts`):**
   - Se reestructuró la suite de pruebas con 7 casos obligatorios comprobando `engaged_time` sin duración, sesiones históricas, `is_paid_traffic` desde atribución pagada, tráfico no pagado, umbrales de `LeadQuality`, aislamiento por `client_id` y recálculo determinista.

### 2. Resultados de las Validaciones

- **`npm run typecheck`**: 0 errores de compilación TypeScript.
- **`npm run lint`**: 0 advertencias / 0 errores de ESLint.
- **`npm run format:check`**: OK (Todos los archivos cumplen con el estilo Prettier).
- **`npm test`**: 5 suites pasadas, 52/52 tests exitosos.

### 3. Estado de M5

- La implementación de las correcciones de M5 ha sido completada y verificada mediante la suite de tests. Pendiente de revisión técnica del cliente.
