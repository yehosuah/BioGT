import type { LngLat, MapBounds } from "@/features/map/core/MapTypes";

export const normalizeLngLat = (coordinate: LngLat): LngLat => [
  Number(coordinate[0]),
  Number(coordinate[1])
];

export const createMapBounds = (
  west: number,
  south: number,
  east: number,
  north: number
): MapBounds => [west, south, east, north];

export const getBoundsCenter = (bounds: MapBounds): LngLat => [
  (bounds[0] + bounds[2]) / 2,
  (bounds[1] + bounds[3]) / 2
];

export const toProviderBounds = (bounds: MapBounds): [[number, number], [number, number]] => [
  [bounds[0], bounds[1]],
  [bounds[2], bounds[3]]
];
