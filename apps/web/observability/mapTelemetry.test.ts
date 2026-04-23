import { describe, expect, it } from "vitest";

import { sanitizeTelemetryPayload } from "@/observability/mapTelemetry";

describe("sanitizeTelemetryPayload", () => {
  it("strips geometry coordinates", () => {
    const payload = sanitizeTelemetryPayload({
      layerId: "species_presence",
      coordinates: [-90.5, 14.6],
      latitude: 14.6,
      longitude: -90.5
    });

    expect(payload).toEqual({
      layerId: "species_presence"
    });
  });

  it("preserves safe metadata", () => {
    const payload = sanitizeTelemetryPayload({
      layerId: "species_presence",
      featureCount: 42,
      durationMs: 180,
      provider: "maplibre",
      status: "ready"
    });

    expect(payload).toEqual({
      layerId: "species_presence",
      featureCount: 42,
      durationMs: 180,
      provider: "maplibre",
      status: "ready"
    });
  });

  it("excludes raw geojson payloads", () => {
    const payload = sanitizeTelemetryPayload({
      layerId: "species_presence",
      geojson: {
        type: "FeatureCollection",
        features: []
      }
    });

    expect(payload).toEqual({
      layerId: "species_presence"
    });
  });

  it("does not throw on unknown payloads", () => {
    expect(() => sanitizeTelemetryPayload(Symbol("telemetry"))).not.toThrow();
  });
});
