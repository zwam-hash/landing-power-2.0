# Reporte de la primera fase

## 1. Identificacion

- Producto: BI Control Center / Landing Power
- Fase reportada: Fase 1 de trabajo inicial, correspondiente al Modulo 0 - Preparacion del repositorio y decisiones tecnicas
- Fecha de cierre: 2026-09-08
- Estado: completada
- Alcance: reinicio completo del workspace, creacion de una base limpia, incorporacion del SDK web de Firebase y validacion del toolchain

## 2. Objetivo de la fase

Preparar una base tecnica limpia y verificable para construir el producto por modulos, sin heredar codigo, configuraciones ni decisiones implcitas del proyecto anterior.

La fase dejo preparado el repositorio para continuar con el Modulo 1, que debera cubrir la base de datos, la configuracion completa de Firebase, los emuladores y el primer modelo de datos.

No se implementaron funcionalidades de negocio, autenticacion, membresias, RBAC, ingesta de leads, scoring, CAPI, CRM ni dashboard BI. Esto fue intencional para respetar el desarrollo incremental definido en la especificacion.

## 3. Estado inicial encontrado

Antes del reinicio, el repositorio contenia una implementacion parcial con:

- Dashboard React/Vite en `frontend/dashboard`.
- Backend JavaScript en `backend/functions`.
- Reglas Firestore incompletas.
- Unicamente una funcion `ingestLead`.
- Autenticacion frontend basada en una relacion unica de usuario a cliente.
- Metricas hardcodeadas en la interfaz.
- Sin TypeScript en frontend ni backend.
- Sin suite de pruebas configurada.
- Sin configuracion completa de Hosting, Storage o Emulator Suite.
- Un import roto en `campaignService.js` que impedía el build del dashboard.
- Reglas de seguridad que no implementaban memberships ni permisos granulares.
- Un script de seed que incluia un campo de credencial dentro de Firestore.

Ese codigo fue eliminado para evitar que la nueva implementacion heredara comportamientos o supuestos no documentados.

## 4. Reinicio ejecutado

Se elimino el contenido del proyecto anterior y se conservo `.git` para preservar el historial del repositorio.

Se eliminaron los componentes antiguos, entre ellos:

- `frontend/dashboard` y su aplicacion React/Vite.
- `backend/functions/index.js` y su configuracion anterior.
- El `PROJECT_STATE.md` anterior.
- Las configuraciones y dependencias locales del dashboard anterior.
- La copia antigua de reglas en `docs/firestore.rules`.

Durante la limpieza, Windows mantuvo bloqueados temporalmente algunos archivos nativos dentro de `node_modules`. El contenido de codigo quedo eliminado. El directorio antiguo `frontend` permanece vacio por una retencion del sistema de archivos, pero no forma parte de la nueva arquitectura ni contiene codigo heredado.

No se uso `git reset --hard`, `git checkout` ni ninguna operacion destructiva sobre el historial Git.

## 5. Estructura nueva

La base creada tiene esta estructura:

```text
/
├── apps/
│   └── web/
│       ├── package.json
│       └── src/
│           ├── index.ts
│           └── lib/
│               └── firebase.ts
├── functions/
│   ├── package.json
│   └── src/
│       └── index.ts
├── docs/
│   ├── architecture.md
│   └── decisions/
│       └── 0001-foundation.md
├── tests/
│   └── foundation.test.ts
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── storage.rules
├── .firebaserc
├── .env.example
├── .gitignore
├── eslint.config.js
├── prettier.config.js
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

## 6. Decisiones tecnicas aplicadas

### 6.1 Monorepo

Se establecio un monorepo npm con dos workspaces:

- `apps/web`: futura aplicacion web React/TypeScript.
- `functions`: futuras Firebase Cloud Functions 2nd Gen en TypeScript.

### 6.2 Gestor de paquetes

Se eligio npm y se declaro en el manifiesto raiz:

```json
"packageManager": "npm@11"
```

El lockfile raiz es `package-lock.json`.

### 6.3 TypeScript

Se creo `tsconfig.json` con:

- `target`: ES2022.
- `module`: NodeNext.
- `moduleResolution`: NodeNext.
- `strict`: true.
- `noEmit`: true.
- `skipLibCheck`: true.

Los entrypoints iniciales son TypeScript:

- `apps/web/src/index.ts`
- `functions/src/index.ts`

### 6.4 Calidad de codigo

Se incorporaron:

- ESLint mediante `eslint.config.js`.
- Prettier mediante `prettier.config.js`.
- Scripts raiz para format, lint, typecheck y test.

### 6.5 Pruebas

Se eligio Vitest como runner de pruebas unitarias.

La prueba inicial en `tests/foundation.test.ts` verifica que `client_id` sea el identificador de aislamiento operativo y que no se introduzcan aliases `tenant_id` ni `customer_id`.

### 6.6 Firebase

Se preparo `firebase.json` para:

- Firestore.
- Storage.
- Firebase Hosting.
- Cloud Functions.
- Firebase Emulator Suite.

Puertos de emuladores definidos:

- Auth: `9099`
- Functions: `5001`
- Firestore: `8080`
- Storage: `9199`
- UI: `4000`

El proyecto Firebase se deja como placeholder en `.firebaserc` para no acoplar el repositorio a un proyecto equivocado durante la preparacion.

### 6.7 Seguridad inicial

Las reglas iniciales de Firestore y Storage deniegan todas las operaciones:

```text
allow read, write: if false;
```

Esto es deliberado. Las reglas se abriran de forma minima y verificable en el Modulo 1 y en el Modulo 2, cuando existan el modelo de identidad, memberships y permisos.

### 6.8 Aislamiento de clientes

Se adopto `client_id` como identificador raiz de los datos operativos.

No se introduciran `tenant_id` ni `customer_id` como nombres alternativos para el mismo concepto.

### 6.9 Secretos

Se establecio que los secretos de integraciones deberan vivir en Google Secret Manager. Firestore solo podra conservar referencias y metadatos no sensibles.

El archivo `.env.example` contiene un placeholder para `FIREBASE_PROJECT_ID` y no contiene credenciales reales.

## 7. Integracion del SDK web Firebase

Se incorporo la configuracion publica del proyecto Firebase proporcionada por el usuario en:

`apps/web/src/lib/firebase.ts`

El archivo:

1. Importa `initializeApp` desde `firebase/app`.
2. Define la configuracion web del proyecto `zwam-bi`.
3. Inicializa Firebase.
4. Exporta la instancia como `firebaseApp`.

La dependencia `firebase` se agrego unicamente al workspace `apps/web`.

Los valores incluidos son identificadores publicos del SDK web. No son tokens de Admin ni secretos de integraciones. Todavia no se inicializaron Auth, Firestore ni Storage en el codigo de aplicacion.

## 8. Archivos creados o modificados en la base nueva

### Configuracion raiz

- `package.json`: workspaces y scripts de calidad.
- `package-lock.json`: dependencias bloqueadas.
- `tsconfig.json`: TypeScript estricto.
- `eslint.config.js`: configuracion minima de ESLint.
- `prettier.config.js`: configuracion de formato.
- `.gitignore`: exclusiones de dependencias, builds, emuladores y entornos.
- `.env.example`: variables de entorno documentadas sin secretos.
- `README.md`: estado y decisiones de la fundacion.

### Firebase

- `firebase.json`: Firestore, Storage, Hosting, Functions y emuladores.
- `.firebaserc`: placeholder del proyecto Firebase.
- `firestore.rules`: reglas cerradas por defecto.
- `firestore.indexes.json`: sin indices preventivos.
- `storage.rules`: reglas cerradas por defecto.

### Aplicacion web

- `apps/web/package.json`: workspace web y dependencia Firebase.
- `apps/web/src/index.ts`: entrypoint inicial vacio.
- `apps/web/src/lib/firebase.ts`: inicializacion del SDK web.

### Backend

- `functions/package.json`: workspace de Functions y runtime Node 24.
- `functions/src/index.ts`: entrypoint inicial vacio.

### Documentacion y pruebas

- `docs/architecture.md`: dominios, aislamiento y politica de fuente de verdad.
- `docs/decisions/0001-foundation.md`: decision record de la fundacion.
- `tests/foundation.test.ts`: prueba de la convencion `client_id`.

## 9. Comandos ejecutados y resultados

### Inspeccion inicial

```powershell
Get-ChildItem -Force
Get-ChildItem -Force -Recurse
Get-Content package.json
Get-Content firebase.json
git status --short
git log -5 --oneline --decorate
```

Resultado: se identifico la implementacion parcial anterior, sus riesgos y cambios locales. No se revirtieron cambios mediante comandos destructivos de Git.

### Validacion del proyecto anterior

```powershell
Push-Location frontend/dashboard
npm run build
npm run lint
Pop-Location
```

Resultado:

- Build anterior: fallo por import no resuelto en `campaignService.js`.
- Lint anterior: termino con codigo 0, pero con advertencias de imports, hooks y manejo de errores.

```powershell
Push-Location backend/functions
npm run build
Pop-Location
npm test
```

Resultado:

- El build anterior solo ejecutaba un `echo` y no compilaba.
- No existia script de pruebas en la raiz.

### Instalacion de la base nueva

```powershell
npm install
```

Resultado: dependencias instaladas sin vulnerabilidades reportadas.

### Formato

```powershell
npx prettier --write .
npm run format
```

Resultado: todos los archivos cumplen el formato de Prettier.

### Typecheck

```powershell
npm run typecheck
```

Resultado: correcto, codigo de salida 0.

### Lint

```powershell
npm run lint
```

Resultado: correcto, codigo de salida 0.

### Pruebas

```powershell
npm run test
```

Resultado:

```text
Test Files  1 passed
Tests       1 passed
```

### Firebase CLI

```powershell
firebase --version
```

Resultado: Firebase CLI `15.29.0` disponible.

## 10. Estado actual

La primera fase esta completada desde el punto de vista de estructura, documentacion y toolchain.

Disponible:

- Repositorio limpio de codigo heredado.
- Estructura monorepo.
- TypeScript estricto.
- ESLint, Prettier y Vitest.
- Configuracion Firebase base.
- SDK web Firebase inicializado.
- Reglas cerradas por defecto.
- Una prueba fundacional.
- Validaciones automatizadas pasando.

Todavia no disponible:

- Aplicacion visual React funcional.
- Autenticacion Firebase.
- Firestore operativo.
- Modelo de datos TypeScript.
- Memberships y RBAC.
- Reglas de seguridad con permisos.
- Cloud Functions funcionales.
- Emulator tests.
- Hosting desplegado.
- Integraciones Meta, CRM o CAPI.
- Dashboard BI y drill-down.

## 11. Riesgos y pendientes reales

1. El `.firebaserc` tiene un placeholder y debe apuntar al proyecto Firebase correcto antes de usar CLI o emuladores conectados.
2. Las reglas actuales bloquean todo hasta que se implemente identidad y membresias.
3. El SDK web esta inicializado, pero aun no se han creado los modulos de Auth, Firestore, Storage ni Analytics.
4. La aplicacion web aun no tiene una configuracion completa de React/Vite ni una interfaz.
5. El backend tiene el entrypoint TypeScript, pero todavia no contiene funciones exportadas.
6. Debe confirmarse la version final de Node compatible con las versiones de Firebase Functions que se instalen en el Modulo 1.
7. Deben definirse las consultas reales antes de agregar indices Firestore.
8. Antes de integrar proveedores externos, deben definirse Secret Manager, validacion de webhooks y auditoria.

## 12. Siguiente fase

El siguiente paso es el **Modulo 1 - Data Foundation y configuracion Firebase**.

Su alcance recomendado es:

1. Confirmar el proyecto Firebase objetivo.
2. Configurar dependencias de Firebase Admin y Functions 2nd Gen.
3. Definir el modelo inicial de documentos y tipos TypeScript.
4. Configurar Firebase Emulator Suite de forma ejecutable.
5. Crear las primeras reglas verificables para la fundacion.
6. Agregar pruebas de reglas y persistencia sin datos reales.
7. Documentar las consultas que justifiquen cada indice.

No se deben implementar Auth/RBAC ni funcionalidades de producto hasta cerrar este modulo con typecheck, lint, pruebas y emuladores verificables.
