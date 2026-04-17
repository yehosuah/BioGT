# BioGT Agent Guide

## Project Summary

BioGT is a Guatemala biodiversity atlas built around a Next.js 16 / React 19 public web app in `apps/web`, a Postgres/PostGIS schema in `infra/supabase/migrations`, and a Python ETL package in `workers/etl`. The current codebase still ships a scaffolded public atlas backed by bootstrap demo data; the active product direction is to replace that experience with a map-first biodiversity explorer that shows real regional flora and fauna coverage with stronger visuals and cleaner UI.

## Repository Map

- `apps/web/app`: App Router pages plus public API routes. The current map surface lives under `app/map` and `app/api/map`.
- `apps/web/components`: interactive UI pieces. Start with `map-explorer.tsx`, `pretext-hero.tsx`, `area-card.tsx`, and `species-card.tsx`.
- `apps/web/lib`: typed records, DB access, filters, demo fixtures, bootstrap logic, and repository queries. `repository.ts` is the main read model.
- `workers/etl/src/biomap_gt_etl`: ETL CLI, connectors, and snapshot pipeline for Biodiversidad.gt.
- `infra/supabase/migrations`: SQL-first schema history. Add new migrations; do not rewrite existing applied files.
- Generated or noisy paths: `apps/web/.next`, `apps/web/tsconfig.tsbuildinfo`, `workers/etl/src/biomap_gt_etl.egg-info`, `node_modules`, `.venv`.

## Commands

- Install JS deps: `npm install`
- Root ETL commands bootstrap their own venv automatically: `bash ./scripts/run-etl-python.sh -m biomap_gt_etl.cli ...`
- Start the web app: `npm run dev`
- Populate the atlas DB: `npm run data:populate`
- Type-check the web app: `npm run typecheck`
- Run web tests: `npm run test:web`
- Run ETL tests: `npm run test:etl`
- Run both test suites: `npm run test`
- Build an ETL snapshot: `bash ./scripts/run-etl-python.sh -m biomap_gt_etl.cli snapshot --output ./tmp/biodiversidad-snapshot.json`
- Load atlas tables from ETL: `bash ./scripts/run-etl-python.sh -m biomap_gt_etl.cli load --database-url "$DATABASE_URL" --replace-atlas-data`
- Start the full local stack: `docker compose up --build`

## Conventions

- The npm workspace only includes `apps/*`. `workers/etl` is a separate Python package and root ETL commands use `bash ./scripts/run-etl-python.sh` to manage `.etl-venv`.
- `apps/web/lib/repository.ts` is the public data contract. When map filters, geographies, or species card data change, update repository queries and the map API together.
- `apps/web/lib/demo-data.ts` and `apps/web/lib/atlas-bootstrap.ts` still seed the public experience when the DB is unavailable or `BIOGT_BOOTSTRAP_DEMO_DATA=true`. Treat that path as a local fallback, not as the intended production behavior.
- `workers/etl/src/biomap_gt_etl/loader.py` is the repeatable atlas population path. Prefer it over extending the demo bootstrap when the task is about real biodiversity data.
- Geoprivacy is a hard product requirement. Public APIs must stay on generalized geometry and must never expose exact occurrence coordinates.
- Database changes are SQL-first under `infra/supabase/migrations`. If a feature needs new tables or indexes, add a migration rather than patching bootstrap state only.
- Pretext is already in use for headline layout. Reuse it for selected high-value titles only, and avoid recomputing expensive preparation work on every resize.

## Validation Before Handoff

- Web-only edits: `npm run typecheck`
- ETL-only edits: `npm run test:etl`
- Cross-cutting edits: `npm run typecheck && npm run test:etl`
- Full runtime checks: use Node 22 or `docker compose up --build` before trusting `npm run build`

## Warnings and Guardrails

- The current local environment is on Node `v25.6.1`. `npm run build` fails there inside Next.js CLI startup, while the checked-in Dockerfile uses Node 22. Validate production builds with Node 22 LTS or Docker.
- `npm run lint` is not reliable under the current Next.js setup; do not treat it as a release gate until the script is fixed.
- `.env.example` and `docker-compose.yml` currently default `BIOGT_BOOTSTRAP_DEMO_DATA=true`. If the public map is showing placeholder species, check that flag first.
- Do not hand-edit generated artifacts in `.next`, `tsconfig.tsbuildinfo`, or `workers/etl/src/biomap_gt_etl.egg-info`.
- ETL connectors perform live network reads. Unit tests cover snapshot shape, not remote endpoint stability.

## Related Docs

- `README.md`
- `workers/etl/README.md`
- `TASK_CONTEXT.md`
