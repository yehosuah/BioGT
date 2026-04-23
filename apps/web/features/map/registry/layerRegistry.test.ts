import { describe, expect, it } from "vitest";

import {
  createLayerVisibilityState,
  getInteractiveLayers,
  getLayerConfig,
  getOrderedLayers,
  getToggleableLayers,
  getVisibleLayers,
  isLayerVisibleAtZoom,
  layerRegistry
} from "@/features/map/registry/layerRegistry";
import {
  resolveLayerIcon,
  resolveLayerLabel,
  resolveLayerStyle
} from "@/features/map/registry/layerResolvers";
import {
  validateFeatureCollectionForLayer,
  validateFeatureForLayer
} from "@/features/map/registry/layerValidation";
import type { MapFeature, MapFeatureCollection } from "@/features/map/core/MapTypes";

const departmentFeature: MapFeature = {
  type: "Feature",
  id: "alta-verapaz",
  properties: {
    id: "alta-verapaz",
    kind: "department",
    label: "Alta Verapaz",
    speciesCount: 330
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-90.9, 15.1],
        [-90.1, 15.1],
        [-90.1, 15.9],
        [-90.9, 15.1]
      ]
    ]
  }
};

const publicHexFeature: MapFeature = {
  type: "Feature",
  id: "hex:1",
  properties: {
    id: "hex:1",
    kind: "public_hex",
    label: "Celda pública",
    speciesCount: 180,
    protectedCount: 4,
    sourceCount: 2
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

const publicHexCollection: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [publicHexFeature]
};

describe("layerRegistry", () => {
  it("exports BioGT atlas layers", () => {
    expect(Object.keys(layerRegistry)).toEqual([
      "departments",
      "protected_areas",
      "public_hex",
      "species_presence",
      "species_markers"
    ]);
  });

  it("sorts layers by explicit order", () => {
    expect(getOrderedLayers().map((layer) => layer.id)).toEqual([
      "departments",
      "protected_areas",
      "public_hex",
      "species_presence",
      "species_markers"
    ]);
  });

  it("filters toggleable layers from active context", () => {
    expect(
      getToggleableLayers(layerRegistry, {
        viewMode: "coverage",
        showRichnessCells: true
      }).map((layer) => layer.id)
    ).toEqual(["departments", "protected_areas", "public_hex", "species_markers"]);

    expect(
      getToggleableLayers(layerRegistry, {
        viewMode: "species"
      }).map((layer) => layer.id)
    ).toEqual(["departments", "protected_areas", "species_presence", "species_markers"]);
  });

  it("filters interactive layers", () => {
    expect(getInteractiveLayers().map((layer) => layer.id)).toEqual([
      "departments",
      "protected_areas",
      "public_hex",
      "species_presence",
      "species_markers"
    ]);
  });

  it("respects zoom visibility rules", () => {
    expect(isLayerVisibleAtZoom(layerRegistry.public_hex, 6.5)).toBe(false);
    expect(isLayerVisibleAtZoom(layerRegistry.public_hex, 7.5)).toBe(true);
  });

  it("resolves active visible layers from zoom, mode, and toggles", () => {
    const toggles = createLayerVisibilityState();
    toggles.public_hex = true;

    expect(
      getVisibleLayers(layerRegistry, {
        toggles,
        viewMode: "coverage",
        zoom: 6.4,
        showRichnessCells: false
      }).map((layer) => layer.id)
    ).toEqual(["departments", "protected_areas", "species_markers"]);

    expect(
      getVisibleLayers(layerRegistry, {
        toggles,
        viewMode: "species",
        zoom: 8.5
      }).map((layer) => layer.id)
    ).toEqual(["departments", "protected_areas", "species_presence", "species_markers"]);
  });

  it("resolves provider-agnostic style, icon, and labels", () => {
    expect(
      resolveLayerStyle(layerRegistry.departments, departmentFeature, {
        viewMode: "coverage",
        zoom: 6.3
      }).fillColor
    ).toEqual([63, 111, 104, 108]);

    expect(
      resolveLayerStyle(layerRegistry.departments, departmentFeature, {
        viewMode: "coverage",
        zoom: 6.3,
        selected: true
      }).lineWidth
    ).toBe(3);

    expect(
      resolveLayerIcon(layerRegistry.species_markers, undefined, {
        viewMode: "coverage"
      })?.id
    ).toBe("search-result");

    expect(
      resolveLayerLabel(layerRegistry.species_markers, undefined, {
        viewMode: "species"
      })
    ).toBe("Marcadores de especie");
  });

  it("validates required properties and geometry safely", () => {
    expect(validateFeatureForLayer(publicHexFeature, layerRegistry.public_hex).valid).toBe(true);

    const invalidFeature: MapFeature = {
      ...publicHexFeature,
      properties: {
        id: "hex:1",
        kind: "public_hex",
        label: "Celda pública"
      }
    };

    const result = validateFeatureForLayer(invalidFeature, layerRegistry.public_hex);
    expect(result.valid).toBe(false);
    expect(result.missingRequiredProperties).toContain("speciesCount");
  });

  it("validates feature collections without throwing", () => {
    expect(
      validateFeatureCollectionForLayer(publicHexCollection, layerRegistry.public_hex).valid
    ).toBe(true);

    const invalidCollection: MapFeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          ...publicHexFeature,
          geometry: {
            type: "Point",
            coordinates: [-90.3, 15.4]
          }
        }
      ]
    };

    const result = validateFeatureCollectionForLayer(invalidCollection, layerRegistry.public_hex);
    expect(result.valid).toBe(false);
    expect(result.featureErrors[0]?.errors.join(" ")).toMatch(/geometry/i);
  });

  it("fails safely for unknown ids and empty registries", () => {
    expect(getLayerConfig("missing-layer")).toBeNull();
    expect(getOrderedLayers({})).toEqual([]);
    expect(getToggleableLayers({})).toEqual([]);
    expect(
      validateFeatureCollectionForLayer(publicHexCollection, getLayerConfig("missing-layer"))
    ).toMatchObject({
      valid: false
    });
  });
});
