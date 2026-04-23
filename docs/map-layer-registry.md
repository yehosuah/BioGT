# Map Layer Registry

## What It Is

BioGT map layer registry lives in `apps/web/features/map/registry/layerRegistry.ts`.

It is single source of truth for:

- stable layer ids
- display labels and descriptions
- data source references
- provider-agnostic geometry and layer kinds
- visibility defaults and zoom rules
- interaction metadata
- loading, empty, hidden, invalid, and error copy
- style intent, icon intent, and label intent
- ordering for render and toggle UI
- required and optional feature properties

Core helpers:

- `layerRegistry.ts` for config plus ordering/visibility/toggle helpers
- `layerResolvers.ts` for style/icon/label/tooltip/state resolution
- `layerValidation.ts` for layer-specific GeoJSON validation

## How To Add Layer

1. Add new entry to `layerRegistry`.
2. Set `id`, `sourceId`, `dataKey`, `dataSource`, `geometryType`, `layerKind`, and `renderMode`.
3. Define `visibleByDefault`, `toggleable`, `interactive`, `selectable`, `order`, and zoom rules.
4. Add `requiredProperties` and `validation.allowedGeometryTypes`.
5. Add `states.loading`, `states.empty`, and `states.error` at minimum.
6. Add style intent in `style`, icon intent in `icons`, and label intent in `labels` only with provider-neutral values or resolver functions.
7. If layer comes from `/api/map/layers/[layer]`, point `dataSource.endpoint` there and add the server-side repository handling if needed.

## Required Fields

Every runtime layer should define:

- `id`
- `label`
- `sourceId`
- `dataKey`
- `dataSource`
- `geometryType`
- `layerKind`
- `renderMode`
- `visibleByDefault`
- `toggleable`
- `interactive`
- `selectable`
- `order`
- `requiredProperties`
- `states`

## Style Resolution

Registry never stores MapLibre, deck.gl, Mapbox, Leaflet, Google Maps, or ArcGIS paint/layout objects.

Instead it stores provider-neutral intent like:

- `fillColor`
- `lineColor`
- `lineWidth`
- `pointRadius`
- icon fallback or icon resolver
- label text or property-based label
- tooltip text

`resolveLayerStyle`, `resolveLayerIcon`, `resolveLayerLabel`, and `resolveLayerTooltip` evaluate static values or resolver functions against shared context like `zoom`, `viewMode`, `selected`, `feature`, and `showRichnessCells`.

## Provider Translation

Provider code stays outside registry.

Current flow:

1. `MapExplorer` asks registry which layers are source-managed, visible, toggleable, and ordered.
2. `MapExplorer` fetches GeoJSON and validates it with `validateFeatureCollectionForLayer`.
3. `MapController` receives canonical layer configs plus data.
4. `MapLibreDeckAdapter` translates registry style intent into `GeoJsonLayer` props.

If BioGT adds Mapbox, Leaflet, Google Maps, ArcGIS, or another renderer later, adapter should consume same registry config and do its own translation there.

## Ordering

Render order and toggle order both come from `order`.

- `getOrderedLayers()` sorts whole registry
- `getRenderableGeoJsonLayers()` filters map canvas GeoJSON layers
- `getToggleableLayers()` filters active toggle UI layers
- `getVisibleLayers()` applies toggles, mode rules, zoom rules, and visibility predicates

Do not rely on import order or JSX order.

## Testing New Layer

Run:

```bash
npx vitest run apps/web/features/map/registry/layerRegistry.test.ts
npm run test:web
npm run typecheck
```

For GeoJSON layers, verify:

- required properties pass validation
- unsupported geometry fails safely
- zoom and mode visibility match intent
- toggle UI shows correct label and order
- adapter still renders without provider-specific objects in registry
