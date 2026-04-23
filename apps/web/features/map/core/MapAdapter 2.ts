import type {
  FeatureClickHandler,
  MapAdapterStatus,
  MapBounds,
  MapClickHandler,
  MapCoordinates,
  MapFeatureCollection,
  MapInitOptions,
  MapLayerConfig,
  MapLayerId,
  MapLayerVisibility,
  MapViewport
} from "@/features/map/core/MapTypes";

export interface MapAdapter {
  initialize(container: HTMLElement, options: MapInitOptions): Promise<void> | void;
  setView(center: MapCoordinates, zoom: number): void;
  fitBounds(bounds: MapBounds): void;
  addGeoJSONLayer(layer: MapLayerConfig): void;
  removeLayer(layerId: MapLayerId): void;
  updateLayerData(layerId: MapLayerId, data: MapFeatureCollection): void;
  setLayerVisibility(layerId: MapLayerId, visibility: MapLayerVisibility): void;
  onFeatureClick(layerId: MapLayerId, handler: FeatureClickHandler): void;
  onMapClick(handler: MapClickHandler): void;
  resize?(): void;
  getStatus?(): MapAdapterStatus;
  getViewport?(): MapViewport | null;
  destroy(): void;
}
