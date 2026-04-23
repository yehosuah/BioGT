# Map Styling System

BioGT map layers now style through a shared provider-agnostic contract under `apps/web/features/map/styles/`.

## Files

- `mapTokens.ts`: central map colors, sizes, opacity levels, and z-index scales aligned to the BioGT product palette.
- `mapStyleTypes.ts`: shared style contract, feature states, geometry types, and data-driven style rule types.
- `mapStyleRegistry.ts`: reusable style definitions for BioGT layer purposes such as departments, protected areas, public hexes, species presence, markers, and clusters.
- `mapStyleResolvers.ts`: resolves a shared style rule plus feature properties into a concrete visual style.
- `providerStyleAdapters.ts`: translates the shared visual style into provider-specific objects for the current renderer.

## Rules

Do not hardcode provider-specific map styles inside feature components. Add or update a shared style rule first, then let the provider adapter translate it.

Do not add inline `rgba(...)`, width, radius, or opacity values in map callbacks when the value expresses product meaning. Put that decision in `mapTokens.ts` or `mapStyleRegistry.ts`.

## Adding A New Layer

1. Add or reuse a token in `mapTokens.ts`.
2. Add a new rule in `mapStyleRegistry.ts`.
3. Point the layer config to that rule with `mapStyleKey`.
4. Let `resolveMapStyleForLayer(...)` and the provider adapter translate it for the renderer.
5. If the layer appears in the legend or marker UI, consume the same rule there as well.

## Data-Driven Styling

Use `dataDriven` rules for:

- `byStatus`: semantic state colors such as active, warning, and danger
- `byCategory`: stable category colors when the category meaning is real and durable
- `byPriority`: importance-based marker size or width changes
- `byRange`: numeric ramps such as species richness

Missing properties must fail safe and keep fallbacks.

## Provider Adapters

Current production rendering path:

- Shared style rule
- `resolveMapStyle(...)`
- `toMapLibreDeckGeoJsonStyle(...)`
- `MapLibreDeckAdapter`

If a new provider is added later, add a new adapter here instead of spreading style syntax into components.

## Example

```ts
const visualStyle = resolveMapStyleForLayer(layerRegistry.public_hex, feature, {
  viewMode: "coverage",
  zoom: 8.2,
  selected: false,
  hovered: false
});

const deckStyle = toMapLibreDeckGeoJsonStyle(visualStyle);
```

The layer registry should describe intent. The provider adapter should describe translation. Product styling logic belongs here.
