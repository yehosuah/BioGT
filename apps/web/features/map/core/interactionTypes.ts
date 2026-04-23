import type { GeoJsonProperties, Geometry } from "geojson";

import type {
  Coordinate,
  MapFeatureId,
  MapLayerId,
  MapScreenPoint,
  MapViewport
} from "@/features/map/core/MapTypes";

export type FeatureInteractionType = "click" | "hover" | "leave" | "select" | "deselect";
export type InteractionSource = "map" | "search" | "list" | "filter" | "system";
export type InteractionMode = "browse" | "select" | "draw" | "edit";

export interface NormalizedFeatureReference {
  featureId: MapFeatureId | null;
  layerId: MapLayerId | null;
  geometry: Geometry | null;
  properties: GeoJsonProperties;
  lngLat: Coordinate | null;
  screenPoint: MapScreenPoint | null;
}

export interface FeatureInteractionEvent extends NormalizedFeatureReference {
  interactionType: FeatureInteractionType;
  source: InteractionSource;
}

export interface MapInteractionEvent {
  interactionType: "map-click";
  lngLat: Coordinate | null;
  screenPoint: MapScreenPoint | null;
  source: InteractionSource;
}

export interface ViewportChangeEvent {
  interactionType: "viewport-change";
  viewport: MapViewport;
  source: InteractionSource;
}

export interface FeatureSelectionState {
  selectedFeatureId: MapFeatureId | null;
  selectedLayerId: MapLayerId | null;
  hoveredFeatureId: MapFeatureId | null;
  hoveredLayerId: MapLayerId | null;
  activePopupFeatureId: MapFeatureId | null;
  activeDetailFeatureId: MapFeatureId | null;
  visibleLayerIds: MapLayerId[];
  lastInteractionSource: InteractionSource;
  interactionMode: InteractionMode;
  selectedFeature: NormalizedFeatureReference | null;
  hoveredFeature: NormalizedFeatureReference | null;
  popupFeature: NormalizedFeatureReference | null;
  detailFeature: NormalizedFeatureReference | null;
  viewport: MapViewport | null;
}

export type InteractionHandler<TEvent> = (event: TEvent) => void;

export interface MapInteractionController {
  getInteractionState(): FeatureSelectionState;
  subscribeToInteractionState(listener: () => void): () => void;
}

export const createInitialInteractionState = (): FeatureSelectionState => ({
  selectedFeatureId: null,
  selectedLayerId: null,
  hoveredFeatureId: null,
  hoveredLayerId: null,
  activePopupFeatureId: null,
  activeDetailFeatureId: null,
  visibleLayerIds: [],
  lastInteractionSource: "system",
  interactionMode: "browse",
  selectedFeature: null,
  hoveredFeature: null,
  popupFeature: null,
  detailFeature: null,
  viewport: null
});
