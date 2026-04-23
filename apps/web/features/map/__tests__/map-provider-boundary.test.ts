import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { layerRegistry } from "@/features/map/registry/layerRegistry";

describe("map provider boundary", () => {
  it("keeps layer registry ids unique", () => {
    const layerIds = Object.values(layerRegistry).map((layer) => layer.id);
    expect(new Set(layerIds).size).toBe(layerIds.length);
  });

  it("keeps product map explorer on adapter factory boundary", () => {
    const fileContents = readFileSync(
      resolve(process.cwd(), "apps/web/components/map-explorer.tsx"),
      "utf8"
    );

    expect(fileContents).toMatch(/createMapAdapter/);
    expect(fileContents).not.toMatch(/MapLibreDeckAdapter/);
    expect(fileContents).not.toMatch(/LazyMapLibreDeckCanvas/);
    expect(fileContents).not.toMatch(/react-map-gl\/maplibre/);
  });
});
