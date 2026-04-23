import { describe, expect, it } from "vitest";

import {
  normalizeRawLocationRecord,
  rawRecordsToFeatureCollection,
  recordToFeature,
  recordsToFeatureCollection
} from "@/features/map/data/geo/transformers";
import type { NormalizedMapRecord } from "@/features/map/data/geo/types";

describe("geo transformers", () => {
  it("normalizes raw lat lng records into point geometry", () => {
    const result = normalizeRawLocationRecord({
      _id: "place-1",
      title: "Cafe Aurora",
      type: "restaurant",
      state: "active",
      lat: 14.6349,
      lng: -90.5069,
      source: "fixture"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.geometry).toEqual({
      type: "Point",
      coordinates: [-90.5069, 14.6349]
    });
  });

  it("preserves provided geometry when raw record already has it", () => {
    const result = normalizeRawLocationRecord({
      id: "route-1",
      name: "Research Route",
      category: "route",
      status: "planned",
      geometry: {
        type: "LineString",
        coordinates: [
          [-90.55, 14.6],
          [-90.5, 14.65]
        ]
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.geometry.type).toBe("LineString");
  });

  it("creates features with stable root and property ids", () => {
    const feature = recordToFeature({
      id: "zone-1",
      name: "Protection Zone",
      category: "conservation",
      status: "active",
      source: "fixture",
      updatedAt: "2026-04-18T00:00:00.000Z",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-90.55, 14.62],
            [-90.5, 14.62],
            [-90.5, 14.66],
            [-90.55, 14.62]
          ]
        ]
      },
      metadata: {
        riskLevel: "medium"
      }
    });

    expect(feature.id).toBe("zone-1");
    expect(feature.properties.id).toBe("zone-1");
    expect(feature.properties.riskLevel).toBe("medium");
  });

  it("respects skipInvalid option in raw collection pipeline", () => {
    const strictResult = rawRecordsToFeatureCollection([
      {
        id: "valid-1",
        name: "Valid",
        category: "store",
        status: "active",
        latitude: 14.63,
        longitude: -90.5
      },
      {
        id: "invalid-1",
        name: "Invalid",
        category: "store",
        status: "active",
        latitude: 200,
        longitude: -90.5
      }
    ]);

    expect(strictResult.ok).toBe(false);

    const skipResult = rawRecordsToFeatureCollection(
      [
        {
          id: "valid-1",
          name: "Valid",
          category: "store",
          status: "active",
          latitude: 14.63,
          longitude: -90.5
        },
        {
          id: "invalid-1",
          name: "Invalid",
          category: "store",
          status: "active",
          latitude: 200,
          longitude: -90.5
        }
      ],
      { skipInvalid: true }
    );

    expect(skipResult.ok).toBe(true);
    if (!skipResult.ok) {
      return;
    }

    expect(skipResult.data.features).toHaveLength(1);
    expect(skipResult.data.features[0]?.properties.id).toBe("valid-1");
  });

  it("does not mutate input records when building feature collections", () => {
    const records: NormalizedMapRecord[] = [
      {
        id: "place-1",
        name: "Museum",
        category: "school",
        status: "active",
        geometry: {
          type: "Point",
          coordinates: [-90.5069, 14.6349]
        },
        metadata: {
          priority: "high"
        }
      }
    ];

    const snapshot = structuredClone(records);
    const result = recordsToFeatureCollection(records);

    expect(result.ok).toBe(true);
    expect(records).toEqual(snapshot);
  });
});
