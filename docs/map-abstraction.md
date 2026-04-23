# Map Abstraction Layer

BioGT map product logic now talks to a provider-agnostic controller instead of using `MapLibre`, `deck.gl`, or `react-map-gl` APIs directly inside the explorer.

## Structure

```text
apps/web/features/map/
  adapters/
    MapLibreDeckAdapter.ts
    NullMapAdapter.ts
  components/
    MapLibreDeckCanvas.tsx
    MapCanvas.tsx
    MapShell.tsx
  core/
    MapAdapter.ts
    MapController.ts
    MapTypes.ts
  registry/
    layerRegistry.ts
  styles/
    mapTokens.ts
    mapStyleRegistry.ts
    mapStyleResolvers.ts
    providerStyleAdapters.ts
```

## Current Provider

Current production adapter is `MapLibreDeckAdapter`.

- Base map: `MapLibre`
- GeoJSON rendering: `deck.gl`
- React binding: `react-map-gl/maplibre`

Provider-specific imports must stay inside:

- `apps/web/features/map/adapters/MapLibreDeckAdapter.ts`
- `apps/web/features/map/components/MapLibreDeckCanvas.tsx`

Application code should not import `maplibre-gl`, `react-map-gl`, `@deck.gl/*`, `mapbox-gl`, or any other provider SDK directly.

Map visual decisions should now be added in `apps/web/features/map/styles/` before any provider-specific translation happens.

## Core Usage

```ts
import { MapLibreDeckAdapter } from "@/features/map/adapters/MapLibreDeckAdapter";
import { MapController } from "@/features/map/core/MapController";

const adapter = new MapLibreDeckAdapter();
const controller = new MapController(adapter);

await controller.initialize(container, {
  provider: "maplibre",
  center: [-90.25, 15.68],
  zoom: 6.25,
  styleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL
});

controller.addLayer({
  id: "places",
  type: "point",
  data: placesGeoJSON,
  interactive: true
});

const unsubscribe = controller.onFeatureClick("places", (event) => {
  console.log(event.feature);
});
```

## Adding A GeoJSON Layer

1. Add or reuse stable layer metadata in `apps/web/features/map/registry/layerRegistry.ts`.
2. Register the layer once through `controller.addLayer(...)`.
3. Push new data with `controller.updateLayerData(layerId, featureCollection)`.
4. Toggle visibility with `controller.setLayerVisibility(layerId, "visible" | "hidden")`.
5. Add or update the shared style rule through `mapStyleKey` instead of embedding provider paint values in the layer definition.

Layer ids are stable. Source-like internal ids follow the layer id directly. No random ids.

## Listening For Clicks

Feature clicks:

```ts
const stop = controller.onFeatureClick("public_hex", (event) => {
  selectFeature(event.feature);
});
```

Map clicks:

```ts
const stop = controller.onMapClick((event) => {
  console.log(event.coordinate);
});
```

Both methods return unsubscribe functions.

Hover, leave, selection, popup, and viewport behavior now flow through the same controller-backed interaction state described in [docs/map-interactions.md](./map-interactions.md).

## Adding Another Provider Later

To add another provider:

1. Create a new adapter in `apps/web/features/map/adapters/`.
2. Implement `MapAdapter` from `apps/web/features/map/core/MapAdapter.ts`.
3. Add a provider canvas component only if that SDK needs React-specific bootstrapping.
4. Keep product logic in `MapExplorer` and other UI files talking to `MapController`, not raw SDK objects.

Required shared operations:

- `initialize`
- `setView`
- `fitBounds`
- `addGeoJSONLayer`
- `removeLayer`
- `updateLayerData`
- `onFeatureClick`
- `onMapClick`
- `destroy`
