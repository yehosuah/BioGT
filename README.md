# BioMap Guatemala

BioMap Guatemala is a Spanish-first biodiversity storytelling and mapping platform scaffold for Guatemala. This repository implements a runnable Phase 1 public experience with:

- A Next.js public application
- Typed public APIs for areas, species, citations, search, and map layers
- Geoprivacy-safe generalized map layers
- A Python ETL package for Biodiversidad.gt ingestion and atlas DB loading
- Supabase/PostGIS schema definitions
- Dockerized local development

## Workspace

- `apps/web`: public application, APIs, demo data, and tests
- `workers/etl`: ingestion and normalization scaffold
- `infra/supabase/migrations`: database schema

## Quick start

```bash
npm install
npm run dev
```

The public site will run at `http://localhost:3000`.

## Populate the atlas database

Start the database services and apply migrations:

```bash
docker compose up -d db db-init
```

Then populate the atlas tables from live institutional data:

```bash
export POSTGRES_HOST_PORT=55432
export DATABASE_URL=postgresql://postgres:postgres@localhost:${POSTGRES_HOST_PORT}/biogt
npm run data:populate
```

The first ETL run bootstraps a dedicated local virtualenv at `.etl-venv` automatically and installs the Python package there.

Useful variants:

```bash
POSTGRES_HOST_PORT=55432 bash ./scripts/run-etl-python.sh -m biomap_gt_etl.cli load --database-url postgresql://postgres:postgres@localhost:55432/biogt --replace-atlas-data --archive-limit 2
POSTGRES_HOST_PORT=55432 bash ./scripts/run-etl-python.sh -m biomap_gt_etl.cli load --database-url postgresql://postgres:postgres@localhost:55432/biogt --replace-atlas-data --from-snapshot ./tmp/fixture.json
```

## Backfill missing species photos

Populate `taxon_media` for taxa that currently have no photo, keeping existing rows untouched:

```bash
export POSTGRES_HOST_PORT=55432
export DATABASE_URL=postgresql://postgres:postgres@localhost:${POSTGRES_HOST_PORT}/biogt
npm run data:backfill-media
```

Useful variants:

```bash
POSTGRES_HOST_PORT=55432 bash ./scripts/run-etl-python.sh -m biomap_gt_etl.cli backfill-media --database-url postgresql://postgres:postgres@localhost:55432/biogt --dry-run --limit 25
POSTGRES_HOST_PORT=55432 bash ./scripts/run-etl-python.sh -m biomap_gt_etl.cli backfill-media --database-url postgresql://postgres:postgres@localhost:55432/biogt --limit 200
```

The backfill uses exact Biodiversidad.gt multimedia matches first, then GBIF as a species-level fallback when the match is exact and the media includes an explicit license.

## Tests

```bash
npm run test
```

## Docker

```bash
docker compose up --build
```

## Deployment

- Production checklist: [docs/deployment/production-checklist.md](/Users/yehosuahercules/Desktop/Misc./BioGT/docs/deployment/production-checklist.md)
- Map security and provider restrictions: [docs/deployment/map-security.md](/Users/yehosuahercules/Desktop/Misc./BioGT/docs/deployment/map-security.md)

## Notes

- Phase 1 intentionally ships with citations and source links only; no platform-hosted occurrence exports.
- Exact sensitive coordinates are never served from the public APIs.
- Phase 2 map-data architecture lives under `apps/web/features/map/data/geo`, with GeoJSON as canonical renderer-facing format and fixtures/docs in `docs/map-data-architecture.md`.
- Bootstrap demo fixtures are now intended only for explicit local fallback via `BIOGT_BOOTSTRAP_DEMO_DATA=true`; the default runtime should target DB-backed public biodiversity data.
- The new loader imports all published Biodiversidad.gt DwC-A archives by default, reloads Guatemala country + 22 department geometry from geoBoundaries, and preserves the current protected-area subset in DB.
- The compose database now publishes on `localhost:55432` by default to avoid collisions with host-level PostgreSQL installations already using `localhost:5432`.
