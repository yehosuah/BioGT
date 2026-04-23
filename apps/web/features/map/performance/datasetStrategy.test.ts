import { describe, expect, it } from "vitest";

import { getDatasetStrategy } from "@/features/map/performance/datasetStrategy";

describe("getDatasetStrategy", () => {
  it("classifies tiny datasets for direct render", () => {
    expect(getDatasetStrategy(80, "point")).toMatchObject({
      sizeClass: "tiny",
      shouldCluster: false,
      shouldUseViewportLoading: false
    });
  });

  it("classifies small datasets for direct render with lazy loading", () => {
    expect(getDatasetStrategy(500, "point")).toMatchObject({
      sizeClass: "small",
      shouldCluster: false,
      shouldLazyLoad: true
    });
  });

  it("classifies medium point datasets for clustering", () => {
    expect(getDatasetStrategy(5_000, "point")).toMatchObject({
      sizeClass: "medium",
      shouldCluster: true,
      shouldUseViewportLoading: false
    });
  });

  it("classifies large datasets for viewport loading", () => {
    expect(getDatasetStrategy(25_000, "polygon")).toMatchObject({
      sizeClass: "large",
      shouldCluster: false,
      shouldUseViewportLoading: true,
      shouldWarn: true
    });
  });

  it("classifies huge datasets for tile or fallback workflows", () => {
    expect(getDatasetStrategy(150_000, "point")).toMatchObject({
      sizeClass: "huge",
      shouldCluster: true,
      shouldUseViewportLoading: true,
      shouldUseVectorTiles: true
    });
  });

  it("does not cluster polygons or lines", () => {
    expect(getDatasetStrategy(5_000, "polygon").shouldCluster).toBe(false);
    expect(getDatasetStrategy(5_000, "line").shouldCluster).toBe(false);
  });
});
