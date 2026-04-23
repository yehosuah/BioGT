import { describe, expect, it } from "vitest";

import type { MapFeature } from "@/features/map/core/MapTypes";
import { layerRegistry } from "@/features/map/registry/layerRegistry";
import { mapTokens } from "@/features/map/styles/mapTokens";
import type { MapLayerStyleRule } from "@/features/map/styles/mapStyleTypes";
import {
  resolveMapStyle,
  resolveMapStyleForLayer,
  resolveStatusColor
} from "@/features/map/styles/mapStyleResolvers";
import { toMapLibreDeckGeoJsonStyle } from "@/features/map/styles/providerStyleAdapters";

const polygonFeature: MapFeature = {
  type: "Feature",
  id: "feature-1",
  properties: {
    id: "feature-1",
    label: "Feature 1",
    speciesCount: 220
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-90.4, 15.3],
        [-90.2, 15.3],
        [-90.2, 15.5],
        [-90.4, 15.3]
      ]
    ]
  }
};

const priorityPointFeature: MapFeature = {
  type: "Feature",
  id: "marker-1",
  properties: {
    id: "marker-1",
    label: "Priority marker",
    status: "danger",
    priority: "high"
  },
  geometry: {
    type: "Point",
    coordinates: [-90.3, 15.4]
  }
};

const samplePointRule: MapLayerStyleRule = {
  geometryType: "point",
  default: {
    fillColor: mapTokens.colors.geometry.point,
    strokeColor: mapTokens.colors.base.surface,
    strokeWidth: 1,
    radius: mapTokens.sizes.marker.md,
    opacity: mapTokens.opacity.strong
  },
  hover: {
    radius: mapTokens.sizes.marker.lg
  },
  selected: {
    strokeColor: mapTokens.colors.semantic.selected,
    strokeWidth: 2,
    radius: mapTokens.sizes.marker.xl
  },
  disabled: {
    opacity: mapTokens.opacity.disabled
  },
  dataDriven: [
    {
      kind: "byStatus",
      property: "status"
    },
    {
      kind: "byPriority",
      property: "priority",
      channel: "radius"
    }
  ]
};

describe("map style resolvers", () => {
  it("returns the default shared style when no state overrides apply", () => {
    expect(
      resolveMapStyle({
        layerStyle: samplePointRule,
        feature: priorityPointFeature,
        state: "default"
      })
    ).toMatchObject({
      fillColor: mapTokens.colors.status.danger,
      strokeColor: mapTokens.colors.base.surface,
      strokeWidth: 1,
      radius: mapTokens.sizes.marker.lg,
      opacity: mapTokens.opacity.strong
    });
  });

  it("applies selected state overrides on top of the base style", () => {
    expect(
      resolveMapStyle({
        layerStyle: samplePointRule,
        feature: priorityPointFeature,
        state: "selected"
      })
    ).toMatchObject({
      fillColor: mapTokens.colors.status.danger,
      strokeColor: mapTokens.colors.semantic.selected,
      strokeWidth: 2,
      radius: mapTokens.sizes.marker.xl
    });
  });

  it("resolves danger status colors from the shared semantic palette", () => {
    expect(resolveStatusColor("danger")).toBe(mapTokens.colors.status.danger);
    expect(resolveStatusColor("critical")).toBe(mapTokens.colors.status.danger);
  });

  it("reduces opacity for disabled states", () => {
    expect(
      resolveMapStyle({
        layerStyle: samplePointRule,
        feature: priorityPointFeature,
        state: "disabled"
      }).opacity
    ).toBe(mapTokens.opacity.disabled);
  });

  it("fails safely when feature properties are missing", () => {
    expect(() =>
      resolveMapStyle({
        layerStyle: samplePointRule,
        feature: {
          ...priorityPointFeature,
          properties: null
        },
        state: "default"
      })
    ).not.toThrow();

    expect(
      resolveMapStyle({
        layerStyle: samplePointRule,
        feature: {
          ...priorityPointFeature,
          properties: null
        },
        state: "default"
      })
    ).toMatchObject({
      fillColor: mapTokens.colors.geometry.point,
      radius: mapTokens.sizes.marker.md
    });
  });

  it("translates shared visual styles into MapLibre deck.gl accessors", () => {
    expect(
      toMapLibreDeckGeoJsonStyle({
        fillColor: mapTokens.colors.geometry.polygon,
        fillOpacity: mapTokens.opacity.background,
        strokeColor: mapTokens.colors.geometry.boundary,
        strokeWidth: mapTokens.sizes.line.emphasized,
        opacity: mapTokens.opacity.strong,
        radius: mapTokens.sizes.marker.lg
      })
    ).toMatchObject({
      fillColor: [106, 141, 135, 71],
      lineColor: [23, 57, 45, 235],
      lineWidth: mapTokens.sizes.line.emphasized,
      pointRadius: mapTokens.sizes.marker.lg,
      opacity: mapTokens.opacity.strong
    });
  });

  it("resolves BioGT layer configs through the shared style registry", () => {
    const style = resolveMapStyleForLayer(layerRegistry.public_hex, polygonFeature, {
      viewMode: "coverage",
      zoom: 8.2
    });

    expect(style.fillColor).toBe(mapTokens.colors.ramps.richness.high);
    expect(style.strokeColor).toBe(mapTokens.colors.geometry.boundaryMuted);
    expect(style.strokeWidth).toBe(mapTokens.sizes.line.hairline);
  });
});
