# Map Provider Matrix

## Purpose

BioGT keeps product map behavior behind one internal contract so atlas UI and map controller logic do not depend on provider SDK APIs directly. Current production provider stays `maplibre`; this phase adds provider matrix docs, adapter factory, placeholder adapters, and stricter adapter boundary rules.

## Current Provider

- Current provider: `maplibre`
- Rendering stack: `react-map-gl/maplibre` + `deck.gl`
- First concrete adapter: `apps/web/features/map/adapters/MapLibreAdapter.ts`

## Implementation Audit

### Map Files Found

- `apps/web/components/map-explorer.tsx`
- `apps/web/features/map/components/MapCanvas.tsx`
- `apps/web/features/map/components/LazyMapLibreDeckCanvas.tsx`
- `apps/web/features/map/components/MapLibreDeckCanvas.tsx`
- `apps/web/features/map/components/MapFoundationCanvas.tsx`
- `apps/web/features/map/core/MapAdapter.ts`
- `apps/web/features/map/core/MapController.ts`
- `apps/web/features/map/core/MapTypes.ts`
- `apps/web/features/map/core/mapGeometry.ts`
- `apps/web/features/map/adapters/MapLibreDeckAdapter.ts`
- `apps/web/features/map/adapters/MapLibreAdapter.ts`
- `apps/web/features/map/adapters/createMapAdapter.ts`
- `apps/web/features/map/registry/layerRegistry.ts`
- `apps/web/features/map/data/geo/bounds.ts`
- `apps/web/features/map/performance/clusterStrategy.ts`
- `apps/web/features/map/performance/viewportScheduler.ts`

### Provider-Specific Imports Found

- `react-map-gl/maplibre`
- `maplibre-gl/dist/maplibre-gl.css`
- `@deck.gl/mapbox`
- `@deck.gl/react`
- `@deck.gl/layers`
- `@deck.gl/core`

These imports now stay inside provider-side files only.

### Existing Concepts Already Implemented

- Map initialization
- Map shell/container
- GeoJSON layer rendering
- Marker overlay rendering
- Fit bounds and set view
- Feature click and hover handlers
- Layer visibility toggles
- Controller-driven interaction state
- Layer registry with normalized layer metadata

### Missing Or Still Planned

- Real provider implementations for `mapbox`, `leaflet`, `google`, `arcgis`
- Provider-native popup implementation parity
- Provider-native marker management parity outside current overlay path
- Adapter-side labels/symbol layers beyond current deck.gl GeoJSON path

## Internal Conventions

- Coordinates are always `[lng, lat]`
- Bounds are always `[west, south, east, north]`
- GeoJSON stays canonical feature format

## Provider Implementation Matrix

| Internal Concept | Mapbox/MapLibre | Leaflet | Google Maps | ArcGIS | Status |
| --- | --- | --- | --- | --- | --- |
| Base map | style URL | TileLayer | Map ID / basemap | Basemap | `maplibre` implemented, others planned |
| GeoJSON layer | source + layer / deck overlay | `L.geoJSON` | Data Layer | `GeoJSONLayer` | `maplibre` implemented, others planned |
| Marker | Marker / symbol layer | Marker / DivIcon | `AdvancedMarkerElement` | Graphic | current product uses overlay markers on `maplibre`; others planned |
| Popup | Popup | Popup | InfoWindow | PopupTemplate | contract present, provider-native parity planned |
| Layer style | paint/layout | style function | data style function | renderer | `maplibre` implemented through registry + deck style resolvers |
| Fit bounds | `fitBounds` | `fitBounds` | `fitBounds` | `view.goTo / extent` | `maplibre` implemented, others planned |
| Events | map/layer events | layer events | map/data events | view/layer events | `maplibre` implemented, others planned |

## Implemented Adapter Status

- `MapLibreAdapter`: working concrete adapter for current production provider
- `MapboxAdapter`: placeholder, throws clear install error
- `LeafletAdapter`: placeholder, throws clear install error
- `GoogleMapsAdapter`: placeholder, throws clear install error
- `ArcGISAdapter`: placeholder, throws clear install error

## How Switching Providers Works

1. Set `NEXT_PUBLIC_MAP_PROVIDER` or `VITE_MAP_PROVIDER`.
2. `createMapAdapter()` resolves provider name and returns matching adapter.
3. Product map code keeps using `MapController`, `MapCanvas`, `layerRegistry`, and GeoJSON data.
4. To make a new provider real, replace placeholder adapter with a concrete implementation and add matching provider canvas wiring if needed.

## Provider-Specific Work Still Required

- Implement real SDK adapters for non-maplibre providers
- Add provider rendering components where runtime SDK bindings differ
- Validate popup and marker behavior for each real provider
- Map any provider escape hatches into documented adapter methods instead of leaking SDK objects into UI state

## Future Map Development Rules

- UI components must not import map SDKs directly.
- New layers must be registered in `apps/web/features/map/registry/layerRegistry.ts`.
- New provider features must be added through `MapAdapter` first.
- GeoJSON remains canonical feature format.
- Internal coordinates are always `[lng, lat]`.
- Bounds are always `[west, south, east, north]`.
- Provider escape hatches must be documented in this file before use.
