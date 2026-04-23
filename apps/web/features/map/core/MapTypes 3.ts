import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";

export type MapProviderName =
  | "null"
  | "mapbox"
  | "maplibre"
  | "leaflet"
  | "google-maps"
  | "openlayers"
  | "arcgis"
  | (string & {});

export type Coordinate = [longitude: number, latitude: number];
export type MapCoordinates = Coordinate;

export interface MapBounds {
  southwest: Coordinate;
  northeast: Coordinate;
}

export interface MapViewport {
  center: Coordinate;
  zoom: number;
  bearing?: number;
  pitch?: number;
  bounds?: MapBounds;
}

export type MapScreenPoint = {
  x: number;
  y: number;
};

export interface MapInitOptions {
  provider: MapProviderName;
  center: Coordinate;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  styleUrl?: string;
  accessToken?: string;
  interactive?: boolean;
  bounds?: MapBounds;
  bearing?: number;
  pitch?: number;
}

export type MapFeature = Feature<Geometry, GeoJsonProperties>;
export type MapFeatureCollection = FeatureCollection<Geometry, GeoJsonProperties>;
export type MapFeatureId = string | number;

export type MapLayerId = string;
export type MapGeometryType = "point" | "line" | "polygon" | "mixed";
export type MapLayerType = MapGeometryType;
export type MapLayerKind =
  | "symbol"
  | "circle"
  | "line"
  | "fill"
  | "heatmap"
  | "cluster"
  | "custom";
export type MapLayerRenderMode = "geojson" | "marker-overlay" | "custom";
export type MapLayerDataShape = "geojson" | "marker-list" | "unknown";
export type MapLayerVisibility = "visible" | "hidden";
export type MapAdapterStatus = "idle" | "initializing" | "ready" | "destroyed" | "error";
export type MapColor = [red: number, green: number, blue: number, alpha: number];

export interface MapLayerResolverContext {
  layerId?: MapLayerId;
  feature?: MapFeature;
  zoom?: number;
  selected?: boolean;
  hovered?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  viewMode?: string;
  showRichnessCells?: boolean;
  selection?: {
    scopeType?: string;
    scopeId?: string;
  } | null;
}

export type MapLayerStyleContext = MapLayerResolverContext & {
  feature: MapFeature;
  zoom: number;
};

export type MapDynamicValue<T> = T | ((context: MapLayerResolverContext) => T);
export type MapStyleValue<T> = MapDynamicValue<T>;

export interface MapLayerStyle {
  fillColor?: MapStyleValue<MapColor>;
  lineColor?: MapStyleValue<MapColor>;
  lineWidth?: MapStyleValue<number>;
  pointRadius?: MapStyleValue<number>;
  pointColor?: MapStyleValue<MapColor>;
  opacity?: MapStyleValue<number>;
  textColor?: MapStyleValue<MapColor>;
  textHaloColor?: MapStyleValue<MapColor>;
  textSize?: MapStyleValue<number>;
}

export interface MapLayerResolvedStyle {
  fillColor?: MapColor;
  lineColor?: MapColor;
  lineWidth?: number;
  pointRadius?: number;
  pointColor?: MapColor;
  opacity?: number;
  textColor?: MapColor;
  textHaloColor?: MapColor;
  textSize?: number;
}

export interface MapLayerIconConfig {
  iconId?: MapDynamicValue<string | null>;
  iconByProperty?: string;
  fallbackIcon?: string;
}

export interface MapLayerLabelConfig {
  text?: MapDynamicValue<string | null>;
  textByProperty?: string;
  fallbackText?: string;
  minZoom?: number;
  maxZoom?: number;
}

export interface LayerStateConfig {
  message: MapDynamicValue<string>;
  severity?: "info" | "warning" | "error";
}

export interface MapLayerStates {
  loading: LayerStateConfig;
  empty: LayerStateConfig;
  error: LayerStateConfig;
  hidden?: LayerStateConfig;
  disabled?: LayerStateConfig;
  too_large?: LayerStateConfig;
  invalid?: LayerStateConfig;
  unsupportedGeometry?: LayerStateConfig;
  missingRequiredProperty?: LayerStateConfig;
}

export interface MapLayerInteractionConfig {
  onClick?: "select" | "open-popup" | "open-detail-panel" | "custom" | "none";
  onHover?: "preview" | "highlight" | "none";
  cursor?: "pointer" | "default" | "grab";
  tooltip?: MapDynamicValue<string | null>;
}

export interface MapLayerDataSourceRef {
  kind: "atlas-api-layer" | "atlas-api-markers" | "fixture" | "static" | "custom";
  endpoint?: string;
  dataShape?: MapLayerDataShape;
  modes?: string[];
}

export interface MapLayerValidationRules {
  allowedGeometryTypes?: Array<Geometry["type"]>;
}

export interface MapLayerConfig {
  id: MapLayerId;
  label: MapDynamicValue<string>;
  description?: MapDynamicValue<string | null>;
  sourceId: string;
  dataKey: string;
  dataSource: MapLayerDataSourceRef;
  geometryType: MapGeometryType;
  layerKind: MapLayerKind;
  renderMode: MapLayerRenderMode;
  visibleByDefault: boolean;
  toggleable: boolean;
  interactive: boolean;
  selectable: boolean;
  showInLayerToggle?: boolean;
  toggleInModes?: string[];
  visibilityRule?: (context: MapLayerResolverContext) => boolean;
  minZoom?: number;
  maxZoom?: number;
  order: number;
  requiredProperties: string[];
  optionalProperties?: string[];
  validation?: MapLayerValidationRules;
  style?: MapLayerStyle;
  icons?: MapLayerIconConfig;
  labels?: MapLayerLabelConfig;
  states: MapLayerStates;
  interactions?: MapLayerInteractionConfig;
  metadata?: Record<string, unknown>;
  data?: MapFeatureCollection;
  visibility?: MapLayerVisibility;
  type?: MapLayerType;
}

export type MapLayerRegistry = Record<MapLayerId, MapLayerConfig>;

export interface MapFeatureInteractionPayload {
  layerId: MapLayerId;
  featureId?: MapFeatureId;
  feature: MapFeature;
  coordinate: Coordinate;
  screenPoint?: MapScreenPoint | null;
  originalEvent?: unknown;
}

export interface MapClickEvent {
  coordinate: Coordinate;
  screenPoint?: MapScreenPoint | null;
  originalEvent?: unknown;
}

export interface MapViewportChangePayload {
  viewport: MapViewport;
  originalEvent?: unknown;
}

export type MapFeatureInteractionHandler = (event: MapFeatureInteractionPayload) => void;
export type FeatureClickHandler = MapFeatureInteractionHandler;
export type MapFeatureClickEvent = MapFeatureInteractionPayload;
export type MapClickHandler = (event: MapClickEvent) => void;
export type MapViewportChangeHandler = (event: MapViewportChangePayload) => void;

export interface FitBoundsOptions {
  padding?: number;
  duration?: number;
}
