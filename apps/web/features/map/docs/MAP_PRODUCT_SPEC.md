# Map Product Specification

## Purpose

Establish BioGT map product as durable product surface, not provider demo. Future map work must support biodiversity exploration, territorial reading, and data provenance while keeping rendering engine replaceable.

## User Goal

Users need explore Guatemala biodiversity through place, layer, and species context without learning map vendor behavior. Product should make territory, visible patterns, and trustworthy public summaries easier to read.

## Map Responsibilities

- Render navigable geographic canvas for biodiversity coverage.
- Present provider-agnostic layers for places, routes, zones, and future BioGT atlas data.
- Support future selection, inspection, filtering, and context-driven navigation.
- Expose viewport state in generic terms so product logic can react without SDK objects.

## Non-Map Responsibilities

- Domain queries, public geoprivacy rules, and source provenance remain outside provider adapters.
- Search, routing, authentication, analytics, and editorial workflows stay in app-level systems.
- UI copy, panel layout, and product navigation stay in shell and app routes.

## Data Assumptions

- Canonical feature format for future phases defaults to GeoJSON `FeatureCollection`.
- Layers may be derived from repository APIs, ETL fixtures, or transformed domain records.
- Exact sensitive coordinates remain out of public client layers.
- Layer definitions must survive provider swaps without rewriting domain data.

## Required Layer Categories

- Base territorial context: country, departments, protected areas, zones.
- Point layers: places, species markers, institutions, observation summaries.
- Line layers: routes, corridors, migration paths, editorial journeys.
- Polygon layers: zones, coverage cells, protected boundaries, thematic regions.
- Derived overlays: filters, selections, density summaries, validation surfaces.

## Required Interaction Categories

- Generic map click and feature click events.
- Feature selection and deselection.
- Viewport navigation: pan, zoom, fit bounds, reset.
- Layer toggles and visibility changes.
- Future hover, focus, keyboard navigation, and programmatic inspection flows.

## Viewport and Navigation Expectations

- Product state owns center, zoom, bounds, bearing, and pitch in generic types.
- Providers may expose extra controls internally, but product APIs only use shared viewport contracts.
- Fit-to-bounds and set-view must remain provider-neutral.

## Mobile Expectations

- Canvas must survive small screens without blocking rest of page.
- Controls and overlays need tap-safe spacing and low clutter.
- Future phase work should support stacked panels and reduced interaction density on mobile.

## Accessibility Expectations

- Shell must expose clear labels, readable status copy, and non-color-only cues.
- Keyboard and screen-reader pathways must be designed at controller and UI shell layers, not left to provider defaults alone.
- Future selectable features need accessible announcement hooks and focus targets.

## Performance Expectations

- Provider swap must not require domain-layer rewrites.
- Layer registration and interaction wiring should scale without SDK leakage into React trees.
- Future data updates should support partial layer updates instead of full remounts.
- Placeholder Phase 1 implementation should stay lightweight and compile without live SDK boot.

## Provider Independence Rules

- Product logic must not depend on Mapbox, MapLibre, Leaflet, Google Maps, OpenLayers, or ArcGIS object models.
- Core map modules may only talk through `MapAdapter`.
- Provider-specific imports belong only inside adapter implementations.
- Provider naming must not leak into controller APIs, layer registry, or product docs except when describing future adapter targets.

## Implemented Foundation

- Shared product contract now lives in `MapTypes`, `MapAdapter`, and `MapController`.
- `NullMapAdapter` still powers the safe foundation preview route.
- `MapLibreDeckAdapter` now powers the real `/map` explorer without leaking provider APIs into product logic.
- Layer add, remove, update, visibility, feature click, map click, and cleanup all flow through the shared controller.

## Follow-Up Phases

- Adapter-specific integration tests and browser smoke coverage.
- Additional provider adapters if BioGT ever needs a second rendering stack.
- Accessibility hardening, keyboard interactions, and performance profiling on top of the shared contract.
