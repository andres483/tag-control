# TAGcontrol

PWA + App nativa para tracking automatico de peajes en autopistas de Chile.

## Stack
- **PWA (frontend/):** React 19 + Vite + Tailwind 4 + Supabase. Deploy en Vercel.
- **App nativa (app/):** React Native + Expo SDK 54 + expo-location background. Build via EAS.
- **Backend:** Supabase (misma instancia para ambos)
- **Admin:** Web-only en `/admin` (no va en la app nativa)

## Proyecto
- **PWA:** `cd frontend && npm run build` — deploy con `git push` (Vercel auto-deploy)
- **App nativa:** `cd app && npx eas-cli build --platform android --profile preview`
- **Expo project:** @andrespanthervillagran/tagcontrol (ID: adeffd89-13d6-43fa-8516-36bfa26fd206)

## Archivos clave

### Shared logic (identica en frontend/ y app/)
- `data/tolls.json` — 80+ peajes con coordenadas
- `lib/pricing.js` — Tarifas por horario (semana/punta/saturacion)
- `lib/inference.js` — Inferencia de peajes faltantes (tuneles, gaps)
- `lib/geoUtils.js` — Haversine distance, m/s a km/h
- `lib/format.js` — Formato CLP, fecha, hora

### PWA (frontend/src/)
- `hooks/useGPS.js` — GPS watchdog, deteccion de peajes por proximidad
- `lib/liveTracking.js` — Supabase: upsert posicion, crossings, cleanup
- `lib/sound.js` — Alerta de peaje + audio keep-alive para background iOS
- `lib/backgroundService.js` — Service Worker + notificaciones para Android
- `lib/reconstruction.js` — Reconstruccion retroactiva desde posiciones GPS
- `pages/Home.jsx` — UI principal, ciclo de viaje
- `pages/History.jsx` — Historial de viajes
- `pages/Admin.jsx` — Dashboard admin (user: Andres, PIN: 2026)

### App nativa (app/src/)
- `lib/locationService.js` — GPS BACKGROUND REAL (expo-location + TaskManager)
- `lib/liveTracking.js` — Supabase sync (con campo platform: ios/android)
- `lib/auth.js` — Login PIN + email + SecureStore
- `components/AuthScreen.js` — Login con nombre + email + PIN

### App screens (app/app/)
- `_layout.js` — Root: auth + user context
- `(tabs)/index.js` — Home: iniciar/detener viaje, deteccion
- `(tabs)/history.js` — Historial de viajes

## Supabase
- **Ref:** nttnryildsxllxqfkkvz
- **Tablas:** `trips`, `live_trips`, `live_crossings`, `positions` (cache 24h), `users`, `budgets`
- **Columnas nuevas:** `platform` (text) en trips y live_trips — ios/android/web
- **Auth:** PIN-based (name + 4 digitos + email)

## Deteccion de peajes
1. GPS `enableHighAccuracy: true` (PWA) / `BestForNavigation` (nativo)
2. Haversine distance < radio deteccion (150-400m segun peaje)
3. Speed >= 15 km/h + cooldown 120s entre mismo peaje
4. Inferencia automatica para gaps en tuneles
5. **App nativa:** GPS real en background via expo-location TaskManager
6. **PWA:** Audio keep-alive iOS + Service Worker Android (limitado)
7. Reconstruccion post-viaje desde posiciones GPS guardadas
8. Auto-cierre de viaje si detenido 30 min (speed < 5 km/h)

## Coordenadas
Verificadas con GPS real de usuarios. Si hay que agregar o corregir peajes, usar datos GPS reales como ground truth (OSM no es confiable para tuneles).

### Recalibración de radios
Cuando un peaje tiene ≥3 pasadas de distintos viajes, correr `scripts/correct-toll-coords.mjs` para proponer nuevas coords (mediana del foot-of-perpendicular). Una sola pasada no justifica mover coords (sesgo de muestra); en ese caso solo subir `radio_deteccion_m` a 450m como stopgap.

## Shared logic PWA↔nativa
`tolls.json`, `geoUtils.js`, `pricing.js`, `inference.js`, `format.js` están duplicados en `frontend/src/` y `app/src/` (Metro no resuelve imports fuera de `app/`). `frontend/` es canonical. Correr `node scripts/check-shared-drift.mjs` antes de commitear cambios en estos archivos (o `--fix` para sincronizar).
