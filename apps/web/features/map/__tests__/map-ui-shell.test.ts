import { describe, expect, it } from "vitest";

import { getFeatureBounds } from "@/features/map/data/geo/bounds";
import {
  buildAreaSelectedFeature,
  buildSearchSelectedFeature,
  buildSpeciesSelectedFeature,
  clearSelectedFeature,
  selectFeature
} from "@/features/map/state/mapUiState";
import { getToggleableLayers, layerRegistry } from "@/features/map/registry/layerRegistry";

describe("mapUiState", () => {
  it("stores and clears selected feature state", () => {
    const selected = buildAreaSelectedFeature({
      featureId: "alta-verapaz",
      scopeType: "department",
      scopeId: "alta-verapaz",
      title: "Alta Verapaz",
      category: "Departamento",
      status: "Activa",
      properties: {
        speciesCount: 330,
        protectedCount: 4
      }
    });

    expect(selectFeature(null, selected)).toEqual(selected);
    expect(clearSelectedFeature(selected)).toBeNull();
  });

  it("builds species metadata without dumping raw JSON", () => {
    const selected = buildSpeciesSelectedFeature({
      featureId: "quetzal",
      slug: "quetzal",
      title: "Quetzal",
      scientificName: "Pharomachrus mocinno",
      category: "Ave",
      status: "Visible",
      summary: "Presencia pública agregada.",
      metadata: {
        heroMetric: "24 registros públicos",
        latestObservedAt: "2026-03-01",
        sourceTier: "official"
      }
    });

    expect(selected.metadata).toEqual([
      { label: "heroMetric", value: "24 registros públicos" },
      { label: "latestObservedAt", value: "2026-03-01" },
      { label: "sourceTier", value: "official" }
    ]);
  });

  it("creates typed search selections for area and species results", () => {
    expect(
      buildSearchSelectedFeature({
        id: "area-1",
        slug: "alta-verapaz",
        type: "area",
        title: "Alta Verapaz",
        subtitle: "Departamento",
        href: "/areas/alta-verapaz"
      })
    ).toMatchObject({
      kind: "area",
      title: "Alta Verapaz"
    });

    expect(
      buildSearchSelectedFeature({
        id: "species-1",
        slug: "quetzal",
        type: "species",
        title: "Quetzal",
        subtitle: "Pharomachrus mocinno",
        href: "/species/quetzal"
      })
    ).toMatchObject({
      kind: "species",
      scientificName: "Pharomachrus mocinno"
    });
  });
});

describe("map geometry helpers", () => {
  it("derives bounds from polygon geometry", () => {
    const bounds = getFeatureBounds({
      id: "hex-1",
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-90.4, 15.3],
            [-90.2, 15.3],
            [-90.2, 15.5],
            [-90.4, 15.5],
            [-90.4, 15.3]
          ]
        ]
      },
      properties: {
        id: "hex-1",
        label: "Celda pública"
      }
    });

    expect(bounds).toEqual([-90.4, 15.3, -90.2, 15.5]);
  });
});

describe("layer registry shell inputs", () => {
  it("exposes toggleable coverage layers for UI controls", () => {
    expect(
      getToggleableLayers(layerRegistry, {
        viewMode: "coverage",
        showRichnessCells: true
      }).map((layer) => layer.id)
    ).toEqual(["departments", "protected_areas", "public_hex", "species_markers"]);
  });
});
