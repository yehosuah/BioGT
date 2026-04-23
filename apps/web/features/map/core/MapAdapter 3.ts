import type {
  FitBoundsOptions,
  MapAdapterStatus,
  MapBounds,
  MapClickHandler,
  MapCoordinates,
  MapFeatureCollection,
  MapFeatureId,
  MapFeatureInteractionHandler,
  MapInitOptions,
  MapLayerConfig,
  MapLayerId,
  MapLayerVisibility,
  MapViewportChangeHandler,
  MapViewport
} from "@/features/map/core/MapTypes";

export interface MapAdapter {
  initialize(container: HTMLElement, options: MapInitOptions): Promise<void> | void;
  setView(center: MapCoordinates, zoom: number): void;
  fitBounds(bounds: MapBounds, options?: FitBoundsOptions): void;
  addGeoJSONLayer(layer: MapLayerConfig): void;
  removeLayer(layerId: MapLayerId): void;
  updateLayerData(layerId: MapLayerId, data: MapFeatureCollection): void;
  patchLayerFeature?(layerId: MapLayerId, featureId: MapFeatureId, patch: Record<string, unknown>): void;
  setLayerVisibility(layerId: MapLayerId, visibility: MapLayerVisibility): void;
  onFeatureClick(layerId: MapLayerId, handler: MapFeatureInteractionHandler): () => void;
  onFeatureHover(layerId: MapLayerId, handler: MapFeatureInteractionHandler): () => void;
  onFeatureLeave(layerId: MapLayerId, handler: MapFeatureInteractionHandler): () => void;
  onMapClick(handler: MapClickHandler): () => void;
  onViewportChange(handler: MapViewportChangeHandler): () => void;
  selectFeature(layerId: MapLayerId | null, featureId: MapFeatureId | null): void;
  clearSelection(): void;
  highlightFeature(layerId: MapLayerId | null, featureId: MapFeatureId | null): void;
  clearHighlight(): void;
  setCursor(cursor: string | null): void;
  resize?(): void;
  getStatus?(): MapAdapterStatus;
  getViewport?(): MapViewport | null;
  destroy(): void;
}
