import type {
  BaseMapProperties,
  LngLat,
  MapFeature,
  MapFeatureCollection
} from "@/features/map/data/geo/types";

export type MapProviderName =
  | "null"
  | "mapbox"
  | "maplibre"
  | "leaflet"
  | "google-maps"
  | "openlayers"
  | "arcgis"
  | (string & {});

export type MapCoordinates = LngLat;

export interface MapBounds {
  southwest: MapCoordinates;
  northeast: MapCoordinates;
}

export interface MapViewport {
  center: MapCoordinates;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface MapInitOptions {
  provider: MapProviderName;
  viewport: MapViewport;
  bounds?: MapBounds;
  interactive?: boolean;
}

export type MapFeatureId = string;

export type MapFeatureProperties = BaseMapProperties;

export type MapGeometryType =
  | "Point"
  | "LineString"
  | "Polygon"
  | "MultiPoint"
  | "MultiLineString"
  | "MultiPolygon";

export type { MapFeature, MapFeatureCollection };

export type MapLayerId = string;
export type MapLayerType = "point" | "line" | "polygon" | "raster" | "symbol";
export type MapLayerVisibility = "visible" | "hidden";

export interface MapLayerConfig {
  id: MapLayerId;
  type: MapLayerType;
  visibility: MapLayerVisibility;
  interactive: boolean;
  minZoom?: number;
  maxZoom?: number;
  zIndex?: number;
  data?: MapFeatureCollection;
  metadata?: Record<string, unknown>;
}

export type MapInteractionType =
  | "feature-click"
  | "map-click"
  | "hover"
  | "select"
  | "viewport-change";

export interface MapFeatureClickEvent {
  type: "feature-click";
  layerId: MapLayerId;
  feature: MapFeature;
  coordinates?: MapCoordinates;
}

export interface MapClickEvent {
  type: "map-click";
  coordinates: MapCoordinates;
}

export type FeatureClickHandler = (event: MapFeatureClickEvent) => void;
export type MapClickHandler = (event: MapClickEvent) => void;

export type MapAdapterStatus = "idle" | "initializing" | "ready" | "destroyed" | "error";
