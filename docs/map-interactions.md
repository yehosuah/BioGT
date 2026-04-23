# Map Interaction System

BioGT now routes map interaction behavior through a provider-agnostic controller instead of letting UI code bind product state directly to MapLibre, deck.gl, or future SDK events.

## Interaction Flow

1. Provider adapter receives raw SDK events.
2. Adapter normalizes them into shared feature, map, or viewport payloads.
3. `MapController` applies default interaction behavior:
   - hover -> preview state, popup anchor, cursor/highlight
   - click -> selected feature state, detail state, optional popup anchor
   - map click -> clear transient hover/popup, preserve selection
   - viewport change -> shared viewport state
   - layer hide -> clear selection safely if selected layer disappears
4. UI reads centralized interaction state through `controller.subscribeToInteractionState(...)`.
5. Search/list actions call controller methods like `selectFeature(...)` so they reuse the same flow as map clicks.

## Normalized Event Shape

Public UI/business code consumes normalized feature references:

```ts
type NormalizedFeatureReference = {
  featureId: string | number | null;
  layerId: string | null;
  geometry: Geometry | null;
  properties: GeoJsonProperties;
  lngLat: [number, number] | null;
  screenPoint: { x: number; y: number } | null;
};
```

Feature events add:

```ts
type FeatureInteractionEvent = NormalizedFeatureReference & {
  interactionType: "click" | "hover" | "leave" | "select" | "deselect";
  source: "map" | "search" | "list" | "filter" | "system";
};
```

`originalEvent` stays inside adapters and controller bridge code only.

## Central Interaction State

`MapController` owns shared interaction state:

- `selectedFeatureId`
- `selectedLayerId`
- `hoveredFeatureId`
- `hoveredLayerId`
- `activePopupFeatureId`
- `activeDetailFeatureId`
- `visibleLayerIds`
- `lastInteractionSource`
- `interactionMode`
- normalized selected/hovered/popup/detail feature refs
- latest normalized viewport

This state is provider-agnostic and reusable by popup, desktop detail panel, mobile bottom sheet, and search/list flows.

## Adapter Rules

Provider adapters must:

- register raw SDK listeners internally only
- expose `onFeatureClick`, `onFeatureHover`, `onFeatureLeave`, `onMapClick`, and `onViewportChange`
- support `selectFeature`, `clearSelection`, `highlightFeature`, `clearHighlight`, and `setCursor`
- always return cleanup functions for listener registration
- avoid leaking provider instances or event objects past the adapter/controller boundary

Current production adapter: `apps/web/features/map/adapters/MapLibreDeckAdapter.ts`

## UI Consumption Rules

UI code should:

- subscribe to controller state, not provider SDK objects
- call `controller.selectFeature(...)` for search/list-driven feature selection
- call `controller.clearSelection()` / `controller.closeDetail()` from explicit close actions
- treat popup content as lightweight preview only
- keep full detail content in panel or bottom sheet

UI code should not call:

- `map.on(...)`
- `mapboxMap.on(...)`
- `google.maps.event.addListener(...)`
- `L.geoJSON(...).on(...)`
- provider popup APIs for business logic

## Adding A New Interaction

1. Add normalized event/type changes in `apps/web/features/map/core/interactionTypes.ts`.
2. Extend `MapAdapter` if the adapter boundary needs a new shared capability.
3. Implement default state transition in `MapController`.
4. Add provider-specific event bridge logic inside each adapter.
5. Add controller/unit tests in `apps/web/features/map/__tests__/`.
6. Wire UI to controller state or controller methods, not raw provider callbacks.

## Porting To Another Provider

To port BioGT to Leaflet, Google Maps, ArcGIS, or another SDK:

1. Create a new adapter that implements `MapAdapter`.
2. Translate provider click/hover/leave/viewport callbacks into shared payloads.
3. Keep layer data in shared GeoJSON form where possible.
4. Reuse `MapController`, registry metadata, popup/detail components, and interaction tests.
5. Add provider-specific integration tests only for adapter rendering/wiring details.

If the provider cannot supply screen coordinates for some events, emit `screenPoint: null`; popup code already handles that defensively.
