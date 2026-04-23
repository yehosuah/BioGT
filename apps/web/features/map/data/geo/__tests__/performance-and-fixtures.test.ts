import { describe, expect, it } from "vitest";

import { recordsToFeatureCollection } from "@/features/map/data/geo/transformers";
import { validateFeatureCollection } from "@/features/map/data/geo/validation";
import {
  emptyFeatureCollectionFixture,
  invalidFeatureFixture
} from "@/features/map/testing/mapTestFixtures";

describe("GeoJSON fixtures", () => {
  it("accepts empty FeatureCollection", () => {
    expect(validateFeatureCollection(emptyFeatureCollectionFixture).valid).toBe(true);
  });

  it("rejects invalid geometry safely", () => {
    expect(
      validateFeatureCollection({
        type: "FeatureCollection",
        features: [invalidFeatureFixture]
      }).valid
    ).toBe(false);
  });
});

describe("Map performance safeguards", () => {
  it("transforms moderate datasets without dropping ids or extra properties", () => {
    const records = Array.from({ length: 2_000 }, (_, index) => ({
      id: `id-${index}`,
      name: `Place ${index}`,
      category: index % 2 === 0 ? "bird" : "flora",
      status: "visible",
      source: "fixture",
      updatedAt: "2026-04-01",
      metadata: {
        extra: `value-${index}`
      },
      geometry: {
        type: "Point" as const,
        coordinates: [-90.5 + index / 10_000, 14.6 + index / 10_000]
      }
    }));

    const startedAt = performance.now();
    const result = recordsToFeatureCollection(records);
    const durationMs = performance.now() - startedAt;

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.features).toHaveLength(2_000);
    expect(result.data.features[1999]?.id).toBe("id-1999");
    expect(result.data.features[1999]?.properties?.extra).toBe("value-1999");
    expect(durationMs).toBeLessThan(500);
  });
});
