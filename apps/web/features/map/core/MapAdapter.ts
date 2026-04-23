import type {
  FeatureHoverHandler,
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
  MapProviderName,
  MapViewportChangeHandler,
  MapViewport,
  MarkerConfig,
  PopupConfig,
  Unsubscribe
} from "@/features/map/core/MapTypes";

export interface MapAdapter {
  getProviderName(): MapProviderName;
  initialize(container: HTMLElement, options: MapInitOptions): Promise<void> | void;
  setView(center: MapCoordinates, zoom: number): void;
  fitBounds(bounds: MapBounds, options?: FitBoundsOptions): void;
  addGeoJSONLayer(layer: MapLayerConfig): void;
  removeLayer(layerId: MapLayerId): void;
  updateLayerData(layerId: MapLayerId, data: MapFeatureCollection): void;
  patchLayerFeature?(layerId: MapLayerId, featureId: MapFeatureId, patch: Record<string, unknown>): void;
  setLayerVisibility(layerId: MapLayerId, visibility: MapLayerVisibility): void;
  addMarker(config: MarkerConfig): string;
  removeMarker(markerId: string): void;
  onFeatureClick(layerId: MapLayerId, handler: MapFeatureInteractionHandler): Unsubscribe;
  onFeatureHover(layerId: MapLayerId, handler: FeatureHoverHandler): Unsubscribe;
  onFeatureLeave(layerId: MapLayerId, handler: MapFeatureInteractionHandler): Unsubscribe;
  onMapClick(handler: MapClickHandler): Unsubscribe;
  onViewportChange(handler: MapViewportChangeHandler): Unsubscribe;
  openPopup(config: PopupConfig): void;
  closePopup(): void;
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
