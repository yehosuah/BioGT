import type { Geometry } from "geojson";

import type { MapBounds, MapFeature } from "@/features/map/core/MapTypes";
import { createMapBounds } from "@/features/map/core/mapGeometry";

const visitCoordinates = (
  coordinates: unknown,
  visitor: (longitude: number, latitude: number) => void
): void => {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    visitor(coordinates[0], coordinates[1]);
    return;
  }

  coordinates.forEach((value) => {
    visitCoordinates(value, visitor);
  });
};

export const getFeatureBounds = (feature: MapFeature): MapBounds | null => {
  const geometry = feature.geometry as Geometry | null;
  if (!geometry) {
    return null;
  }

  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  const geometryCoordinates =
    geometry.type === "GeometryCollection"
      ? geometry.geometries.map((entry) => entry.type === "GeometryCollection" ? [] : entry.coordinates)
      : geometry.coordinates;

  visitCoordinates(geometryCoordinates, (longitude, latitude) => {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  });

  if (![west, south, east, north].every((value) => Number.isFinite(value))) {
    return null;
  }

  return createMapBounds(west, south, east, north);
};
