# scripts/

Operational scripts for TAGcontrol. All run with plain Node (ESM, no build step).

## `check-shared-drift.mjs`
Verifies that files duplicated between `frontend/` (PWA) and `app/` (React Native) stay identical. `frontend/` is the canonical source.

```sh
node scripts/check-shared-drift.mjs         # check (exits 1 on drift)
node scripts/check-shared-drift.mjs --fix   # copy frontend → app
```

Run before commits that touch `tolls.json`, `geoUtils.js`, `pricing.js`, `inference.js`, or `format.js`.

## `audit-francisco-tolls.mjs`
One-off: audits all tolls vs a given driver's GPS trajectory. Prints closest-approach distance per toll and flags which would NOT have been detected with current radii. Hardcoded to Francisco's Android trip — edit `TRIP` constant for other users.

Use when a user reports missed tolls. Needs positions still in the 24h cache.

## `gps-calibration-agent.mjs` ⭐
**GPS Calibration Agent** — analiza todos los viajes recientes con posiciones GPS y propone calibraciones para `tolls.json` (coordenadas y/o radio de detección).

```sh
node scripts/gps-calibration-agent.mjs              # dry run, solo reporte
node scripts/gps-calibration-agent.mjs --days=7     # ampliar ventana (default: 3 días)
node scripts/gps-calibration-agent.mjs --apply      # actualiza tolls.json (frontend + app)
node scripts/gps-calibration-agent.mjs --apply --pr # actualiza + crea PR en GitHub
```

Criterios: ≥3 pasadas por peaje, shift de coords >15m, cambio de radio ≥25m.
Shifts >200m se marcan como `⚠ verificar manualmente` (probable GPS noise o túnel).
Corre periódicamente cuando haya viajes nuevos acumulados.

## `correct-toll-coords.mjs`
One-off legacy: hardcodeado a Francisco + 3 peajes específicos. Reemplazado por `gps-calibration-agent.mjs`.

## `fix-francisco-trip.mjs`
One-off: reconstructs crossings from a live_trip's GPS positions and inserts a `trips` row. Created when a user's real-time detection failed (0 tolls) but positions exist. Dry-runs by default; pass `--commit` to insert.

## `code-review-agent.mjs` ⭐
**Code Review Agent** — verifica calidad antes de commitear: drift shared files, `.catch()` vacíos, queries sin `.limit()`, keys hardcodeadas.

```sh
node scripts/code-review-agent.mjs              # revisa todo el proyecto
node scripts/code-review-agent.mjs --staged     # solo archivos en git staging
node scripts/code-review-agent.mjs --strict     # exit 1 si hay errores (para pre-commit hook)
```

Para instalar como pre-commit hook:
```sh
echo '#!/bin/sh\nnode scripts/code-review-agent.mjs --staged --strict' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## `release-agent.mjs` ⭐
**Release Agent** — lanza EAS Build (Android preview APK), espera resultado, y genera mensaje WhatsApp con link de descarga.

```sh
node scripts/release-agent.mjs                  # build Android + espera
node scripts/release-agent.mjs --platform=ios   # build iOS
node scripts/release-agent.mjs --no-wait        # lanza y sale sin esperar
node scripts/release-agent.mjs --dry-run        # muestra plan sin construir
```

## `analytics-agent.mjs` ⭐
**Analytics Agent** — genera resumen diario de actividad: usuarios activos, viajes, CLP total, anomalías de detección.

```sh
node scripts/analytics-agent.mjs               # último día
node scripts/analytics-agent.mjs --days=7      # última semana
node scripts/analytics-agent.mjs --days=30     # último mes
node scripts/analytics-agent.mjs --format=whatsapp  # mensaje listo para pegar
```

Corre periódicamente (cron 08:00 Santiago) o cuando necesites un resumen ejecutivo.

## Conventions
- Read-only by default; writes require `--commit` or `--fix`.
- Credentials come from memory (`reference_supabase_access.md`), not env vars — anon key only, no service role.
- Name new one-off scripts after the incident/user (e.g. `fix-X-trip.mjs`) so it's obvious when they can be deleted.
