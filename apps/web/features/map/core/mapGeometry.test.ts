import { describe, expect, it } from "vitest";

import {
  createMapBounds,
  getBoundsCenter,
  normalizeLngLat,
  toProviderBounds
} from "@/features/map/core/mapGeometry";

describe("mapGeometry", () => {
  it("preserves lng lat coordinate convention", () => {
    expect(normalizeLngLat([-90.5123, 14.6349])).toEqual([-90.5123, 14.6349]);
  });

  it("preserves west south east north bounds convention", () => {
    expect(createMapBounds(-91.2, 14.1, -89.8, 16.7)).toEqual([-91.2, 14.1, -89.8, 16.7]);
  });

  it("converts tuple bounds into provider corner pairs without reordering", () => {
    expect(toProviderBounds([-91.2, 14.1, -89.8, 16.7])).toEqual([
      [-91.2, 14.1],
      [-89.8, 16.7]
    ]);
  });

  it("computes bounds center from tuple bounds", () => {
    const [longitude, latitude] = getBoundsCenter([-91.2, 14.1, -89.8, 16.7]);
    expect(longitude).toBeCloseTo(-90.5);
    expect(latitude).toBeCloseTo(15.4);
  });
});
