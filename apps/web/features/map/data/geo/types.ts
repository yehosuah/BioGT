import type {
  Feature as GeoJSONFeature,
  FeatureCollection as GeoJSONFeatureCollection,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon
} from "geojson";

import type { SUPPORTED_GEOMETRY_TYPES } from "@/features/map/data/geo/constants";

export type LngLat = [longitude: number, latitude: number];

export type GeometryCategory = (typeof SUPPORTED_GEOMETRY_TYPES)[number];

export type MapGeometry = Point | LineString | Polygon | MultiPoint | MultiLineString | MultiPolygon;

export interface BaseMapProperties {
  id: string;
  name: string;
  category: string;
  status: string;
  source?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface NormalizedMapRecord {
  id: string;
  name: string;
  category: string;
  status: string;
  geometry: MapGeometry;
  source?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export type MapFeature<P extends BaseMapProperties = BaseMapProperties> = Omit<
  GeoJSONFeature<MapGeometry, P>,
  "id"
> & {
  id?: string | number;
};

export type MapFeatureCollection<P extends BaseMapProperties = BaseMapProperties> =
  GeoJSONFeatureCollection<MapGeometry, P>;

export type Result<T> = { ok: true; data: T } | { ok: false; errors: string[] };

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FeatureCollectionValidationResult extends ValidationResult {
  featureErrors: Array<{
    index: number;
    id?: string;
    errors: string[];
  }>;
}

export interface RawRecordTransformOptions {
  skipInvalid?: boolean;
  defaultCategory?: string;
  defaultStatus?: string;
  defaultSource?: string;
}
