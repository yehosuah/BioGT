import { describe, expect, it } from "vitest";

import {
  isValidGeometry,
  isValidLngLat,
  validateFeature,
  validateFeatureCollection
} from "@/features/map/data/geo/validation";
import type { MapFeatureCollection } from "@/features/map/data/geo/types";

describe("geo validation", () => {
  it("accepts valid longitude latitude pairs", () => {
    expect(isValidLngLat([-90.5069, 14.6349])).toBe(true);
  });

  it("rejects invalid longitude or latitude pairs", () => {
    expect(isValidLngLat([-181, 14.6349])).toBe(false);
    expect(isValidLngLat([-90.5069, 91])).toBe(false);
    expect(isValidLngLat([Number.NaN, 14.6349])).toBe(false);
  });

  it("validates point geometry", () => {
    expect(
      isValidGeometry({
        type: "Point",
        coordinates: [-90.5069, 14.6349]
      })
    ).toBe(true);
  });

  it("validates linestring geometry", () => {
    expect(
      isValidGeometry({
        type: "LineString",
        coordinates: [
          [-90.52, 14.61],
          [-90.49, 14.63]
        ]
      })
    ).toBe(true);
  });

  it("validates polygon geometry", () => {
    expect(
      isValidGeometry({
        type: "Polygon",
        coordinates: [
          [
            [-90.55, 14.62],
            [-90.5, 14.62],
            [-90.5, 14.66],
            [-90.55, 14.62]
          ]
        ]
      })
    ).toBe(true);
  });

  it("fails feature validation when id is missing", () => {
    const result = validateFeature({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-90.5069, 14.6349]
      },
      properties: {
        name: "Unnamed",
        category: "reference",
        status: "active"
      }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Feature is missing id");
  });

  it("fails feature validation when geometry is missing", () => {
    const result = validateFeature({
      type: "Feature",
      properties: {
        id: "missing-geometry",
        name: "Broken",
        category: "reference",
        status: "inactive"
      }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Feature has invalid geometry");
  });

  it("passes valid feature collections", () => {
    const result = validateFeatureCollection({
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
            name: "Central Park",
            category: "park",
            status: "active",
            source: "fixture",
            updatedAt: "2026-04-18T00:00:00.000Z"
          }
        }
      ]
    } satisfies MapFeatureCollection);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns structured errors for invalid feature collections", () => {
    const result = validateFeatureCollection({
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
            name: "Central Park",
            category: "park",
            status: "active"
          }
        },
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-190, 14.6349]
          },
          properties: {
            id: "broken",
            name: "Broken Feature",
            category: "park",
            status: "active"
          }
        }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.featureErrors).toEqual([
      {
        index: 1,
        id: "broken",
        errors: ["Feature has invalid geometry"]
      }
    ]);
  });
});
