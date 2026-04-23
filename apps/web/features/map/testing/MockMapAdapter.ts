import type { MapAdapter } from "@/features/map/core/MapAdapter";
import type {
  FeatureHoverHandler,
  FitBoundsOptions,
  MapBounds,
  MapClickEvent,
  MapClickHandler,
  MapCoordinates,
  MapFeature,
  MapFeatureCollection,
  MapFeatureId,
  MapFeatureInteractionHandler,
  MapInitOptions,
  MapLayerConfig,
  MapLayerId,
  MapLayerVisibility,
  MapProviderName,
  MapViewport,
  MapViewportChangeHandler,
  MarkerConfig,
  PopupConfig
} from "@/features/map/core/MapTypes";

type CallRecord =
  | { name: "initialize"; args: [HTMLElement, MapInitOptions] }
  | { name: "setView"; args: [MapCoordinates, number] }
  | { name: "fitBounds"; args: [MapBounds, FitBoundsOptions | undefined] }
  | { name: "addGeoJSONLayer"; args: [MapLayerConfig] }
  | { name: "removeLayer"; args: [MapLayerId] }
  | { name: "updateLayerData"; args: [MapLayerId, MapFeatureCollection] }
  | { name: "setLayerVisibility"; args: [MapLayerId, MapLayerVisibility] }
  | { name: "destroy"; args: [] };

export class MockMapAdapter implements MapAdapter {
  private readonly calls: CallRecord[] = [];
  private readonly layers = new Map<MapLayerId, MapLayerConfig>();
  private readonly markers = new Map<string, MarkerConfig>();
  private readonly featureClickHandlers = new Map<MapLayerId, Set<MapFeatureInteractionHandler>>();
  private readonly mapClickHandlers = new Set<MapClickHandler>();
  private readonly viewportHandlers = new Set<MapViewportChangeHandler>();

  getProviderName(): MapProviderName {
    return "null";
  }

  initialize(container: HTMLElement, options: MapInitOptions) {
    this.calls.push({ name: "initialize", args: [container, options] });
  }

  setView(center: MapCoordinates, zoom: number) {
    this.calls.push({ name: "setView", args: [center, zoom] });
  }

  fitBounds(bounds: MapBounds, options?: FitBoundsOptions) {
    this.calls.push({ name: "fitBounds", args: [bounds, options] });
  }

  addGeoJSONLayer(layer: MapLayerConfig) {
    this.layers.set(layer.id, layer);
    this.calls.push({ name: "addGeoJSONLayer", args: [layer] });
  }

  removeLayer(layerId: MapLayerId) {
    this.layers.delete(layerId);
    this.calls.push({ name: "removeLayer", args: [layerId] });
  }

  updateLayerData(layerId: MapLayerId, data: MapFeatureCollection) {
    const layer = this.layers.get(layerId);
    if (layer) {
      this.layers.set(layerId, {
        ...layer,
        data
      });
    }
    this.calls.push({ name: "updateLayerData", args: [layerId, data] });
  }

  patchLayerFeature() {}

  setLayerVisibility(layerId: MapLayerId, visibility: MapLayerVisibility) {
    const layer = this.layers.get(layerId);
    if (layer) {
      this.layers.set(layerId, {
        ...layer,
        visibility
      });
    }
    this.calls.push({ name: "setLayerVisibility", args: [layerId, visibility] });
  }

  addMarker(config: MarkerConfig) {
    const markerId = config.id ?? `mock-marker:${this.markers.size}`;
    this.markers.set(markerId, {
      ...config,
      id: markerId
    });
    return markerId;
  }

  removeMarker(markerId: string) {
    this.markers.delete(markerId);
  }

  onFeatureClick(layerId: MapLayerId, handler: MapFeatureInteractionHandler) {
    const handlers = this.featureClickHandlers.get(layerId) ?? new Set<MapFeatureInteractionHandler>();
    handlers.add(handler);
    this.featureClickHandlers.set(layerId, handlers);
    return () => handlers.delete(handler);
  }

  onFeatureHover(_layerId: MapLayerId, _handler: FeatureHoverHandler) {
    return () => undefined;
  }

  onFeatureLeave() {
    return () => undefined;
  }

  onMapClick(handler: MapClickHandler) {
    this.mapClickHandlers.add(handler);
    return () => this.mapClickHandlers.delete(handler);
  }

  onViewportChange(handler: MapViewportChangeHandler) {
    this.viewportHandlers.add(handler);
    return () => this.viewportHandlers.delete(handler);
  }

  openPopup(_config: PopupConfig) {}

  closePopup() {}

  selectFeature() {}
  clearSelection() {}
  highlightFeature() {}
  clearHighlight() {}
  setCursor() {}

  getViewport(): MapViewport | null {
    return null;
  }

  destroy() {
    this.calls.push({ name: "destroy", args: [] });
    this.layers.clear();
    this.featureClickHandlers.clear();
    this.mapClickHandlers.clear();
    this.viewportHandlers.clear();
  }

  triggerFeatureClick(layerId: MapLayerId, feature: MapFeature) {
    const handlers = this.featureClickHandlers.get(layerId);
    handlers?.forEach((handler) =>
      handler({
        layerId,
        feature,
        featureId: feature.id ?? feature.properties?.id,
        coordinate:
          feature.geometry?.type === "Point"
            ? [feature.geometry.coordinates[0], feature.geometry.coordinates[1]]
            : [0, 0]
      })
    );
  }

  triggerMapClick(event: MapClickEvent) {
    this.mapClickHandlers.forEach((handler) => handler(event));
  }

  getLayer(layerId: MapLayerId) {
    return this.layers.get(layerId) ?? null;
  }

  hasLayer(layerId: MapLayerId) {
    return this.layers.has(layerId);
  }

  getCallHistory() {
    return [...this.calls];
  }
}
