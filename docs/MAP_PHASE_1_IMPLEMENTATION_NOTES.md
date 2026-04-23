# Map Phase 1 Implementation Notes

## What Was Added

- Provider-agnostic map feature scaffold under `apps/web/features/map`.
- Product spec and architecture docs for map foundation.
- Shared TypeScript contracts for providers, layers, features, viewport, and interactions.
- `MapAdapter` contract, `MapController`, and `NullMapAdapter`.
- Generic layer registry placeholders for places, routes, and zones.
- Minimal React preview shell under `/map/foundation`.
- Vitest smoke tests for controller and null adapter.

## Core File Locations

- `apps/web/features/map/core`
- `apps/web/features/map/adapters`
- `apps/web/features/map/components`
- `apps/web/features/map/registry`
- `apps/web/features/map/docs`
- `apps/web/features/map/__tests__`

## Provider-Agnostic Guarantees

- Core files do not import `maplibre-gl`, `react-map-gl`, `@deck.gl/*`, or any other provider SDK.
- `MapController` talks only to `MapAdapter`.
- Provider-specific behavior remains isolated to future adapter implementations.
- Preview path uses `NullMapAdapter`, proving compile path without real map boot.

## How To Mount Or Preview

- Existing production-like explorer remains at `/map`.
- New Phase 1 scaffold preview lives at `/map/foundation`.
- `MapShell` can be embedded in other routes or admin previews by importing `@/features/map/components/MapShell`.

## Commands Run

- `node -v`
- `npm run test:web -- apps/web/features/map/__tests__/map-controller.test.ts`
- `npm run typecheck`
- `npm run test:web`
- `npm run lint`
- `npm run build`

## Command Results

- `node -v`: passed, reported `v25.9.0`.
- `npm run test:web -- apps/web/features/map/__tests__/map-controller.test.ts`: passed, `3` tests green.
- `npm run typecheck`: passed.
- `npm run test:web`: passed, `15` tests green total.
- `npm run lint`: failed due pre-existing repo script issue. `next lint` resolves invalid directory `/Users/yehosuahercules/Desktop/Misc./BioGT/apps/web/lint`.
- `npm run build`: host build did not complete under current Node 25 environment. `next build` remained idle with no emitted output until terminated. Repo guidance already warns production build validation should use Node 22 or Docker instead of host Node 25.

## Limitations

- Null adapter stores state only; it does not render tiles, controls, or features.
- Preview route is architecture scaffold, not product replacement.
- Environment variables are future-facing defaults only; no real API keys or provider bootstrap yet.
- Full production build was not confirmed on host because current Node 25 environment is not reliable for this Next.js app.

## Recommended Next Phase

- Phase 2 should define canonical GeoJSON schemas, transformers, fixtures, and validation so provider adapters receive normalized layer-ready data.
