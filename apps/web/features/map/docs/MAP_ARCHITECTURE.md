# Map Architecture

## Provider-Agnostic Flow

```text
Application UI
  -> MapShell
    -> MapController
      -> MapAdapter interface
        -> Provider adapter
          -> Provider SDK
```

Foundation preview still uses `MapShell` plus `NullMapAdapter`, but production explorer now runs through `MapController` plus the real `MapLibreDeckAdapter`.

## Adapter Boundary

`MapController` is provider-independent orchestration layer. UI components talk to controller methods such as `setView`, `fitBounds`, `addLayer`, and `updateLayerData`. Controller never imports provider SDKs and never returns raw provider instances. Provider adapters translate those generic commands into SDK-specific calls.

## Provider Code Placement Rules

- Core map logic must not import provider SDKs.
- UI components should communicate with `MapController`, not direct SDK objects.
- Provider-specific code may only live inside adapter files and provider canvas files under `features/map/`.
- Provider adapters may depend on SDK callbacks internally, but must re-express them as shared map events.

## Layer Definition Rules

- Layer definitions live in registry and use `MapLayerConfig`.
- Registry config describes intent: id, type, visibility, interactivity, zoom thresholds, metadata.
- Provider-specific paint, source, symbol, tile, or control config must stay out of registry.
- Shared visual logic lives in `features/map/styles/` and is referenced from the registry with `mapStyleKey`.
- GeoJSON is default canonical feature format for future data phases.

## Feature Selection Rules

- Feature identity uses generic `MapFeature.id`.
- Selection, hover, popup, detail, and viewport interaction state now live in `MapController` plus its internal interaction store.
- UI reads selection through controller-facing state, not provider feature handles.

## Future Interaction Handling Rules

- Shared interaction types cover map click, feature click, hover, select, and viewport changes.
- Provider adapters normalize provider callbacks into those shared events.
- Search/list flows must call controller methods so they reuse the same normalized selection path.
- Future keyboard and accessibility interactions must sit above adapter layer so they remain cross-provider.

## Future Data Loading Rules

- Data loading stays outside provider adapter.
- Repository, transformer, or fixture layers produce canonical `MapFeatureCollection`.
- Controller sends transformed collections into adapter with `updateLayerData`.
- Provider adapters render data; they do not own business rules for how data is queried or shaped.

## Testability Rules

- Core map logic is testable with `NullMapAdapter` or fake adapters, no browser SDK required.
- Controller tests should assert adapter contract behavior, not provider rendering details.
- Adapter-specific integration tests can be added later per provider.
- Current production proof is controller unit coverage plus the `MapLibreDeckAdapter` wiring in the live explorer.
