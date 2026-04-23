import { describe, expect, it } from "vitest";

import { buildLayerLoadState } from "@/features/map/performance/mapLoadingState";
import { getDatasetStrategy } from "@/features/map/performance/datasetStrategy";
import { getLayerConfig } from "@/features/map/registry/layerRegistry";

describe("buildLayerLoadState", () => {
  const layer = getLayerConfig("public_hex");

  it("returns ready state when features exist", () => {
    expect(
      buildLayerLoadState({
        layer,
        status: "ready",
        featureCount: 12
      })
    ).toMatchObject({
      status: "ready",
      featureCount: 12
    });
  });

  it("returns empty state", () => {
    expect(
      buildLayerLoadState({
        layer,
        status: "empty",
        featureCount: 0
      })
    ).toMatchObject({
      status: "empty"
    });
  });

  it("returns error state", () => {
    expect(
      buildLayerLoadState({
        layer,
        status: "error",
        errors: ["boom"]
      })
    ).toMatchObject({
      status: "error",
      errors: ["boom"]
    });
  });

  it("returns too_large state", () => {
    expect(
      buildLayerLoadState({
        layer,
        status: "too_large",
        featureCount: 150_000,
        strategy: getDatasetStrategy(150_000, "polygon")
      })
    ).toMatchObject({
      status: "too_large",
      featureCount: 150_000
    });
  });
});
