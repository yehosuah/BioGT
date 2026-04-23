# Map Data Architecture

## Purpose

This layer gives BioGT a provider-agnostic geospatial contract before any real renderer is chosen. It receives raw location-like records, normalizes them into a shared internal record, validates them, and emits canonical GeoJSON `FeatureCollection` objects for later map phases.

## Why GeoJSON Is Canonical

GeoJSON is renderer-neutral, widely supported, easy to validate, and stable across Mapbox, MapLibre, Leaflet, Google Maps, ArcGIS, OpenLayers, Deck.gl, custom SVG, and canvas-based renderers. Provider adapters can translate from GeoJSON later, but this layer stays independent of any SDK.

## Coordinate Order

All coordinate tuples use `[longitude, latitude]`.

- Longitude must be finite and between `-180` and `180`.
- Latitude must be finite and between `-90` and `90`.
- Any geometry that violates those bounds fails validation before it reaches a map adapter.

## Required Feature Properties

Every canonical feature must expose these normalized properties:

- `id`
- `name`
- `category`
- `status`
- `source`
- `updatedAt`

Extra properties are allowed. They flow through `metadata` on normalized records and are merged into GeoJSON `properties` without overriding the required keys.

## Transformation Flow

Phase 2 establishes this data path:

```text
raw API data
  -> normalizeRawLocationRecord(...)
  -> NormalizedMapRecord
  -> recordToFeature(...)
  -> MapFeature
  -> recordsToFeatureCollection(...) / rawRecordsToFeatureCollection(...)
  -> GeoJSON FeatureCollection
```

Supported raw-field variations include:

- identifiers: `id`, `_id`, `uuid`
- names: `name`, `title`, `label`
- categories: `category`, `type`, `kind`
- statuses: `status`, `state`
- coordinates: `lat`/`lng`, `latitude`/`longitude`, point-style `coordinates`
- explicit geometry: `geometry`

If required values or valid geometry are missing, the pipeline returns structured errors instead of throwing for expected bad data.

## Validation Behavior

Validation utilities live in `apps/web/features/map/data/geo/validation.ts`.

- `isValidLngLat(...)` checks finite `[longitude, latitude]` tuples.
- `isValidGeometry(...)` accepts only supported GeoJSON geometry types and rejects empty or malformed coordinates.
- `validateMapProperties(...)` enforces `id`, `name`, `category`, and `status`.
- `validateFeature(...)` checks GeoJSON shape, stable identity, geometry, and properties.
- `validateFeatureCollection(...)` validates every feature and returns both flat errors and per-feature error groups.

Expected bad input should return structured failures. Throwing is reserved for programmer errors, not data-shape problems.

## Fixtures

Canonical GeoJSON fixtures live in:

- `apps/web/features/map/data/geo/fixtures/samplePlaces.geojson`
- `apps/web/features/map/data/geo/fixtures/sampleRoutes.geojson`
- `apps/web/features/map/data/geo/fixtures/sampleZones.geojson`

These are safe development and test inputs for point, line, and polygon layers.

## How Future Providers Should Consume This Layer

Future provider adapters should accept already-validated `MapFeatureCollection` data from this layer. They should not normalize raw business records, infer missing IDs, or repair malformed geometry inside renderer code.

Recommended later flow:

```text
repository / API / fixtures
  -> geo normalization + validation layer
  -> provider adapter
  -> provider SDK or custom renderer
```

This keeps business rules and safety checks above the map adapter boundary already defined in `apps/web/features/map/docs/MAP_ARCHITECTURE.md`.

## Non-Goals In This Phase

Phase 2 intentionally does not implement:

- map initialization
- provider adapters beyond existing null scaffolding
- markers, popups, clustering, or search UI
- map-side filtering UI
- backend endpoints for new map ecosystems
- external API reads
- provider-specific layer styling

This phase only builds durable geospatial data foundations for later rendering phases.
