import type { MapBounds, MapViewport } from "@/features/map/core/MapTypes";
import { createMapBounds } from "@/features/map/core/mapGeometry";

const DEFAULT_PADDING_FACTOR = 0.16;

const round = (value: number, precision = 4) => Number(value.toFixed(precision));

export const padBounds = (bounds: MapBounds, factor = DEFAULT_PADDING_FACTOR): MapBounds => {
  const width = bounds[2] - bounds[0];
  const height = bounds[3] - bounds[1];
  const lngPadding = width * factor;
  const latPadding = height * factor;

  return createMapBounds(
    round(bounds[0] - lngPadding),
    round(bounds[1] - latPadding),
    round(bounds[2] + lngPadding),
    round(bounds[3] + latPadding)
  );
};

const boundsDistance = (left: MapBounds, right: MapBounds) =>
  Math.abs(left[0] - right[0]) +
  Math.abs(left[1] - right[1]) +
  Math.abs(left[2] - right[2]) +
  Math.abs(left[3] - right[3]);

export const hasSignificantViewportChange = (
  previous: MapViewport | null,
  next: MapViewport,
  options: {
    minZoomDelta?: number;
    minBoundsDelta?: number;
  } = {}
) => {
  if (!previous) {
    return true;
  }

  const minZoomDelta = options.minZoomDelta ?? 0.2;
  const minBoundsDelta = options.minBoundsDelta ?? 0.08;

  if (Math.abs((previous.zoom ?? 0) - (next.zoom ?? 0)) >= minZoomDelta) {
    return true;
  }

  if (!previous.bounds || !next.bounds) {
    return true;
  }

  return boundsDistance(previous.bounds, next.bounds) >= minBoundsDelta;
};

export const formatViewportBounds = (bounds: MapBounds) =>
  [round(bounds[0]), round(bounds[1]), round(bounds[2]), round(bounds[3])].join(",");

export const buildViewportCacheKey = (bounds: MapBounds | undefined, zoom: number | undefined) =>
  bounds
    ? `${formatViewportBounds(bounds)}:z${round(zoom ?? 0, 1).toFixed(1)}`
    : `world:z${round(zoom ?? 0, 1).toFixed(1)}`;
