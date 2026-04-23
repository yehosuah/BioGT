import type { MapAdapter } from "@/features/map/core/MapAdapter";
import type {
  FeatureHoverHandler,
  FitBoundsOptions,
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
  MarkerConfig,
  PopupConfig
} from "@/features/map/core/MapTypes";

const createUnavailableProviderError = (provider: MapProviderName) =>
  new Error(`Map provider not installed: ${provider}. Install SDK and implement provider adapter.`);

export abstract class UnavailableProviderAdapter implements MapAdapter {
  constructor(private readonly providerName: MapProviderName) {}

  getProviderName(): MapProviderName {
    return this.providerName;
  }

  async initialize(_container: HTMLElement, _options: MapInitOptions) {
    throw createUnavailableProviderError(this.providerName);
  }

  destroy() {}

  setView(_center: MapCoordinates, _zoom: number) {}

  fitBounds(_bounds: MapBounds, _options?: FitBoundsOptions) {}

  addGeoJSONLayer(_layer: MapLayerConfig) {}

  removeLayer(_layerId: MapLayerId) {}

  updateLayerData(_layerId: MapLayerId, _data: MapFeatureCollection) {}

  setLayerVisibility(_layerId: MapLayerId, _visibility: MapLayerVisibility) {}

  addMarker(config: MarkerConfig) {
    return config.id ?? `${this.providerName}-marker`;
  }

  removeMarker(_markerId: string) {}

  onFeatureClick(_layerId: MapLayerId, _handler: MapFeatureInteractionHandler) {
    return () => {};
  }

  onFeatureHover(_layerId: MapLayerId, _handler: FeatureHoverHandler) {
    return () => {};
  }

  onFeatureLeave(_layerId: MapLayerId, _handler: MapFeatureInteractionHandler) {
    return () => {};
  }

  onMapClick(_handler: MapClickHandler) {
    return () => {};
  }

  onViewportChange(_handler: MapViewportChangeHandler) {
    return () => {};
  }

  openPopup(_config: PopupConfig) {}

  closePopup() {}

  selectFeature(_layerId: MapLayerId | null, _featureId: MapFeatureId | null) {}

  clearSelection() {}

  highlightFeature(_layerId: MapLayerId | null, _featureId: MapFeatureId | null) {}

  clearHighlight() {}

  setCursor(_cursor: string | null) {}
}
