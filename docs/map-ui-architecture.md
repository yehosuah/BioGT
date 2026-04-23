# Map UI Architecture

## Responsibilities

- `apps/web/features/map/components/MapShell.tsx` is the route-facing shell seam. It keeps the screen entrypoint stable while the current product composition stays inside `apps/web/components/map-explorer.tsx`.
- `apps/web/components/map-explorer.tsx` owns the screen composition: top search/action bar on desktop, left filter rail, central map stage, app-owned detail surfaces, mobile overlays, loading/error/empty states, and adapter commands.
- `apps/web/features/map/components/MapCanvas.tsx` and `MapLibreDeckCanvas.tsx` stay focused on provider rendering, markers, and forwarding interaction events through the controller. Provider controls are not the product UI.
- `apps/web/features/map/components/MapSearch.tsx`, `MapLayerToggle.tsx`, `MapControls.tsx`, `MapLegend.tsx`, `FeatureDetailPanel.tsx`, and `MobileBottomSheet.tsx` are reusable UI seams around the map canvas.

## Selected Feature Flow

1. Map geometry click flows through the adapter into `MapController`.
2. `MapController` updates interaction state in the shared interaction store.
3. `MapExplorer` reads interaction state with `useSyncExternalStore`.
4. The selected feature drives popup, desktop detail panel, and mobile bottom sheet state.
5. Closing the detail UI calls controller close/clear methods so selection does not depend on provider popup state.
6. Area search selection also routes through controller selection so the map fits to the chosen feature without leaking provider SDK calls into UI components.

## Desktop And Mobile Layout

- Desktop keeps the full shell: top bar, left filter/layer rail, center map, right detail panel.
- Mobile switches to map-first layout under `820px`: desktop rails are hidden, search floats above the map, controls stay in an app-owned overlay, filters and legend move into a compact overlay panel, and selected-feature details move to a bottom sheet.
- The map implementation is shared across breakpoints. Responsive behavior is controlled by shell state and CSS, not duplicate provider components.

## Provider Integration

- Future providers should integrate by implementing the existing adapter/controller contracts in `apps/web/features/map/core`.
- UI components should continue to consume canonical feature data and controller commands such as `setView`, `fitBounds`, `selectFeature`, and layer visibility changes.
- Do not place provider SDK objects in global UI state.

## Adding Future Layers

- Add the layer to `apps/web/features/map/registry/layerRegistry.ts`.
- Provide metadata used by UI surfaces when available: label, description, legend icon, visibility rules, and loading-state messaging.
- `MapLayerToggle` and `MapLegend` already derive their content from registry-driven layer definitions, so new layers should appear there without custom screen wiring.

## QA Checklist

- Desktop `/map`: top search bar, left filter rail, map canvas, and right detail placeholder all render.
- Desktop: clicking a map feature opens the app-owned detail panel. Closing the panel clears selection.
- Desktop: area search selection focuses the map and opens detail without relying on provider popups.
- Mobile width under `820px`: topbar and side rail disappear, floating search appears, controls stay tappable, and selected detail uses the bottom sheet instead of the right panel.
- Mobile: filters and legend open from overlay controls and do not remount the map.
- Error path: if the provider fails to initialize, the map state card shows a retry action.
- Empty path: no-result search and no-visible-data map states remain readable.
