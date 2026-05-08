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

## ⛔ REGLA OBLIGATORIA ANTES DE CADA iOS BUILD

> Esta regla existe porque tuvimos 5+ rechazos de Apple evitables.
> El patrón fue siempre el mismo: fix el rechazo sin walkthrough completo.
> **Nunca más.**

Antes de correr `eas-cli build --platform ios`, yo (el CTO) hago los 5 walkthroughs
completos con el código abierto en mano. No en abstracto — línea por línea.

### Los 5 perfiles de Apple reviewer que debo simular:

**Perfil 1 — El Metódico (sigue instrucciones al pie de la letra)**
```
1. Abre app → AuthScreen
2. Escribe "revisor" + "2026" → toca Entrar
3. Verifica: llega al Home demo (no crash, no error)
4. Tab Historial → 5 viajes con fechas y costos (no "undefined")
5. Tab Configuración → nombre "revisor", "Cuenta de demostración"
6. Toca "Ver viajes de ejemplo →" en Home → va a Historial (no logout)
7. Toca "Salir del modo demo" → vuelve al login (esperado)
VALIDAR EN CÓDIGO: auth.js línea 36 (bypass offline), history.js línea 30 (isDemo guard)
```

**Perfil 2 — El Explorador (ignora instrucciones, crea cuenta nueva)**
```
1. Abre app → escribe nombre nuevo + PIN de 4 dígitos → Entrar
2. App muestra campo de email (needsEmail flow)
3. Campo de email recibe foco automáticamente y acepta texto
4. Escribe email → Entrar → cuenta creada → app abre
5. Home para usuario nuevo: budget $0, botón "Iniciar viaje"
6. Historial: estado vacío "Aún no hay viajes"
7. Toca "Iniciar viaje" → permiso de ubicación → concede → viaje inicia
8. Detiene viaje → trip guardado en Supabase (aunque 0 peajes)
VALIDAR EN CÓDIGO: AuthScreen.js emailRef+useEffect, auth.js línea 69-81, index.js Alert import
```

**Perfil 3 — El Veloz (toca demo button, revisa 2-3 pantallas)**
```
1. Abre app → toca "Ver cómo funciona →"
2. Home demo carga (sin Supabase, sin crash)
3. Historial: 5 viajes con timestamps reales (no "undefined", no NaN)
4. Expande un viaje → peajes individuales con nombres y costos
5. Settings demo → avatar con inicial, "Cuenta de demostración"
VALIDAR EN CÓDIGO: demoData.js (timestamps en crossings), history.js línea 154-158 (detailRow)
```

**Perfil 4 — El de Compliance (revisa cada botón y cada link)**
```
1. Privacy link en AuthScreen → abre tag-control.vercel.app/privacy (existe ✓)
2. Privacy link en Home demo → abre privacy (✓)
3. Privacy link en Settings → abre privacy (✓)
4. Niega permiso de ubicación → app muestra Alert (no crash)
   CRÍTICO: Alert debe estar importado en index.js
5. "Eliminar cuenta" (solo en usuario real, no demo) → Alert de confirmación
6. Support URL en App Store → tag-control.vercel.app/support (existe ✓)
VALIDAR EN CÓDIGO: index.js línea 2 (Alert en imports), settings.js (isDemo guard en delete)
```

**Perfil 5 — El de iPad (prueba todo en iPad Air 11")**
```
1. AuthScreen centrado (maxWidth 480) → no full-width en pantalla ancha
2. Flujo needsEmail en iPad: campo email recibe foco, teclado aparece
3. KeyboardAvoidingView no tapa el campo de email
4. Historial en iPad: lista legible
5. Home demo en iPad: botones funcionales
6. Settings en iPad: sin overflow, sin texto cortado
VALIDAR EN CÓDIGO: AuthScreen.js styles.formContainer (maxWidth: 480)
```

### Checklist de código que SIEMPRE verifico antes de buildear:

```sh
# 1. Buscar Alert sin importar
grep -n "Alert\." app/app/\(tabs\)/index.js
grep -n "^import" app/app/\(tabs\)/index.js | grep Alert

# 2. Verificar autoFocus eliminado del email field
grep -n "autoFocus" app/src/components/AuthScreen.js
# → debe estar AUSENTE. El focus es via ref+setTimeout.

# 3. Verificar demo guards
grep -n "isDemo" app/app/\(tabs\)/index.js   # línea ~34 y ~200
grep -n "isDemo" app/app/\(tabs\)/history.js # línea ~30
grep -n "isDemo" app/app/\(tabs\)/settings.js # línea ~18 y ~72

# 4. Verificar que las review notes en ASC coinciden con la UI actual
#    → Ejecutar: node scripts/asc-update-build15.mjs --metadata

# 5. Verificar URLs vivas
curl -s -o /dev/null -w "%{http_code}" https://tag-control.vercel.app/privacy
curl -s -o /dev/null -w "%{http_code}" https://tag-control.vercel.app/support

# 6. Verificar Support URL en ASC apunta a /support (no a raíz)
#    → revisar en App Store Connect o via API
```

### Regla de review notes:

**Cada vez que cambie AuthScreen.js, actualizar review notes ANTES del build:**
```sh
node scripts/asc-update-build15.mjs --metadata
```

Las notes deben describir exactamente la UI actual:
- Cuántos campos tiene el login form (no inventar)
- Cuándo aparece el campo de email (solo en registro nuevo)
- Credenciales exactas: revisor / 2026 / sin email

### Si hay un rechazo:

1. Leer el rechazo textual completo (no el email, el Resolution Center)
2. Hacer los 5 walkthroughs del perfil que activó el rechazo
3. Encontrar la línea exacta de código que causa el problema
4. Verificar que el fix no rompe ninguno de los otros 4 perfiles
5. Actualizar review notes si cambió algo visible en la UI
6. **No submitear hasta que los 5 walkthroughs pasen limpio**
