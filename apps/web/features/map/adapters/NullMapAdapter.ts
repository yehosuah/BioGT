import type { MapAdapter } from "@/features/map/core/MapAdapter";
import type {
  MapAdapterStatus,
  MapBounds,
  MapClickEvent,
  MapClickHandler,
  FeatureHoverHandler,
  MapCoordinates,
  MapFeatureId,
  MapFeatureInteractionHandler,
  MapFeatureInteractionPayload,
  MapFeatureCollection,
  MapInitOptions,
  MapLayerConfig,
  MapLayerId,
  MapLayerVisibility,
  MapProviderName,
  MarkerConfig,
  PopupConfig,
  MapViewport,
  MapViewportChangeHandler
} from "@/features/map/core/MapTypes";
import { getBoundsCenter } from "@/features/map/core/mapGeometry";

type StoredLayer = MapLayerConfig & {
  data?: MapFeatureCollection;
  visibility: MapLayerVisibility;
  interactive: boolean;
};

const createFallbackViewport = (): MapViewport => ({
  center: [0, 0],
  zoom: 0
});

const createFallbackLayer = (layerId: MapLayerId): StoredLayer => ({
  id: layerId,
  label: layerId,
  sourceId: `${layerId}-source`,
  dataKey: layerId,
  dataSource: {
    kind: "custom",
    dataShape: "geojson"
  },
  geometryType: "point",
  layerKind: "circle",
  renderMode: "geojson",
  visibleByDefault: true,
  toggleable: false,
  type: "point",
  selectable: false,
  showInLayerToggle: false,
  order: 0,
  requiredProperties: [],
  states: {
    loading: { message: "Loading layer..." },
    empty: { message: "Layer has no data." },
    error: { message: "Layer failed to load.", severity: "error" }
  },
  visibility: "visible",
  interactive: false
});

export class NullMapAdapter implements MapAdapter {
  private container: HTMLElement | null = null;
  private status: MapAdapterStatus = "idle";
  private viewport: MapViewport | null = null;
  private selectedLayerId: MapLayerId | null = null;
  private selectedFeatureId: MapFeatureId | null = null;
  private highlightedLayerId: MapLayerId | null = null;
  private highlightedFeatureId: MapFeatureId | null = null;
  private cursor: string | null = null;
  private activePopup: PopupConfig | null = null;
  private readonly markers = new Map<string, MarkerConfig>();
  private readonly layers = new Map<MapLayerId, StoredLayer>();
  private readonly featureClickHandlers = new Map<MapLayerId, Set<MapFeatureInteractionHandler>>();
  private readonly featureHoverHandlers = new Map<MapLayerId, Set<FeatureHoverHandler>>();
  private readonly featureLeaveHandlers = new Map<MapLayerId, Set<MapFeatureInteractionHandler>>();
  private readonly mapClickHandlers = new Set<MapClickHandler>();
  private readonly viewportChangeHandlers = new Set<MapViewportChangeHandler>();

  getProviderName(): MapProviderName {
    return "null";
  }

  async initialize(container: HTMLElement, options: MapInitOptions) {
    this.container = container;
    this.status = "initializing";
    this.viewport = {
      center: options.center,
      zoom: options.zoom,
      bearing: options.bearing,
      pitch: options.pitch,
      bounds: options.bounds
    };
    this.status = "ready";
  }

  setView(center: MapCoordinates, zoom: number) {
    const current = this.viewport ?? createFallbackViewport();
    this.viewport = {
      ...current,
      center,
      zoom
    };
  }

  fitBounds(bounds: MapBounds) {
    const current = this.viewport ?? createFallbackViewport();
    this.viewport = {
      ...current,
      bounds,
      center: getBoundsCenter(bounds)
    };
  }

  addGeoJSONLayer(layer: MapLayerConfig) {
    this.layers.set(layer.id, {
      ...layer,
      interactive: layer.interactive ?? false,
      visibility: layer.visibility ?? "visible"
    });
  }

  removeLayer(layerId: MapLayerId) {
    this.layers.delete(layerId);
    this.featureClickHandlers.delete(layerId);
    this.featureHoverHandlers.delete(layerId);
    this.featureLeaveHandlers.delete(layerId);
  }

  updateLayerData(layerId: MapLayerId, data: MapFeatureCollection) {
    const currentLayer = this.layers.get(layerId) ?? createFallbackLayer(layerId);
    this.layers.set(layerId, {
      ...currentLayer,
      data
    });
  }

  setLayerVisibility(layerId: MapLayerId, visibility: MapLayerVisibility) {
    const currentLayer = this.layers.get(layerId) ?? createFallbackLayer(layerId);
    this.layers.set(layerId, {
      ...currentLayer,
      visibility
    });
  }

  addMarker(config: MarkerConfig) {
    const markerId = config.id ?? `marker:${this.markers.size}`;
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
    return this.addFeatureHandler(this.featureClickHandlers, layerId, handler);
  }

  onFeatureHover(layerId: MapLayerId, handler: FeatureHoverHandler) {
    return this.addFeatureHandler(this.featureHoverHandlers, layerId, handler);
  }

  onFeatureLeave(layerId: MapLayerId, handler: MapFeatureInteractionHandler) {
    return this.addFeatureHandler(this.featureLeaveHandlers, layerId, handler);
  }

  onMapClick(handler: MapClickHandler) {
    this.mapClickHandlers.add(handler);

    return () => {
      this.mapClickHandlers.delete(handler);
    };
  }

  onViewportChange(handler: MapViewportChangeHandler) {
    this.viewportChangeHandlers.add(handler);

    return () => {
      this.viewportChangeHandlers.delete(handler);
    };
  }

  openPopup(config: PopupConfig) {
    this.activePopup = config;
  }

  closePopup() {
    this.activePopup = null;
  }

  selectFeature(layerId: MapLayerId | null, featureId: MapFeatureId | null) {
    this.selectedLayerId = layerId;
    this.selectedFeatureId = featureId;
  }

  clearSelection() {
    this.selectedLayerId = null;
    this.selectedFeatureId = null;
  }

  highlightFeature(layerId: MapLayerId | null, featureId: MapFeatureId | null) {
    this.highlightedLayerId = layerId;
    this.highlightedFeatureId = featureId;
  }

  clearHighlight() {
    this.highlightedLayerId = null;
    this.highlightedFeatureId = null;
  }

  setCursor(cursor: string | null) {
    this.cursor = cursor;
    if (this.container && "style" in this.container) {
      this.container.style.cursor = cursor ?? "";
    }
  }

  resize() {
    return undefined;
  }

  getStatus() {
    return this.status;
  }

  getViewport() {
    return this.viewport;
  }

  emitFeatureClick(layerId: MapLayerId, event: Omit<MapFeatureInteractionPayload, "layerId">) {
    this.emitFeatureInteraction(this.featureClickHandlers, layerId, event);
  }

  emitFeatureHover(layerId: MapLayerId, event: Omit<MapFeatureInteractionPayload, "layerId">) {
    this.emitFeatureInteraction(this.featureHoverHandlers, layerId, event);
  }

  emitFeatureLeave(layerId: MapLayerId, event: Omit<MapFeatureInteractionPayload, "layerId">) {
    this.emitFeatureInteraction(this.featureLeaveHandlers, layerId, event);
  }

  emitMapClick(event: MapClickEvent) {
    this.mapClickHandlers.forEach((handler) => {
      handler(event);
    });
  }

  emitViewportChange(viewport: MapViewport) {
    this.viewport = viewport;
    this.viewportChangeHandlers.forEach((handler) => {
      handler({
        viewport
      });
    });
  }

  getDebugState() {
    return {
      initialized: this.status === "ready",
      containerAttached: this.container !== null,
      viewport: this.viewport,
      layers: Object.fromEntries(this.layers.entries()),
      selectedLayerId: this.selectedLayerId,
      selectedFeatureId: this.selectedFeatureId,
      highlightedLayerId: this.highlightedLayerId,
      highlightedFeatureId: this.highlightedFeatureId,
      cursor: this.cursor,
      activePopup: this.activePopup,
      featureHandlerCount: Object.fromEntries(
        Array.from(this.featureClickHandlers.entries()).map(([layerId, handlers]) => [
          layerId,
          handlers.size
        ])
      ),
      hoverHandlerCount: Object.fromEntries(
        Array.from(this.featureHoverHandlers.entries()).map(([layerId, handlers]) => [
          layerId,
          handlers.size
        ])
      ),
      leaveHandlerCount: Object.fromEntries(
        Array.from(this.featureLeaveHandlers.entries()).map(([layerId, handlers]) => [
          layerId,
          handlers.size
        ])
      ),
      mapClickHandlerCount: this.mapClickHandlers.size,
      viewportChangeHandlerCount: this.viewportChangeHandlers.size
    };
  }

  destroy() {
    this.container = null;
    this.layers.clear();
    this.featureClickHandlers.clear();
    this.featureHoverHandlers.clear();
    this.featureLeaveHandlers.clear();
    this.mapClickHandlers.clear();
    this.viewportChangeHandlers.clear();
    this.viewport = null;
    this.selectedLayerId = null;
    this.selectedFeatureId = null;
    this.highlightedLayerId = null;
    this.highlightedFeatureId = null;
    this.cursor = null;
    this.status = "destroyed";
  }

  private addFeatureHandler(
    handlersByLayer: Map<MapLayerId, Set<MapFeatureInteractionHandler | FeatureHoverHandler>>,
    layerId: MapLayerId,
    handler: MapFeatureInteractionHandler | FeatureHoverHandler
  ) {
    const handlers = handlersByLayer.get(layerId) ?? new Set<MapFeatureInteractionHandler | FeatureHoverHandler>();
    handlers.add(handler);
    handlersByLayer.set(layerId, handlers);

    return () => {
      const currentHandlers = handlersByLayer.get(layerId);
      currentHandlers?.delete(handler);
      if (currentHandlers && currentHandlers.size === 0) {
        handlersByLayer.delete(layerId);
      }
    };
  }

  private emitFeatureInteraction(
    handlersByLayer: Map<MapLayerId, Set<MapFeatureInteractionHandler>>,
    layerId: MapLayerId,
    event: Omit<MapFeatureInteractionPayload, "layerId">
  ) {
    const handlers = handlersByLayer.get(layerId);
    if (!handlers) {
      return;
    }

    handlers.forEach((handler) => {
      handler({
        layerId,
        ...event
      });
    });
  }
}
