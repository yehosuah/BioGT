import { describe, expect, it } from "vitest";

import {
  getSpecies,
  getLayerCollection,
  getMapMarkers,
  getMapPanel,
  getMapSpeciesPanel,
  getMapSummary,
  listSpecies,
  searchEntities
} from "@/lib/repository";

describe("public geoprivacy", () => {
  it("never exposes exact occurrence coordinates in public hex mode", async () => {
    const collection = await getLayerCollection("public_hex");
    const exactSensitiveLng = -89.6239;
    const exactSensitiveLat = 17.2344;
    const polygons = JSON.stringify(collection.features);

    expect(polygons.includes(String(exactSensitiveLng))).toBe(false);
    expect(polygons.includes(String(exactSensitiveLat))).toBe(false);
  });
});

describe("search index", () => {
  it("returns area and species matches", async () => {
    const areaResults = await searchEntities("Lachuá");
    const speciesResults = await searchEntities("quetzal");

    expect(areaResults.some((entry) => entry.type === "area")).toBe(true);
    expect(speciesResults.some((entry) => entry.type === "species")).toBe(true);
  });
});

describe("map explorer panel", () => {
  it("uses canonical sources by default for summary metrics", async () => {
    const summary = await getMapSummary();

    expect(summary.metrics.visibleOccurrences).toBe(17);
    expect(summary.metrics.activeSources).toBe(2);
    expect(summary.filterOptions.taxonScopes).toEqual(["all", "flora", "fauna"]);
  });

  it("returns a selection-driven species panel with visuals and quick facts", async () => {
    const panel = await getMapPanel({
      scopeType: "department",
      scopeId: "alta-verapaz"
    });

    expect(panel.selection.scopeId).toBe("alta-verapaz");
    expect(panel.selection.metrics.visibleSpecies).toBeGreaterThan(0);
    expect(panel.species[0]?.visual.fallbackLabel).toBeTruthy();
    expect(panel.species[0]?.quickFacts.length).toBeGreaterThan(0);
  });

  it("uses stable public hex ids for layer selection", async () => {
    const collection = await getLayerCollection("public_hex");
    const featureId = String(collection.features[0]?.properties?.id ?? "");

    expect(featureId.startsWith("hex:")).toBe(true);
  });

  it("returns a species-mode panel with public place coverage", async () => {
    const speciesPanel = await getMapSpeciesPanel({
      taxonSlug: "jaguar"
    });

    expect(speciesPanel.focusSpecies.slug).toBe("jaguar");
    expect(speciesPanel.metrics.visibleCells).toBeGreaterThan(0);
    expect(speciesPanel.places.some((place) => place.scopeType === "protected_area")).toBe(true);
  });

  it("keeps species presence layers generalized in species mode", async () => {
    const collection = await getLayerCollection(
      "species_presence",
      {
        taxonSlug: "jaguar"
      },
      {}
    );
    const polygons = JSON.stringify(collection.features);

    expect(polygons.includes(String(-89.6239))).toBe(false);
    expect(polygons.includes(String(17.2344))).toBe(false);
    expect(collection.features[0]?.properties?.kind).toBe("species_presence");
  });

  it("returns at most three coverage preview markers for the active selection", async () => {
    const markerResponse = await getMapMarkers({
      mode: "coverage_preview",
      scopeType: "department",
      scopeId: "alta-verapaz"
    });

    expect(markerResponse.mode).toBe("coverage_preview");
    expect(markerResponse.markers.length).toBeLessThanOrEqual(3);
    expect(markerResponse.markers[0]?.scopeRef.scopeType).toBe("public_hex");
  });

  it("keeps species markers generalized and filter-aware", async () => {
    const markerResponse = await getMapMarkers({
      mode: "species_presence",
      filters: {
        taxonSlug: "jaguar",
        protectedOnly: true,
        dateRange: "12m"
      }
    });
    const markers = JSON.stringify(markerResponse.markers);

    expect(markers.includes(String(-89.6239))).toBe(false);
    expect(markers.includes(String(17.2344))).toBe(false);
    expect(markerResponse.markers.every((marker) => marker.mode === "species_presence")).toBe(true);
  });
});

describe("species cards", () => {
  it("surfaces reusable visuals for public-facing species records", async () => {
    const species = await listSpecies();
    const active = await getSpecies("quetzal");

    expect(species[0]?.visual).toMatchObject({
      kind: expect.any(String),
      fallbackLabel: expect.any(String),
      accent: expect.any(String)
    });
    expect(active?.visual).toMatchObject({
      kind: expect.any(String),
      alt: expect.stringContaining(active?.commonName ?? "")
    });
  });
});
