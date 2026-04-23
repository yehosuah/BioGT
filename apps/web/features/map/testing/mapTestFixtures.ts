import type { MapFeature, MapFeatureCollection, MapInitOptions, MapLayerConfig } from "@/features/map/core/MapTypes";

export const mapTestInitOptions: MapInitOptions = {
  provider: "null",
  center: [-90.5069, 14.6349],
  zoom: 7
};

export const placesFixture: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      id: "place-1",
      type: "Feature",
      geometry: { type: "Point", coordinates: [-90.5069, 14.6349] },
      properties: {
        id: "place-1",
        name: "Quetzal Ridge",
        category: "bird",
        status: "visible",
        updatedAt: "2026-04-01",
        source: "fixture",
        label: "Quetzal Ridge"
      }
    },
    {
      id: "place-2",
      type: "Feature",
      geometry: { type: "Point", coordinates: [-90.2069, 14.7349] },
      properties: {
        id: "place-2",
        name: "Jaguar Valley",
        category: "mammal",
        status: "reviewed",
        updatedAt: "2026-04-02",
        source: "fixture",
        label: "Jaguar Valley"
      }
    },
    {
      id: "place-3",
      type: "Feature",
      geometry: { type: "Point", coordinates: [-90.1069, 14.9349] },
      properties: {
        id: "place-3",
        name: "Ceiba Wetlands",
        category: "flora",
        status: "visible",
        updatedAt: "2026-04-03",
        source: "fixture",
        label: "Ceiba Wetlands"
      }
    }
  ]
};

export const emptyFeatureCollectionFixture: MapFeatureCollection = {
  type: "FeatureCollection",
  features: []
};

export const invalidFeatureFixture = {
  type: "Feature",
  id: "invalid-1",
  geometry: null,
  properties: {
    id: "invalid-1",
    name: "Broken place",
    category: "unknown",
    status: "broken",
    updatedAt: "2026-04-04",
    source: "fixture"
  }
};

export const routesFixture: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      id: "route-1",
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-90.55, 14.6],
          [-90.4, 14.68],
          [-90.28, 14.74]
        ]
      },
      properties: {
        id: "route-1",
        name: "Cloud Route",
        category: "route",
        status: "visible",
        updatedAt: "2026-04-05",
        source: "fixture",
        label: "Cloud Route"
      }
    }
  ]
};

export function createPointLayerConfig(
  overrides: Partial<MapLayerConfig> = {}
): MapLayerConfig {
  return {
    id: "places",
    label: "Places",
    sourceId: "places-source",
    dataKey: "places",
    dataSource: {
      kind: "fixture",
      dataShape: "geojson"
    },
    geometryType: "point",
    layerKind: "circle",
    renderMode: "geojson",
    visibleByDefault: true,
    toggleable: true,
    interactive: true,
    selectable: true,
    showInLayerToggle: true,
    order: 10,
    requiredProperties: ["id", "name", "category", "status", "updatedAt", "source"],
    states: {
      loading: { message: "Loading places..." },
      empty: { message: "No places found." },
      error: { message: "Places failed to load.", severity: "error" }
    },
    type: "point",
    data: placesFixture,
    visibility: "visible",
    ...overrides
  };
}

export function createFeature(overrides: Partial<MapFeature> = {}): MapFeature {
  return {
    ...placesFixture.features[0],
    ...overrides
  } as MapFeature;
}
