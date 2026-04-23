import { describe, expect, it } from "vitest";

import {
  filterFeatureCollection,
  groupFeaturesByProperty
} from "@/features/map/data/geo/featureCollection";
import type { MapFeatureCollection } from "@/features/map/data/geo/types";

const collection: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      id: "place-1",
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-90.5069, 14.6349]
      },
      properties: {
        id: "place-1",
        name: "Hospital One",
        category: "hospital",
        status: "active",
        source: "fixture",
        updatedAt: "2026-04-18T00:00:00.000Z"
      }
    },
    {
      id: "place-2",
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-90.48, 14.61]
      },
      properties: {
        id: "place-2",
        name: "School Two",
        category: "school",
        status: "inactive",
        source: "fixture",
        updatedAt: "2026-04-18T00:00:00.000Z"
      }
    },
    {
      id: "place-3",
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-90.47, 14.64]
      },
      properties: {
        id: "place-3",
        name: "Hospital Three",
        category: "hospital",
        status: "active",
        source: "fixture",
        updatedAt: "2026-04-18T00:00:00.000Z"
      }
    }
  ]
};

describe("feature collection helpers", () => {
  it("groups features by property value", () => {
    const grouped = groupFeaturesByProperty(collection, "category");

    expect(Object.keys(grouped)).toEqual(["hospital", "school"]);
    expect(grouped.hospital).toHaveLength(2);
    expect(grouped.school).toHaveLength(1);
  });

  it("filters feature collections without mutating original collection", () => {
    const snapshot = structuredClone(collection);
    const filtered = filterFeatureCollection(
      collection,
      (feature) => feature.properties.status === "active"
    );

    expect(filtered.features).toHaveLength(2);
    expect(collection).toEqual(snapshot);
    expect(filtered).not.toBe(collection);
    expect(filtered.features).not.toBe(collection.features);
  });
});
