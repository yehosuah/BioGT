import type { MapBounds, MapCoordinates } from "@/features/map/core/MapTypes";
import { createMapBounds } from "@/features/map/core/mapGeometry";
import type { MapSpeciesMarker } from "@/lib/types";

export type ClusteredMarkerResult =
  | {
      kind: "marker";
      marker: MapSpeciesMarker;
    }
  | {
      kind: "cluster";
      id: string;
      coordinate: MapCoordinates;
      count: number;
      bounds: MapBounds;
      markers: MapSpeciesMarker[];
    };

type ClusterOptions = {
  clusterRadiusPx?: number;
  maxZoom?: number;
  minClusterCount?: number;
};

type ClusterBucket = {
  count: number;
  longitudeTotal: number;
  latitudeTotal: number;
  west: number;
  south: number;
  east: number;
  north: number;
  markers: MapSpeciesMarker[];
};

const toWorld = (longitude: number, latitude: number, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const x = ((longitude + 180) / 360) * scale;
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  const y =
    (0.5 -
      Math.log((1 + Math.min(Math.max(sinLatitude, -0.9999), 0.9999)) /
        (1 - Math.min(Math.max(sinLatitude, -0.9999), 0.9999))) /
        (4 * Math.PI)) *
    scale;

  return { x, y };
};

export const clusterMarkers = (
  markers: MapSpeciesMarker[],
  zoom: number,
  options: ClusterOptions = {}
): ClusteredMarkerResult[] => {
  const clusterRadiusPx = options.clusterRadiusPx ?? 64;
  const maxZoom = options.maxZoom ?? 8.75;
  const minClusterCount = options.minClusterCount ?? 3;

  if (markers.length < minClusterCount || zoom > maxZoom) {
    return markers.map((marker) => ({
      kind: "marker",
      marker
    }));
  }

  const buckets = new Map<string, ClusterBucket>();

  for (const marker of markers) {
    const { x, y } = toWorld(marker.point.longitude, marker.point.latitude, zoom);
    const key = `${Math.floor(x / clusterRadiusPx)}:${Math.floor(y / clusterRadiusPx)}`;
    const bucket = buckets.get(key) ?? {
      count: 0,
      longitudeTotal: 0,
      latitudeTotal: 0,
      west: marker.point.longitude,
      south: marker.point.latitude,
      east: marker.point.longitude,
      north: marker.point.latitude,
      markers: []
    };

    bucket.count += 1;
    bucket.longitudeTotal += marker.point.longitude;
    bucket.latitudeTotal += marker.point.latitude;
    bucket.west = Math.min(bucket.west, marker.point.longitude);
    bucket.south = Math.min(bucket.south, marker.point.latitude);
    bucket.east = Math.max(bucket.east, marker.point.longitude);
    bucket.north = Math.max(bucket.north, marker.point.latitude);
    bucket.markers.push(marker);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries()).flatMap<ClusteredMarkerResult>(([key, bucket]) => {
    if (bucket.count < minClusterCount) {
      return bucket.markers.map((marker) => ({
        kind: "marker" as const,
        marker
      }));
    }

    return [
      {
        kind: "cluster" as const,
        id: `cluster:${key}`,
        coordinate: [bucket.longitudeTotal / bucket.count, bucket.latitudeTotal / bucket.count],
        count: bucket.count,
        bounds: createMapBounds(bucket.west, bucket.south, bucket.east, bucket.north),
        markers: bucket.markers
      }
    ];
  });
};
