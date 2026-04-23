import { describe, expect, it } from "vitest";

import { iconMetadata } from "@/features/map/assets/iconMetadata";
import {
  getIconForCategory,
  getIconForFeature,
  getMapIcon
} from "@/features/map/assets/iconRegistry";

describe("map icon registry", () => {
  it("returns fallback for unknown icons", () => {
    expect(getMapIcon("missing-icon").id).toBe("default-place");
  });

  it("maps known categories", () => {
    expect(getIconForCategory("food").id).toBe("restaurant");
    expect(getIconForCategory("poi").id).toBe("service");
  });

  it("maps selected, cluster, alert, and fallback feature cases", () => {
    expect(getIconForFeature({ selected: true }).id).toBe("selected-place");
    expect(getIconForFeature({ isCluster: true }).id).toBe("cluster");
    expect(getIconForFeature({ status: "alert" }).id).toBe("alert");
    expect(getIconForFeature({ category: "unknown" }).id).toBe("default-place");
  });

  it("maps route and search feature hints", () => {
    expect(getIconForFeature({ isRouteStart: true }).id).toBe("route-start");
    expect(getIconForFeature({ isRouteEnd: true }).id).toBe("route-end");
    expect(getIconForFeature({ mode: "coverage_preview" }).id).toBe("search-result");
  });

  it("ensures every icon entry has label and default size", () => {
    Object.values(iconMetadata).forEach((entry) => {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.defaultSize).toBeGreaterThan(0);
    });
  });

  it("ensures every icon has metadata", () => {
    expect(Object.keys(iconMetadata).length).toBeGreaterThan(0);
    expect(iconMetadata["default-place"]).toBeDefined();
    expect(iconMetadata["protected-area"]).toBeDefined();
  });
});
