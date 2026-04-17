# BioGT Map Re-scope Task Context

## Original Task

The current BioGT site misses the core product vision. The map shows placeholder-like content instead of letting users see what flora and fauna can actually be found in their region in Guatemala. The project needs a clean, interactive biodiversity explorer with regional species visibility, real visuals, sorting, quick facts, and stronger use of Pretext for headline treatments rather than bubble-heavy UI.

## Interpreted Objective

Re-scope the public app from a scaffolded atlas into a map-first Guatemala biodiversity explorer. Success means the public map can drive users from department overview to protected-area detail to public-cell detail, show canonical region-to-species presence from institutional data, render image-first species cards with quick facts and attribution, and stop defaulting the public runtime to demo bootstrap content.

## Relevant Architecture

- `apps/web` owns the public experience, typed repository layer, and map APIs. The current public contract is centered in `apps/web/lib/repository.ts` and consumed by `app/api/map/*` plus `components/map-explorer.tsx`.
- `infra/supabase/migrations` owns the durable data model. The current schema already has areas, occurrences, and media-adjacent moderation tables, but it lacks a public taxon-media model and a clean rollup table for fast region-to-species lookups.
- `workers/etl` owns external Biodiversidad.gt ingestion. It currently stops at archive metadata plus one sample occurrence and does not populate app-facing rollups.

## Key Files and Directories

- `apps/web/lib/repository.ts`: main read model for species, areas, map summary, and public layers. Add map DTOs and the new selection-driven panel query here.
- `apps/web/components/map-explorer.tsx`: current aggregate-only map UI. Rebuild it around explicit selection state and a species panel.
- `apps/web/lib/types.ts`: add `MapSelectionSummary`, `MapSpeciesCard`, `SpeciesVisual`, and `QuickFact`.
- `apps/web/lib/demo-data.ts`: keep as explicit dev fallback only; extend only enough to exercise the new UI contract.
- `apps/web/app/api/map/summary/route.ts` and `apps/web/app/api/map/layers/[layer]/route.ts`: existing map endpoints to preserve.
- `apps/web/app/api/map`: add `panel/route.ts` for selection-driven species responses.
- `infra/supabase/migrations`: add a new migration for taxon rollups, taxon media, and any supporting indexes.
- `workers/etl/src/biomap_gt_etl/pipeline.py` and `workers/etl/src/biomap_gt_etl/connectors/biodiversidad_gt.py`: expand the ETL snapshot toward normalized species, media, and region outputs.
- `.env.example` and `docker-compose.yml`: stop defaulting public runtime behavior to demo bootstrap.
- `AGENT.md`: base repo guide updated alongside this task packet.

## Commands

- Install JS deps: `npm install`
- Root ETL commands bootstrap their own venv: `bash ./scripts/run-etl-python.sh -m biomap_gt_etl.cli ...`
- Start the web app: `npm run dev`
- Run the ETL snapshot manually: `bash ./scripts/run-etl-python.sh -m biomap_gt_etl.cli snapshot --output ./tmp/biodiversidad-snapshot.json`
- Type-check web changes: `npm run typecheck`
- Run ETL tests: `npm run test:etl`
- Run web tests after map/API changes: `npm run test:web`
- Validate production runtime under the supported stack: `docker compose up --build`

## Constraints and Risks

- The checked-in environment is currently Node `v25.6.1`, and `npm run build` fails there in Next.js CLI startup. Use Node 22 LTS or Docker for build validation.
- Geoprivacy remains non-negotiable. New panel or map APIs must never expose exact points.
- `BIOGT_BOOTSTRAP_DEMO_DATA=true` is still the default in both `.env.example` and `docker-compose.yml`, so placeholder data can reappear unless that wiring is changed.
- `species_area_rollups` exists but is unused and poorly shaped for the new task; do not bend new public queries around it.
- External Biodiversidad.gt reads are live network operations. Keep ETL unit tests deterministic by testing normalized transforms, not remote availability.
- Community sources such as iNaturalist may be displayed as labeled enrichment, but canonical “present in this region” logic should stay institutional.

## Acceptance Checklist

- Public runtime no longer defaults to demo bootstrap data when the stack is started normally.
- The map has a selection-driven panel backed by a dedicated API, not tooltip-only aggregate geometry.
- Region browsing follows department overview, protected-area mid-zoom, and public-cell close zoom.
- Species cards in the map panel include visuals, fallback behavior, quick facts, and source attribution.
- New schema supports taxon media and fast region-to-species rollups without exposing exact coordinates.
- ETL produces a richer normalized output aligned with the new public data contract.
- Desktop and mobile layouts both feel intentional, spacious, and materially cleaner than the current bubble-heavy UI.

## Related Docs

- `AGENT.md`
- `README.md`
- `workers/etl/README.md`
