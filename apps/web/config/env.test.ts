import { describe, expect, it } from "vitest";

import { createAppEnv, validateMapEnvironment } from "@/config/env";

describe("createAppEnv", () => {
  it("reads valid provider and parses viewport values", () => {
    const env = createAppEnv({
      NEXT_PUBLIC_MAP_PROVIDER: "maplibre",
      NEXT_PUBLIC_DEFAULT_LAT: "14.6349",
      NEXT_PUBLIC_DEFAULT_LNG: "-90.5069",
      NEXT_PUBLIC_DEFAULT_ZOOM: "9.5"
    });

    expect(env.map.provider).toBe("maplibre");
    expect(env.map.defaultCenter).toEqual({
      lat: 14.6349,
      lng: -90.5069
    });
    expect(env.map.defaultZoom).toBe(9.5);
  });

  it("parses booleans safely", () => {
    const env = createAppEnv({
      NEXT_PUBLIC_ENABLE_MAP_DEBUG: "true",
      NEXT_PUBLIC_ENABLE_MAP_TELEMETRY: "0"
    });

    expect(env.map.debug).toBe(true);
    expect(env.map.telemetry).toBe(false);
  });
});

describe("validateMapEnvironment", () => {
  it("rejects invalid providers", () => {
    const validation = validateMapEnvironment(
      createAppEnv({
        NEXT_PUBLIC_MAP_PROVIDER: "bad-provider"
      })
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(" ")).toMatch(/provider/i);
  });

  it("reports missing Mapbox token when provider is mapbox", () => {
    const validation = validateMapEnvironment(
      createAppEnv({
        NEXT_PUBLIC_MAP_PROVIDER: "mapbox"
      })
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(" ")).toContain("NEXT_PUBLIC_MAPBOX_TOKEN");
  });

  it("reports missing Google key when provider is google", () => {
    const validation = validateMapEnvironment(
      createAppEnv({
        NEXT_PUBLIC_MAP_PROVIDER: "google"
      })
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(" ")).toContain("NEXT_PUBLIC_GOOGLE_MAPS_KEY");
  });
});
