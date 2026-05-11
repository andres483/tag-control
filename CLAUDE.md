# TAGcontrol

PWA + app nativa para tracking automático de peajes en autopistas de Chile.
Detecta cruces GPS en tiempo real, calcula tarifas, y lleva historial por conductor.

## Protocolo de inicio de sesión

Hacer esto en orden al abrir cada conversación:

1. Leer `MEMORY.md` y archivos de memoria relevantes
2. `git log --oneline -10` + `git status` — entender estado del repo
3. Leer `ROADMAP.md` — qué está construido, qué está en progreso, qué sigue
4. `node scripts/cto-review.mjs --quick` — ¿cuántos commits desde el último audit?
5. Si hay algo submitteado a Apple: verificar estado del build en EAS
6. Tomar la iniciativa: proponer qué construir o qué auditar sin esperar que el usuario lo pida

**El CTO hace las preguntas. No espera que se las hagan.**
**Nunca contradecir decisiones de sesiones anteriores sin confirmación explícita.**
**Antes de dar credenciales, URLs, o datos fijos — buscar en memoria primero.**

## Sistema de mejora continua — CTO Review

El script `scripts/cto-review.mjs` es el sistema automático de audit. Lo corro yo, no el usuario.

```sh
node scripts/cto-review.mjs              # auto: decide qué roles correr según commits
node scripts/cto-review.mjs --full       # forza audit completo (5 roles)
node scripts/cto-review.mjs --quick      # solo drift check, sin API
node scripts/cto-review.mjs --mark       # marca HEAD como auditado (post-fix manual)
```

**Umbrales automáticos:**
- **0-3 commits**: solo drift check, sin llamadas API
- **4-9 commits**: audit enfocado (tech obligatorio + ux si hay UI, product si hay backend)
- **10+ commits** o `--full`: audit completo (tech + ux + product + growth + ceo)

**El audit completo (`multi-perspective-audit.mjs`) para auditorías ad-hoc profundas:**
```sh
node scripts/multi-perspective-audit.mjs              # 5 perspectivas simultáneas
node scripts/multi-perspective-audit.mjs --focus=tech # solo una perspectiva
node scripts/multi-perspective-audit.mjs --format=whatsapp
```

Los hallazgos críticos van al ROADMAP.md. Los bugs encontrados se fijan en la misma sesión.

## Stack
- **PWA (`frontend/`):** React 19 + Vite + Tailwind 4 + Supabase. Deploy en Vercel.
- **App nativa (`app/`):** React Native + Expo SDK 54 + expo-location background. Build via EAS.
- **Backend:** Supabase (misma instancia para ambos clientes)
- **Admin:** Web-only en `/admin` — dashboard operacional, no va en la app nativa

## Comandos rápidos

```sh
# PWA
cd frontend && npm run dev          # dev server
cd frontend && npm run build        # build → deploy automático con git push (Vercel)

# App nativa
cd app && npx expo start            # dev con Expo Go
cd app && npx eas-cli build --platform android --profile preview  # APK de distribución

# Scripts de mantenimiento
node scripts/check-shared-drift.mjs         # verifica que frontend/ y app/ estén sincronizados
node scripts/check-shared-drift.mjs --fix   # sincroniza app/ desde frontend/ (canonical)
node scripts/code-review-agent.mjs --staged --strict  # code review antes de commitear
node scripts/analytics-agent.mjs --days=7 --format=whatsapp  # resumen semanal
node scripts/gps-calibration-agent.mjs --days=7  # propone calibraciones de peajes
node scripts/gps-calibration-agent.mjs --apply --pr  # aplica + crea PR en GitHub
node scripts/release-agent.mjs              # build Android + genera link de descarga
```

## Archivos clave

### Shared logic (idéntica en `frontend/src/` y `app/src/`)
> Metro (React Native) no resuelve imports fuera de `app/`, por eso están duplicados.
> `frontend/` es **canonical**. Siempre editar ahí y sincronizar con `--fix`.

| Archivo | Descripción |
|---|---|
| `data/tolls.json` | 80+ peajes con coordenadas GPS, radio de detección, tarifas |
| `lib/pricing.js` | Tarifas por horario (semana / punta / saturación) |
| `lib/inference.js` | Inferencia de peajes faltantes (túneles, gaps GPS) |
| `lib/geoUtils.js` | Haversine, foot-of-perpendicular, conversión de velocidades |
| `lib/format.js` | Formato CLP, fecha, hora (locale es-CL) |

### PWA (`frontend/src/`)
| Archivo | Descripción |
|---|---|
| `hooks/useGPS.js` | GPS watchdog, detección segment-based por proximidad |
| `hooks/useTrip.js` | Ciclo completo de un viaje: inicio, detección, cierre |
| `lib/liveTracking.js` | Supabase: upsert posición, crossings, cleanup, retry 3x |
| `lib/sound.js` | Alerta de peaje + audio keep-alive para background iOS |
| `lib/backgroundService.js` | Service Worker + notificaciones para Android |
| `lib/reconstruction.js` | Reconstrucción retroactiva desde posiciones GPS (24h cache) |
| `lib/qaAgent.js` | QA Agent: detecta anomalías en tiempo real (viajes 0 peajes, etc.) |
| `pages/Home.jsx` | UI principal, ciclo de viaje |
| `pages/History.jsx` | Historial de viajes con filtros |
| `pages/Admin.jsx` | Dashboard admin (PIN: 2026) — tabs: Live, DB, Arquitectura |
| `pages/admin/AdminData.jsx` | Tab DB: QA findings, viajes en riesgo, tabla de cruces |
| `pages/admin/AdminArchitecture.jsx` | Tab Arquitectura: sistema + 5 agents con estado |

### App nativa (`app/src/`)
| Archivo | Descripción |
|---|---|
| `lib/locationService.js` | GPS BACKGROUND REAL (expo-location TaskManager) + notificaciones push |
| `lib/liveTracking.js` | Supabase sync con retry + position queue offline |
| `lib/auth.js` | Login PIN + email + SecureStore (SHA-256 hash) |
| `components/AuthScreen.js` | Pantalla de login |

### App screens (`app/app/`)
| Archivo | Descripción |
|---|---|
| `_layout.js` | Root: auth + user context |
| `(tabs)/index.js` | Home: iniciar/detener viaje, detección en vivo |
| `(tabs)/history.js` | Historial de viajes con pull-to-refresh + paginación |
| `(tabs)/settings.js` | Perfil, límite mensual (budgets), logout |

## Supabase
- **Ref:** `nttnryildsxllxqfkkvz`
- **Tablas:** `trips`, `live_trips`, `live_crossings`, `positions` (cache 24h), `users`, `budgets`
- **Auth:** PIN-based — name + 4 dígitos + email. Hash SHA-256 via `crypto.subtle` (compatible Hermes/Expo SDK 54)
- **Credenciales:** anon key pública en los scripts. SERVICE_ROLE_KEY nunca en cliente.

## Detección de peajes

Pipeline (por orden de aplicación):

1. **GPS** — `BestForNavigation` (nativa) / `enableHighAccuracy` (PWA)
2. **Segment-based** — distancia al segmento A→B, no solo al punto GPS
3. **Speed + cooldown** — ≥15 km/h · 120s cooldown por peaje · `radio_deteccion_m` por peaje (150–400m)
4. **Inferencia real-time** — `inferMissingTolls()` detecta gaps en `ROUTE_SEQUENCES` durante el viaje
5. **Post-trip inference** — `inferPostTrip()` con timestamps via haversine / 90 km/h
6. **Reconstrucción GPS** — `reconstructFromPositions()` usa cache de posiciones (24h)
7. **Persistencia** — `trips` INSERT siempre (0 peajes incluidos) + retry 3x con backoff

## Coordenadas de peajes

Verificadas con GPS real de conductores. **No usar OSM** como fuente de verdad — es poco confiable en túneles.

Para recalibrar: `node scripts/gps-calibration-agent.mjs --days=7` — requiere ≥3 pasadas por peaje.
Shifts >200m se marcan como sospechosos (posible ruido GPS o túnel) y no se aplican automáticamente.

## Agent Layer

Cinco agents operacionales en `scripts/`:

| Agent | Archivo | Trigger | Output |
|---|---|---|---|
| QA Agent | `lib/qaAgent.js` | Cada carga de Admin | Alertas en tab DB |
| GPS Calibration | `gps-calibration-agent.mjs` | Manual / periódico | PR con tolls.json actualizado |
| Code Review | `code-review-agent.mjs` | Pre-commit / manual | Exit 1 si errores críticos |
| Release | `release-agent.mjs` | Manual / merge a main | APK + mensaje WhatsApp |
| Analytics | `analytics-agent.mjs` | Manual / cron 08:00 | Resumen ejecutivo + WhatsApp |

## Convenciones de scripts

- Read-only por default; escritura requiere `--apply`, `--fix`, o `--commit`
- Credenciales desde código (anon key solo) — no service role en scripts
- Nuevos one-offs: nombrar por incidente (`fix-X-trip.mjs`) para saber cuándo eliminarlos
- Ver `scripts/README.md` para documentación completa

## Build & Deploy

| Canal | Cómo |
|---|---|
| PWA | `git push` → Vercel auto-deploy |
| Android APK | `node scripts/release-agent.mjs` o EAS directo |
| iOS | EAS build production → `node scripts/asc-update-build15.mjs --submit` |
| Expo org | `@andrespanthervillagran/tagcontrol` (ID: `adeffd89-13d6-43fa-8516-36bfa26fd206`) |

---

## ⛔ PROTOCOLO iOS — DOCUMENTACIÓN PRIMERO, NUNCA REACTIVO

> **Por qué existe esto:** tuvimos 8 rechazos de Apple, todos evitables.
> El patrón: arreglábamos el rechazo sin leer la regla completa que lo causó.
> Este protocolo es **proactivo** — deriva de la documentación oficial de Apple,
> no de nuestros errores pasados.
>
> **Regla de oro:** Si no puedo citar la guideline de Apple que valida cada
> elemento del build, ese elemento no está validado.

---

### PARTE 1 — COMPLIANCE MATRIX (fuente: App Review Guidelines + HIG)

Antes de cada build, verifico que cada fila esté en estado PASS. Una fila en FAIL = no buildear.

#### 1.x — Safety & Information

| Guideline | Riesgo | Requisito | Check |
|---|---|---|---|
| **1.5** | CRÍTICO | Support URL debe tener forma visible de contactar al developer (email o form). No puede ser una landing page vacía. | `curl https://tag-control.vercel.app/support` — debe mostrar email visible |
| **1.5** | CRÍTICO | Privacy Policy URL debe ser funcional, accesible sin login, y cubrir los 6 ítems requeridos | `curl https://tag-control.vercel.app/privacy` — debe existir y tener contenido real |

#### 2.1 — App Completeness

| Guideline | Riesgo | Requisito | Check |
|---|---|---|---|
| **2.1(a)** | CRÍTICO | Demo account / demo mode debe funcionar 100% offline. El reviewer no debe depender de internet para ver la app. | `grep -n "revisor" app/src/lib/auth.js` — bypass en línea ~36 |
| **2.1(a)** | CRÍTICO | Review notes deben describir con EXACTITUD cada campo visible en AuthScreen. Si cambió un campo → actualizar notes antes del build. | `node scripts/asc-update-build15.mjs --metadata` |
| **2.1(a)** | ALTO | Notes deben explicar paso a paso cómo acceder a CADA feature del app, incluyendo background location. El reviewer no adivina. | Ver template de Notes al final de este archivo |
| **2.1(b)** | ALTO | Si el modelo de negocio no es obvio, explicarlo en Notes. "Gratis" no es suficiente — explicar cómo funciona el negocio. | Incluir sección "BUSINESS MODEL" en Notes |

#### 2.3 — Accurate Metadata

| Guideline | Riesgo | Requisito | Check |
|---|---|---|---|
| **2.3.3** | CRÍTICO | Screenshots deben mostrar la APP EN USO — con datos visibles, features activas. NO: login screen, splash, empty state, "Cargando…". La mayoría de screenshots deben mostrar features principales. | Abrir ASC → ver cada screenshot. ¿Muestra la app funcionando? |
| **2.3.10** | CRÍTICO | Screenshots deben usar status bar de iOS real o ninguna. Status bar generada manualmente (Python, Figma, etc.) = rechazo. | Usar screenshots del Simulator iOS o generados SIN status bar. Nunca dibujar "9:41" manualmente. |
| **2.3.10** | ALTO | Screenshots deben corresponder al dispositivo declarado. Si se suben para iPad Pro 12.9", deben verse como iPad, no como iPhone escalado. | Verificar dimensiones: iPhone 6.5"=1242x2688, iPad 12.9"=2048x2732, iPad 11"=1668x2388 |
| **2.3.7** | BAJO | App name ≤ 30 caracteres | `echo -n "TAGcontrol" \| wc -c` |

#### 2.5 — Software Requirements

| Guideline | Riesgo | Requisito | Check |
|---|---|---|---|
| **2.5.4** | CRÍTICO | Cada valor en UIBackgroundModes debe tener una feature DEMOSTRABLE en la app. El reviewer debe poder encontrarla con las instrucciones de Notes. | Incluir pasos exactos en Notes: cómo llegar al "Iniciar viaje" con cuenta real |
| **2.5.4** | ALTO | Background location debe detenerse cuando la feature ya no está activa. No puede correr indefinidamente. | Verificar `stopTracking()` en locationService.js desregistra el TaskManager task |
| **2.5.2** | MED | Apps no pueden ejecutar código descargado en runtime (OTA JS updates en review build). | Confirmar que `eas.json` perfil production no tiene `channel` de OTA activo para review |

#### 3.x — Business

| Guideline | Riesgo | Requisito | Check |
|---|---|---|---|
| **3.1.1** | CRÍTICO | Cualquier compra dentro del app debe usar IAP. Si el app es gratis y sin compras, declararlo explícitamente en Notes. | `grep -rn "StoreKit\|purchase\|IAP" app/` — debe ser cero resultados |
| **3.2.2** | BAJO | No forzar ratings/reviews. No redirigir a otra app. | `grep -rn "requestReview\|StoreReview" app/` — debe ser cero |

#### 5.x — Privacy & Legal

| Guideline | Riesgo | Requisito | Check |
|---|---|---|---|
| **5.1.1(i)** | CRÍTICO | Privacy policy accesible DENTRO del app en lugar fácil de encontrar. No puede estar escondida. | `grep -rn "vercel.app/privacy" app/app/ app/src/` — debe aparecer en AuthScreen, Home demo, Settings |
| **5.1.1(i)** | CRÍTICO | Privacy policy debe cubrir: (1) qué datos se colectan, (2) cómo, (3) todos los usos, (4) third parties (Supabase), (5) retención/eliminación, (6) cómo revocar. | Leer `tag-control.vercel.app/privacy` y verificar los 6 ítems explícitamente |
| **5.1.1(ii)** | ALTO | Permission strings (NSLocation*) deben ser específicas: QUÉ datos, CUÁNDO se activan, POR QUÉ. Strings genéricas ("para mejorar tu experiencia") = rechazo. | `grep "NSLocation" app/app.json` — texto debe mencionar "peajes", "viaje activo", "se detiene" |
| **5.1.1(iv)** | ALTO | Si usuario niega permiso de ubicación → app no puede crashear ni mostrar blank screen. Debe mostrar mensaje explicativo. | `grep -n "Alert" app/app/\(tabs\)/index.js` — Alert importado y usado en caso de denegación |
| **5.1.5** | ALTO | Location services solo cuando directamente relevante. No pedir permiso al launch — solo cuando el usuario activa la feature. | Verificar que `requestLocationPermissions()` se llama DENTRO de `handleStartTrip()`, no en `useEffect` de mount |
| **5.1.2** | MED | No compartir datos de ubicación con third parties sin consentimiento explícito. Supabase cuenta como third party. | Verificar privacy policy menciona Supabase como procesador de datos |

---

### PARTE 2 — CHECKLIST PRE-BUILD (correr en orden, sin saltarse pasos)

```sh
# ══════════════════════════════════════════════════════════
# STEP 1: CÓDIGO
# ══════════════════════════════════════════════════════════

# Alert importado en index.js (crash si deniegan ubicación)
grep "^import" app/app/\(tabs\)/index.js | grep Alert

# autoFocus AUSENTE en email field (falla en iOS 26)
grep -n "autoFocus" app/src/components/AuthScreen.js
# → debe no aparecer nada

# isDemo guards en los 3 tabs
grep -n "isDemo" app/app/\(tabs\)/index.js
grep -n "isDemo" app/app/\(tabs\)/history.js
grep -n "isDemo" app/app/\(tabs\)/settings.js

# Demo bypass offline en auth.js
grep -n "revisor" app/src/lib/auth.js

# Permiso de ubicación pedido DENTRO de handleStartTrip, no al mount
grep -n "requestLocationPermissions\|requestForegroundPermissions\|requestBackgroundPermissions" app/app/\(tabs\)/index.js
# → debe estar dentro de la función handleStartTrip, no en useEffect vacío

# stopTracking desregistra TaskManager
grep -n "TaskManager\|stopLocationUpdatesAsync\|unregisterTaskAsync" app/src/lib/locationService.js

# Sin IAP, sin analytics third-party
grep -rn "StoreKit\|requestReview\|firebase\|amplitude\|mixpanel" app/ --include="*.js" --include="*.json" -i
# → debe ser cero resultados

# NSLocation permission strings presentes y específicas
grep "NSLocation" app/app.json

# UIBackgroundModes solo "location"
grep "UIBackgroundModes" app/app.json

# Privacy links en los 3 lugares correctos
grep -rn "vercel.app/privacy" app/app/ app/src/

# ══════════════════════════════════════════════════════════
# STEP 2: INFRAESTRUCTURA (URLs vivas en producción)
# ══════════════════════════════════════════════════════════

# SIEMPRE hacer push antes de verificar — si hay commits sin push, Vercel tiene versión vieja
git status  # → "nothing to commit" O hacer push primero

curl -s -o /dev/null -w "privacy: %{http_code}\n" https://tag-control.vercel.app/privacy
curl -s -o /dev/null -w "support: %{http_code}\n" https://tag-control.vercel.app/support
# → ambas deben ser 200

# Verificar manualmente que /support tiene email visible (abrir en browser)
open https://tag-control.vercel.app/support

# ══════════════════════════════════════════════════════════
# STEP 3: ASC METADATA
# ══════════════════════════════════════════════════════════

# Actualizar review notes (SIEMPRE antes del build, no después)
node scripts/asc-update-build15.mjs --metadata

# Verificar estado del metadata en ASC
node scripts/asc-upload-screenshots.mjs --check

# ══════════════════════════════════════════════════════════
# STEP 4: SCREENSHOTS (reglas críticas)
# ══════════════════════════════════════════════════════════
# - NO dibujar status bar manualmente (causa rechazo 2.3.10)
# - NO mostrar login screen como screenshot principal
# - SÍ mostrar app en uso: trip activo, historial con datos, settings con perfil
# - Dimensiones exactas:
#   iPhone 6.5": 1242x2688 | iPad Pro 12.9": 2048x2732 | iPad Pro 11": 1668x2388
# - Las 3 familias de dispositivos DEBEN tener screenshots si supportsTablet: true
# - Generar: python3 scripts/generate-screenshots.py (sin status bar)
# - Subir: node scripts/asc-upload-screenshots.mjs --upload

# ══════════════════════════════════════════════════════════
# STEP 5: LOS 7 WALKTHROUGHS (ver Parte 3 abajo)
# ══════════════════════════════════════════════════════════
# No buildear hasta que los 7 pasen limpio
```

---

### PARTE 3 — LOS 7 PERFILES DE APPLE REVIEWER

Simulo cada perfil con el código abierto. No en abstracto — verifico la línea exacta.

**Perfil 1 — El Metódico (sigue instrucciones al pie de la letra)**
```
1. Abre app → AuthScreen
2. Escribe "revisor" + "2026" → toca Entrar
3. Verifica: llega al Home demo (no crash, no error)
4. Tab Historial → 5 viajes con fechas y costos (no "undefined")
5. Tab Configuración → nombre "revisor", "Cuenta de demostración"
6. Toca "Ver viajes de ejemplo →" en Home → va a Historial (no logout)
7. Toca "Salir del modo demo" → vuelve al login (esperado)
VALIDAR: auth.js ~línea 36 (bypass offline) | history.js isDemo guard
```

**Perfil 2 — El Explorador (ignora instrucciones, crea cuenta nueva)**
```
1. Escribe nombre nuevo + PIN de 4 dígitos → Entrar
2. App muestra campo de email (needsEmail flow) — campo recibe foco
3. Escribe email → Entrar → cuenta creada → app abre
4. Home real: botón "Iniciar viaje" visible (no demo mode)
5. Historial: "Aún no hay viajes" (estado vacío OK)
6. Toca "Iniciar viaje" → permiso de ubicación → concede → viaje inicia
7. Detiene viaje → trip guardado (aunque 0 peajes)
VALIDAR: AuthScreen.js emailRef+useEffect | index.js Alert import | auth.js needsEmail flow
```

**Perfil 3 — El Veloz (demo button, 2-3 pantallas)**
```
1. Abre app → toca "Ver cómo funciona →"
2. Home demo carga (sin Supabase, sin crash)
3. Historial: 5 viajes con timestamps reales (no "undefined", no NaN)
4. Expande un viaje → peajes con nombres y costos
5. Settings demo → avatar "R", "Cuenta de demostración"
VALIDAR: demoData.js timestamps en crossings | history.js detailRow
```

**Perfil 4 — El de Compliance (lee cada link y cada botón)**
```
1. Privacy link en AuthScreen → abre /privacy (funciona)
2. Privacy link en Home demo → abre /privacy (funciona)
3. Privacy link en Settings → abre /privacy (funciona)
4. Support URL en App Store → /support (funciona, tiene email visible)
5. Niega permiso de ubicación → Alert explicativo, no crash
6. "Eliminar cuenta" → Alert de confirmación (solo en usuario real, no demo)
VALIDAR: index.js Alert import | settings.js isDemo guard en delete | URLs vivas
```

**Perfil 5 — El de iPad (iPad Air 11" M3, todo en portrait)**
```
1. AuthScreen centrado (maxWidth 480) — no full-width
2. needsEmail en iPad: campo email recibe foco, teclado aparece
3. KeyboardAvoidingView no tapa el email field
4. Historial en iPad: lista legible, no overflow
5. Settings en iPad: sin texto cortado
6. Demo mode en iPad: botones funcionales
VALIDAR: AuthScreen.js styles.formContainer maxWidth: 480
```

**Perfil 6 — El de Monetización (¿cómo hace dinero esta app?)**
```
1. Lee la descripción en App Store → ¿queda claro que es gratis?
2. Abre la app → ¿hay algún botón que sugiera pago, upgrade, o suscripción?
3. Lee Settings → ¿hay algún plan premium, trial, o paywall?
4. Review notes → ¿explican el modelo de negocio explícitamente?
5. ¿Hay algún link externo a un sitio de ventas?
VALIDAR: Descripción en ASC | Buscar "suscripción/plan/upgrade" en código | Notes tienen sección BUSINESS MODEL
FALLA SI: Hay cualquier texto que sugiera que features actuales serán de pago
```

**Perfil 7 — El de Infraestructura (¿todo lo que promete la app existe?)**
```
1. Abre /support → ¿carga? ¿tiene email o form de contacto visible?
2. Abre /privacy → ¿carga? ¿cubre los 6 ítems requeridos por Apple?
3. Support URL en ASC apunta a /support (no a la raíz)
4. Todos los Linking.openURL en el código → ¿abren páginas que existen?
5. git status → ¿todos los cambios están pusheados? Vercel sirve lo que está en origin/main.
6. Screenshots en ASC → ¿coinciden con la UI del build actual? (campo por campo)
VALIDAR:
  curl https://tag-control.vercel.app/support → 200 + email visible
  curl https://tag-control.vercel.app/privacy → 200 + contenido real
  git log origin/main..HEAD → debe estar vacío (nada sin pushear)
  node scripts/asc-upload-screenshots.mjs --check → metadata correcto
FALLA SI: Hay un commit sin pushear que afecta una URL o feature visible al reviewer
```

---

### PARTE 4 — TEMPLATE DE REVIEW NOTES (usar siempre, actualizar si cambia la UI)

```
TAGcontrol automatically detects Chilean highway tolls via GPS during active trips.

━━━ DEMO MODE (no account needed) ━━━
Tap "Ver cómo funciona →" on the login screen.
Shows 5 pre-loaded trips with real Chilean toll names and CLP costs.
Works 100% offline — no network, no Supabase.

━━━ REVIEWER ACCOUNT (offline, no network) ━━━
Name: revisor  |  PIN: 2026  |  Email: leave blank — tap "Entrar" directly
Works 100% offline. Shows same 5 demo trips as demo mode.

━━━ EMAIL FIELD — only for new accounts ━━━
The email field appears ONLY when a brand-new user registers:
  1. Enter a new name + any 4-digit PIN → tap "Entrar"
  2. App detects new user → asks for email (one field appears)
  3. Enter any email (e.g. test@apple.com) → tap "Entrar" → account created
With revisor/2026 the email field does NOT appear — login is immediate.

━━━ BACKGROUND LOCATION — how to test ━━━
The demo account is read-only (no GPS needed). To test live location:
  1. Tap "Salir del modo demo" in the Settings tab
  2. Enter any new name + 4-digit PIN + email → tap "Entrar"
  3. On the Home screen, tap "Iniciar viaje"
  4. Grant location permission when asked
  5. Background GPS activates — only for the duration of the active trip
  6. Tap "Detener viaje" to stop — GPS stops immediately
UIBackgroundModes: ["location"] is used EXCLUSIVELY while a trip is active.

━━━ BUSINESS MODEL ━━━
TAGcontrol is completely free. No IAP, no subscriptions, no paid content.
All features are available to all users at no cost.
Account creation is free (name + PIN + optional email). No payment required.

━━━ ACCOUNT DELETION ━━━
Settings tab → "Eliminar cuenta" → deletes all trips, crossings, GPS positions, user row.
Available only to real accounts (not demo).

━━━ PRIVACY & SUPPORT ━━━
Privacy Policy: https://tag-control.vercel.app/privacy
Support:        https://tag-control.vercel.app/support
```

---

### PARTE 5 — REGLAS DE SCREENSHOTS (basadas en HIG + Guideline 2.3)

**Lo que DEBE aparecer en los screenshots:**
- App en uso activo: viaje en curso, historial con datos reales, perfil con nombre
- Datos ficticios pero realistas (trips con nombres de peajes, costos en CLP)
- Al menos 1 screenshot mostrando la feature principal (detección de peaje o historial)

**Lo que NUNCA debe aparecer:**
- Pantalla de login / AuthScreen (Guideline 2.3.3)
- Estado vacío ("Aún no hay viajes", "Cargando…")
- Status bar dibujada manualmente con Python/Figma (Guideline 2.3.10) — usar screenshots del Simulator o sin status bar
- Datos de personas reales (nombres, emails, ubicaciones)

**Dimensiones requeridas (si supportsTablet: true → las 3 familias son obligatorias):**
- iPhone 6.5": 1242 × 2688 px
- iPad Pro 12.9" (3ra gen): 2048 × 2732 px
- iPad Pro 11" (3ra gen): 1668 × 2388 px

**Regla de sincronización:** Si cambió alguna pantalla en el código → los screenshots en ASC deben actualizarse antes del build. El Perfil 7 verifica esto campo por campo.

---

### PARTE 6 — SI HAY UN RECHAZO (protocolo de respuesta)

1. Leer el rechazo COMPLETO en ASC Resolution Center (no el email — tiene menos detalle)
2. Identificar la guideline exacta → ir a `developer.apple.com/app-store/review/guidelines/` y leer la sección completa
3. Mapear el rechazo a una fila de la Compliance Matrix → marcarla como FAIL
4. Fix el código/metadata — verificar con grep/curl que el fix realmente resuelve la fila
5. Correr los 7 walkthroughs — el perfil que activó el rechazo primero, luego todos
6. Si Apple pide respuesta textual (2.1b, 2.5.4) → responder en Resolution Center ANTES de re-submitear
7. **No submitear hasta que la Compliance Matrix esté completa en PASS**
