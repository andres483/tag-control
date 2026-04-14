# TAGcontrol

PWA para tracking automático de peajes en autopistas de Chile.

## Stack
React 19 + Vite + Tailwind 4 + Supabase + Google Maps API. Deploy en Vercel.

## Proyecto
- **Dir frontend:** `frontend/`
- **Build:** `cd frontend && npm run build`
- **Deploy:** `git push` (Vercel auto-deploy desde main)

## Archivos clave
- `frontend/src/hooks/useGPS.js` — GPS watchdog, detección de peajes por proximidad
- `frontend/src/lib/inference.js` — Inferencia de peajes faltantes (túneles sin GPS)
- `frontend/src/data/tolls.json` — 80+ peajes con coordenadas (verificadas con OpenStreetMap)
- `frontend/src/lib/liveTracking.js` — Supabase: upsert posición, crossings, cleanup
- `frontend/src/lib/sound.js` — Alerta de peaje + audio keep-alive para background
- `frontend/src/lib/pricing.js` — Tarifas por horario (semana/punta/saturación)
- `frontend/src/pages/Home.jsx` — UI principal, ciclo de viaje, auto-cierre 15min
- `frontend/src/pages/History.jsx` — Historial de viajes (local + cloud)
- `frontend/src/pages/Admin.jsx` — Dashboard admin (user: Andres, PIN: 2026)

## Supabase
- **Ref:** nttnryildsxllxqfkkvz
- **Tablas:** `trips`, `live_trips`, `live_crossings`, `positions` (caché 24h), `users`, `budgets`
- **Auth:** PIN-based (name + 4 dígitos)

## Detección de peajes
1. GPS `enableHighAccuracy: true`, throttle 3s
2. Haversine distance < radio detección (150-400m según peaje)
3. Speed >= 20 km/h + cooldown 120s entre mismo peaje
4. Inferencia automática para gaps en túneles (zona sin GPS)
5. Background audio keep-alive para iOS (20Hz inaudible)
6. Auto-cierre de viaje si detenido 15 min (speed < 5 km/h)

## Coordenadas
Verificadas con OpenStreetMap Overpass API (`highway=toll_gantry`). Si hay que agregar o corregir peajes, usar OSM como fuente de verdad.
