# BioGT Map Testing

## Stack

- `Vitest` for unit and component tests.
- `@testing-library/react` for React UI behavior.
- `Playwright` for end-to-end browser coverage.
- Provider-independent tests use `MockMapAdapter`, not live map SDKs.

## Install

```bash
npm install
```

## Commands

```bash
npm run test
npm run test:watch
npm run test:unit
npm run test:e2e
npm run test:e2e:ui
npm run test:all
```

Optional existing repo commands:

```bash
npm run test:etl
npm run typecheck
npm run lint
npm run build
```

## Fixture mode

Playwright starts Next dev server with:

- `NEXT_PUBLIC_MAP_FIXTURE_MODE=true`
- `NEXT_PUBLIC_MAP_STYLE_URL=/map-test-fixtures/style.json`

When fixture mode is on, `MapExplorer` rewrites map API requests to static files under:

- `apps/web/public/map-test-fixtures/api/*`

This keeps QA off live DB, off API keys, and off remote basemap styles.

## GeoJSON fixtures

Reusable GeoJSON lives in:

- `tests/fixtures/*.geojson`
- `apps/web/features/map/testing/mapTestFixtures.ts`

Use these for validation, adapter, and controller tests.

## Add new layer test

1. Add or reuse fixture data in `mapTestFixtures.ts` or `tests/fixtures`.
2. Build layer config with `createPointLayerConfig(...)` or repo registry helpers.
3. Assert behavior at three levels when useful:
   - registry invariant
   - controller adapter call
   - UI state/message

## Add new provider adapter contract test

1. Extend `MockMapAdapter` if new adapter method becomes part of shared contract.
2. Add test in `apps/web/features/map/__tests__/map-adapter-contract.test.ts`.
3. Assert controller behavior through stable contract calls, never through provider SDK internals.

## CI notes

- Unit tests do not require network, DB, or provider tokens.
- E2E tests require browser runtime only.
- Playwright currently runs Chromium by default for cost and speed.
- Trace capture is enabled on first retry.

## Current coverage

- GeoJSON validation, invalid/empty handling, and property preservation.
- Map controller init/layer/update/selection behavior.
- Provider-agnostic adapter contract through `MockMapAdapter`.
- Layer registry invariants and visibility behavior.
- Search, detail panel, layer toggle, map state banners, and mobile sheet UI.
- Smoke, interaction, mobile, and failure-state browser flows.

## Known limitations

- Browser tests avoid brittle canvas coordinate clicks. They use search, toggles, and DOM markers instead.
- Fixture mode covers main atlas flows only. New API branches need matching fixture files.
- ETL tests remain separate from web map QA.
