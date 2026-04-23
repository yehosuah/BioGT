import type { PickingInfo } from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { MapRef } from "react-map-gl/maplibre";

import type { MapAdapter } from "@/features/map/core/MapAdapter";
import type {
  FeatureHoverHandler,
  FitBoundsOptions,
  MapAdapterStatus,
  MapBounds,
  MapClickEvent,
  MapClickHandler,
  MapColor,
  MapFeature,
  MapFeatureCollection,
  MapFeatureId,
  MapFeatureInteractionHandler,
  MapFeatureInteractionPayload,
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
import { getBoundsCenter, toProviderBounds } from "@/features/map/core/mapGeometry";
import { resolveLayerStyle } from "@/features/map/registry/layerResolvers";
import { mapTokens, toMapColor } from "@/features/map/styles/mapTokens";

const DEFAULT_FILL_COLOR: MapColor = toMapColor(
  mapTokens.colors.geometry.polygon,
  mapTokens.opacity.background
);
const DEFAULT_LINE_COLOR: MapColor = toMapColor(
  mapTokens.colors.geometry.boundary,
  mapTokens.opacity.strong
);
const DEFAULT_POINT_RADIUS = mapTokens.sizes.marker.sm;
const DEFAULT_LINE_WIDTH = mapTokens.sizes.line.normal;
const DEFAULT_VIEW_DURATION = 900;

type ChangeListener = () => void;

type HoveredDescriptor = {
  layerId: MapLayerId;
  featureId: MapFeatureId | null;
};

const emptyCollection: MapFeatureCollection = {
  type: "FeatureCollection",
  features: []
};

const extractCoordinate = (info: PickingInfo | { lngLat?: { lng: number; lat: number } }): [number, number] => {
  if ("coordinate" in info && Array.isArray(info.coordinate) && info.coordinate.length >= 2) {
    return [Number(info.coordinate[0]), Number(info.coordinate[1])];
  }

  if ("lngLat" in info && info.lngLat) {
    return [info.lngLat.lng, info.lngLat.lat];
  }

  return [0, 0];
};

const extractScreenPoint = (info: PickingInfo): { x: number; y: number } | null => {
  if (typeof info.x === "number" && typeof info.y === "number") {
    return {
      x: info.x,
      y: info.y
    };
  }

  return null;
};

export class MapLibreDeckAdapter implements MapAdapter {
  private status: MapAdapterStatus = "idle";
  private map: MapRef | null = null;
  private container: HTMLElement | null = null;
  private viewport: MapViewport | null = null;
  private version = 0;
  private selectedLayerId: MapLayerId | null = null;
  private selectedFeatureId: MapFeatureId | null = null;
  private highlightedLayerId: MapLayerId | null = null;
  private highlightedFeatureId: MapFeatureId | null = null;
  private hoveredDescriptor: HoveredDescriptor | null = null;
  private suppressNextMapClick = false;
  private cursor: string | null = null;
  private markerSequence = 0;
  private activePopup: PopupConfig | null = null;
  private readonly layers = new Map<MapLayerId, MapLayerConfig>();
  private readonly markers = new Map<string, MarkerConfig>();
  private readonly featureClickHandlers = new Map<MapLayerId, Set<MapFeatureInteractionHandler>>();
  private readonly featureHoverHandlers = new Map<MapLayerId, Set<FeatureHoverHandler>>();
  private readonly featureLeaveHandlers = new Map<MapLayerId, Set<MapFeatureInteractionHandler>>();
  private readonly mapClickHandlers = new Set<MapClickHandler>();
  private readonly viewportChangeHandlers = new Set<MapViewportChangeHandler>();
  private readonly changeListeners = new Set<ChangeListener>();

  getProviderName(): MapProviderName {
    return "maplibre";
  }

  initialize(container: HTMLElement, options: MapInitOptions) {
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

  attachMap(map: MapRef) {
    this.map = map;
    this.setCursor(this.cursor);
  }

  detachMap() {
    this.map = null;
  }

  subscribe(listener: ChangeListener) {
    this.changeListeners.add(listener);

    return () => {
      this.changeListeners.delete(listener);
    };
  }

  getVersion() {
    return this.version;
  }

  getDeckLayers() {
    return Array.from(this.layers.values())
      .sort((left, right) => left.order - right.order)
      .filter((layer) => layer.renderMode === "geojson")
      .map((layer) =>
        new GeoJsonLayer<MapFeature>({
          id: layer.id,
          data: layer.data ?? emptyCollection,
          pickable: Boolean(layer.interactive && layer.visibility !== "hidden"),
          visible: this.isLayerVisible(layer),
          filled: layer.geometryType !== "line",
          stroked: true,
          autoHighlight: Boolean(layer.interactive),
          lineWidthMinPixels: 1,
          getFillColor: (feature) =>
            resolveLayerStyle(layer, feature, this.createResolverContext(layer.id, feature)).fillColor ??
            DEFAULT_FILL_COLOR,
          getLineColor: (feature) =>
            resolveLayerStyle(layer, feature, this.createResolverContext(layer.id, feature)).lineColor ??
            DEFAULT_LINE_COLOR,
          getLineWidth: (feature) =>
            resolveLayerStyle(layer, feature, this.createResolverContext(layer.id, feature)).lineWidth ??
            DEFAULT_LINE_WIDTH,
          getPointRadius: (feature) =>
            resolveLayerStyle(layer, feature, this.createResolverContext(layer.id, feature)).pointRadius ??
            DEFAULT_POINT_RADIUS
        })
      );
  }

  setViewport(viewport: MapViewport) {
    this.viewport = viewport;
    this.emitChange();
  }

  handleViewportChange(viewport: MapViewport, originalEvent?: unknown) {
    this.viewport = viewport;
    this.viewportChangeHandlers.forEach((handler) => {
      handler({
        viewport,
        originalEvent
      });
    });
    this.emitChange();
  }

  setView(center: [number, number], zoom: number) {
    this.viewport = {
      ...this.viewport,
      center,
      zoom
    };

    this.map?.flyTo({
      center,
      zoom,
      duration: DEFAULT_VIEW_DURATION
    });
    this.emitChange();
  }

  fitBounds(bounds: MapBounds, options?: FitBoundsOptions) {
    const currentZoom = this.viewport?.zoom ?? 0;
    this.viewport = {
      ...this.viewport,
      bounds,
      center: getBoundsCenter(bounds),
      zoom: currentZoom
    };

    this.map?.fitBounds(toProviderBounds(bounds), {
      padding: options?.padding ?? 32,
      duration: options?.duration ?? DEFAULT_VIEW_DURATION
    });
    this.emitChange();
  }

  addGeoJSONLayer(layer: MapLayerConfig) {
    this.layers.set(layer.id, {
      ...layer,
      visibility: layer.visibility ?? "visible"
    });
    this.emitChange();
  }

  removeLayer(layerId: MapLayerId) {
    this.layers.delete(layerId);
    this.featureClickHandlers.delete(layerId);
    this.featureHoverHandlers.delete(layerId);
    this.featureLeaveHandlers.delete(layerId);

    if (this.selectedLayerId === layerId) {
      this.clearSelection();
    }
    if (this.highlightedLayerId === layerId) {
      this.clearHighlight();
    }
    if (this.hoveredDescriptor?.layerId === layerId) {
      this.hoveredDescriptor = null;
    }

    this.emitChange();
  }

  updateLayerData(layerId: MapLayerId, data: MapFeatureCollection) {
    const current = this.layers.get(layerId);
    if (!current) {
      return;
    }

    this.layers.set(layerId, {
      ...current,
      data
    });
    this.emitChange();
  }

  setLayerVisibility(layerId: MapLayerId, visibility: MapLayerVisibility) {
    const current = this.layers.get(layerId);
    if (!current) {
      return;
    }

    this.layers.set(layerId, {
      ...current,
      visibility
    });
    this.emitChange();
  }

  addMarker(config: MarkerConfig) {
    const markerId = config.id ?? `marker:${this.markerSequence++}`;
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
    this.emitChange();
  }

  clearSelection() {
    this.selectedLayerId = null;
    this.selectedFeatureId = null;
    this.emitChange();
  }

  highlightFeature(layerId: MapLayerId | null, featureId: MapFeatureId | null) {
    this.highlightedLayerId = layerId;
    this.highlightedFeatureId = featureId;
    this.emitChange();
  }

  clearHighlight() {
    this.highlightedLayerId = null;
    this.highlightedFeatureId = null;
    this.emitChange();
  }

  setCursor(cursor: string | null) {
    this.cursor = cursor;

    if (this.container && "style" in this.container) {
      this.container.style.cursor = cursor ?? "";
    }

    const canvas = this.map?.getMap()?.getCanvas?.();
    if (canvas) {
      canvas.style.cursor = cursor ?? "";
    }
  }

  handleDeckClick(info: PickingInfo) {
    const feature = info.object as MapFeature | undefined;
    const layerId = info.layer?.id;

    if (!feature || !layerId) {
      return false;
    }

    const handlers = this.featureClickHandlers.get(String(layerId));
    if (!handlers?.size) {
      return false;
    }

    const event: MapFeatureInteractionPayload = {
      layerId: String(layerId),
      featureId: feature.id ?? feature.properties?.id,
      feature,
      coordinate: extractCoordinate(info),
      screenPoint: extractScreenPoint(info),
      originalEvent: info
    };

    this.suppressNextMapClick = true;
    handlers.forEach((handler) => handler(event));
    return true;
  }

  handleDeckHover(info: PickingInfo) {
    const feature = info.object as MapFeature | undefined;
    const layerId = info.layer?.id ? String(info.layer.id) : null;

    if (!feature || !layerId) {
      this.emitHoverLeave();
      return;
    }

    const featureId = feature.id ?? feature.properties?.id ?? null;
    if (
      this.hoveredDescriptor?.layerId === layerId &&
      String(this.hoveredDescriptor.featureId ?? "") === String(featureId ?? "")
    ) {
      return;
    }

    this.emitHoverLeave();

    const handlers = this.featureHoverHandlers.get(layerId);
    if (!handlers?.size) {
      this.hoveredDescriptor = {
        layerId,
        featureId
      };
      return;
    }

    const payload: MapFeatureInteractionPayload = {
      layerId,
      featureId,
      feature,
      coordinate: extractCoordinate(info),
      screenPoint: extractScreenPoint(info),
      originalEvent: info
    };

    this.hoveredDescriptor = {
      layerId,
      featureId
    };
    handlers.forEach((handler) => handler(payload));
  }

  handleMapClick(event: { lngLat: { lng: number; lat: number } }) {
    if (this.consumeMapClickSuppression()) {
      return;
    }

    const payload: MapClickEvent = {
      coordinate: extractCoordinate(event),
      originalEvent: event
    };

    this.mapClickHandlers.forEach((handler) => handler(payload));
  }

  resize() {
    this.map?.resize();
  }

  getStatus() {
    return this.status;
  }

  getViewport() {
    return this.viewport;
  }

  destroy() {
    this.layers.clear();
    this.markers.clear();
    this.featureClickHandlers.clear();
    this.featureHoverHandlers.clear();
    this.featureLeaveHandlers.clear();
    this.mapClickHandlers.clear();
    this.viewportChangeHandlers.clear();
    this.changeListeners.clear();
    this.selectedLayerId = null;
    this.selectedFeatureId = null;
    this.highlightedLayerId = null;
    this.highlightedFeatureId = null;
    this.hoveredDescriptor = null;
    this.cursor = null;
    this.activePopup = null;
    this.map = null;
    this.container = null;
    this.viewport = null;
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
      handlers.delete(handler);
      if (handlers.size === 0) {
        handlersByLayer.delete(layerId);
      }
    };
  }

  private emitHoverLeave() {
    if (!this.hoveredDescriptor) {
      return;
    }

    const descriptor = this.hoveredDescriptor;
    this.hoveredDescriptor = null;

    const layer = this.layers.get(descriptor.layerId);
    const feature = layer?.data?.features.find((entry) => {
      const featureId = entry.id ?? entry.properties?.id ?? null;
      return String(featureId ?? "") === String(descriptor.featureId ?? "");
    });

    if (!feature) {
      return;
    }

    const handlers = this.featureLeaveHandlers.get(descriptor.layerId);
    if (!handlers?.size) {
      return;
    }

    const payload: MapFeatureInteractionPayload = {
      layerId: descriptor.layerId,
      featureId: descriptor.featureId ?? undefined,
      feature,
      coordinate: extractCoordinate({
        coordinate: feature.geometry?.type === "Point" ? feature.geometry.coordinates : undefined
      } as PickingInfo),
      screenPoint: null
    };

    handlers.forEach((handler) => handler(payload));
  }

  private consumeMapClickSuppression() {
    const current = this.suppressNextMapClick;
    this.suppressNextMapClick = false;
    return current;
  }

  private createResolverContext(layerId: MapLayerId, feature: MapFeature) {
    const featureId = feature.id ?? feature.properties?.id ?? null;
    return {
      feature,
      selected:
        featureId !== null &&
        featureId === this.selectedFeatureId &&
        layerId === this.selectedLayerId,
      hovered:
        featureId !== null &&
        featureId === this.highlightedFeatureId &&
        layerId === this.highlightedLayerId,
      hidden: this.layers.get(layerId)?.visibility === "hidden",
      layerId,
      zoom: this.viewport?.zoom ?? 0
    };
  }

  private isLayerVisible(layer: MapLayerConfig) {
    if (layer.visibility === "hidden") {
      return false;
    }

    const zoom = this.viewport?.zoom;
    if (typeof zoom === "number" && typeof layer.minZoom === "number" && zoom < layer.minZoom) {
      return false;
    }

    if (typeof zoom === "number" && typeof layer.maxZoom === "number" && zoom > layer.maxZoom) {
      return false;
    }

    return true;
  }

  private emitChange() {
    this.version += 1;
    this.changeListeners.forEach((listener) => listener());
  }
}
