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

## `correct-toll-coords.mjs`
One-off: scans all trips matching a driver pattern and proposes coordinate corrections (median foot-of-perpendicular across all passes). Works best with 3+ passes per toll. Edit driver filter near the top.

## `fix-francisco-trip.mjs`
One-off: reconstructs crossings from a live_trip's GPS positions and inserts a `trips` row. Created when a user's real-time detection failed (0 tolls) but positions exist. Dry-runs by default; pass `--commit` to insert.

## Conventions
- Read-only by default; writes require `--commit` or `--fix`.
- Credentials come from memory (`reference_supabase_access.md`), not env vars — anon key only, no service role.
- Name new one-off scripts after the incident/user (e.g. `fix-X-trip.mjs`) so it's obvious when they can be deleted.
