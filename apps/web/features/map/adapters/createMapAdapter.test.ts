import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ArcGISAdapter } from "@/features/map/adapters/ArcGISAdapter";
import { createMapAdapter } from "@/features/map/adapters/createMapAdapter";
import { GoogleMapsAdapter } from "@/features/map/adapters/GoogleMapsAdapter";
import { LeafletAdapter } from "@/features/map/adapters/LeafletAdapter";
import { MapLibreAdapter } from "@/features/map/adapters/MapLibreAdapter";
import { MapboxAdapter } from "@/features/map/adapters/MapboxAdapter";

const placeholderContainer = { id: "placeholder-map" } as HTMLElement;

describe("createMapAdapter", () => {
  it("returns maplibre adapter for current provider", () => {
    const adapter = createMapAdapter({
      provider: "maplibre"
    });

    expect(adapter).toBeInstanceOf(MapLibreAdapter);
  });

  it("returns typed placeholder adapters for planned providers", () => {
    expect(
      createMapAdapter({
        provider: "mapbox"
      })
    ).toBeInstanceOf(MapboxAdapter);
    expect(
      createMapAdapter({
        provider: "leaflet"
      })
    ).toBeInstanceOf(LeafletAdapter);
    expect(
      createMapAdapter({
        provider: "google"
      })
    ).toBeInstanceOf(GoogleMapsAdapter);
    expect(
      createMapAdapter({
        provider: "arcgis"
      })
    ).toBeInstanceOf(ArcGISAdapter);
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      createMapAdapter({
        provider: "openlayers"
      })
    ).toThrow(/unsupported map provider/i);
  });

  it("placeholder adapters fail with clear install errors instead of importing SDKs", async () => {
    const placeholderAdapters = [
      new MapboxAdapter(),
      new LeafletAdapter(),
      new GoogleMapsAdapter(),
      new ArcGISAdapter()
    ];

    await Promise.all(
      placeholderAdapters.map(async (adapter) => {
        await expect(
          adapter.initialize(placeholderContainer, {
            provider: "maplibre",
            center: [-90.25, 15.68],
            zoom: 6
          })
        ).rejects.toThrow(/provider not installed/i);
      })
    );
  });

  it("placeholder adapters do not import unavailable SDK packages", () => {
    const placeholderFiles = [
      "MapboxAdapter.ts",
      "LeafletAdapter.ts",
      "GoogleMapsAdapter.ts",
      "ArcGISAdapter.ts"
    ];

    placeholderFiles.forEach((fileName) => {
      const fileContents = readFileSync(
        resolve(process.cwd(), "apps/web/features/map/adapters", fileName),
        "utf8"
      );

      expect(fileContents).not.toMatch(/from\s+["']leaflet["']/);
      expect(fileContents).not.toMatch(/from\s+["']@arcgis\//);
      expect(fileContents).not.toMatch(/from\s+["']mapbox-gl["']/);
      expect(fileContents).not.toMatch(/from\s+["']google\.maps["']/);
      expect(fileContents).not.toMatch(/from\s+["']@googlemaps\//);
    });
  });
});
