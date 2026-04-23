import type { Geometry, Position } from "geojson";

import type { MapAdapter } from "@/features/map/core/MapAdapter";
import { createMapBounds } from "@/features/map/core/mapGeometry";
import { patchFeatureCollection } from "@/features/map/performance/featurePatch";
import type {
  FitBoundsOptions,
  MapBounds,
  MapClickEvent,
  MapCoordinates,
  MapFeature,
  MapFeatureCollection,
  MapFeatureId,
  MapFeatureInteractionPayload,
  MapInitOptions,
  MapLayerConfig,
  MapLayerId,
  MapLayerVisibility,
  MapViewport,
  MapViewportChangePayload
} from "@/features/map/core/MapTypes";
import type {
  FeatureInteractionEvent,
  FeatureSelectionState,
  InteractionHandler,
  InteractionMode,
  InteractionSource,
  MapInteractionController,
  MapInteractionEvent,
  NormalizedFeatureReference,
  ViewportChangeEvent
} from "@/features/map/core/interactionTypes";
import { MapInteractionStore } from "@/features/map/core/mapInteractionStore";
import { trackMapEvent } from "@/observability/mapTelemetry";

const createControllerError = (message: string) => new Error(`MapController: ${message}`);
const POINT_BOUNDS_EPSILON = 0.015;

type FeatureListenerMap = Map<MapLayerId, Set<InteractionHandler<FeatureInteractionEvent>>>;

type SelectFeatureOptions = {
  source?: InteractionSource;
  openPopup?: boolean;
  openDetail?: boolean;
  fit?: boolean;
  interactionMode?: InteractionMode;
};

const emptyProperties = Object.freeze({});

const pushCoordinate = (value: unknown, coordinates: Position[]) => {
  if (!Array.isArray(value)) {
    return;
  }

  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    coordinates.push([value[0], value[1]]);
    return;
  }

  value.forEach((entry) => pushCoordinate(entry, coordinates));
};

const geometryToCoordinates = (geometry: Geometry | null | undefined): Position[] => {
  if (!geometry) {
    return [];
  }

  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.flatMap((entry) => geometryToCoordinates(entry));
  }

  const coordinates: Position[] = [];
  pushCoordinate(geometry.coordinates, coordinates);
  return coordinates;
};

const geometryToBounds = (geometry: Geometry | null | undefined): MapBounds | null => {
  const coordinates = geometryToCoordinates(geometry);
  if (coordinates.length === 0) {
    return null;
  }

  let minLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLng = coordinates[0][0];
  let maxLat = coordinates[0][1];

  coordinates.forEach(([longitude, latitude]) => {
    minLng = Math.min(minLng, longitude);
    minLat = Math.min(minLat, latitude);
    maxLng = Math.max(maxLng, longitude);
    maxLat = Math.max(maxLat, latitude);
  });

  if (minLng === maxLng) {
    minLng -= POINT_BOUNDS_EPSILON;
    maxLng += POINT_BOUNDS_EPSILON;
  }

  if (minLat === maxLat) {
    minLat -= POINT_BOUNDS_EPSILON;
    maxLat += POINT_BOUNDS_EPSILON;
  }

  return createMapBounds(minLng, minLat, maxLng, maxLat);
};

const featureIdMatches = (feature: MapFeature, featureId: MapFeatureId) => {
  const candidate = feature.id ?? feature.properties?.id;
  return candidate !== undefined && candidate !== null && String(candidate) === String(featureId);
};

const getFeatureId = (feature: MapFeature): MapFeatureId | null => {
  const featureId = feature.id ?? feature.properties?.id;
  return featureId ?? null;
};

const getRepresentativeCoordinate = (geometry: Geometry | null | undefined): MapCoordinates | null => {
  const coordinates = geometryToCoordinates(geometry);
  if (coordinates.length === 0) {
    return null;
  }

  return [coordinates[0][0], coordinates[0][1]];
};

export class MapController implements MapInteractionController {
  private readonly adapter: MapAdapter;
  private readonly interactionStore = new MapInteractionStore();
  private initialized = false;
  private destroyed = false;
  private globalInteractionBridges = false;
  private readonly layers = new Map<MapLayerId, MapLayerConfig>();
  private readonly layerInteractionCleanups = new Map<MapLayerId, Array<() => void>>();
  private readonly globalCleanups: Array<() => void> = [];
  private readonly featureClickListeners: FeatureListenerMap = new Map();
  private readonly featureHoverListeners: FeatureListenerMap = new Map();
  private readonly featureLeaveListeners: FeatureListenerMap = new Map();
  private readonly mapClickListeners = new Set<InteractionHandler<MapInteractionEvent>>();
  private readonly viewportChangeListeners = new Set<InteractionHandler<ViewportChangeEvent>>();

  constructor(adapter: MapAdapter) {
    this.adapter = adapter;
  }

  async initialize(container: HTMLElement, options: MapInitOptions) {
    await this.adapter.initialize(container, options);
    this.initialized = true;
    this.destroyed = false;
    this.registerGlobalInteractionBridges();
    this.patchInteractionState({
      viewport: {
        center: options.center,
        zoom: options.zoom,
        bearing: options.bearing,
        pitch: options.pitch,
        bounds: options.bounds
      }
    });
  }

  setView(center: MapCoordinates, zoom: number) {
    this.assertInitialized("set view");
    this.adapter.setView(center, zoom);
  }

  fitBounds(bounds: MapBounds, options?: FitBoundsOptions) {
    this.assertInitialized("fit bounds");
    this.adapter.fitBounds(bounds, options);
  }

  fitToFeature(layerId: MapLayerId, featureId: MapFeatureId, options?: FitBoundsOptions) {
    this.assertInitialized("fit to feature");
    const feature = this.findFeature(layerId, featureId);
    const bounds = geometryToBounds(feature?.geometry ?? null);
    if (!bounds) {
      return;
    }

    this.adapter.fitBounds(bounds, options);
  }

  fitToDataset(layerId: MapLayerId, options?: FitBoundsOptions) {
    this.assertInitialized("fit to dataset");
    const layer = this.assertLayerExists(layerId, "fit dataset");
    const features = layer.data?.features ?? [];
    const bounds = geometryToBounds({
      type: "GeometryCollection",
      geometries: features
        .map((feature) => feature.geometry)
        .filter((geometry): geometry is Geometry => Boolean(geometry))
    });

    if (!bounds) {
      return;
    }

    this.adapter.fitBounds(bounds, options);
  }

  addLayer(layer: MapLayerConfig) {
    this.assertInitialized("add layer");

    if (this.layers.has(layer.id)) {
      throw createControllerError(`layer "${layer.id}" already exists`);
    }

    this.layers.set(layer.id, layer);
    this.adapter.addGeoJSONLayer(layer);
    this.registerLayerInteractionBridge(layer);
    this.syncVisibleLayers();
  }

  removeLayer(layerId: MapLayerId) {
    this.assertInitialized("remove layer");
    this.assertLayerExists(layerId, "remove");

    this.cleanupLayerInteractionBridge(layerId);
    this.layers.delete(layerId);
    this.adapter.removeLayer(layerId);

    const interactionState = this.interactionStore.getState();
    if (interactionState.selectedLayerId === layerId) {
      this.clearSelection("system");
    }
    if (interactionState.hoveredLayerId === layerId) {
      this.clearHighlight("system");
      this.closePopup("system");
    }

    this.syncVisibleLayers();
  }

  updateLayerData(layerId: MapLayerId, data: MapFeatureCollection) {
    this.assertInitialized("update layer data");
    const layer = this.assertLayerExists(layerId, "update");

    const nextLayer = {
      ...layer,
      data
    };

    this.layers.set(layerId, nextLayer);
    this.adapter.updateLayerData(layerId, data);
    trackMapEvent("layer_data_updated", {
      layerId,
      featureCount: data.features.length
    });

    const interactionState = this.interactionStore.getState();
    if (interactionState.selectedLayerId === layerId && interactionState.selectedFeatureId !== null) {
      const selectedFeature = this.findFeatureReference(layerId, interactionState.selectedFeatureId);
      if (!selectedFeature) {
        this.clearSelection("system");
      }
    }
  }

  patchLayerFeature(layerId: MapLayerId, featureId: MapFeatureId, patch: Record<string, unknown>) {
    this.assertInitialized("patch layer feature");
    const layer = this.assertLayerExists(layerId, "patch");
    if (!layer.data) {
      return;
    }

    const nextData = patchFeatureCollection(layer.data, featureId, {
      properties: patch
    });

    this.layers.set(layerId, {
      ...layer,
      data: nextData
    });

    if (this.adapter.patchLayerFeature) {
      this.adapter.patchLayerFeature(layerId, featureId, patch);
    } else {
      this.adapter.updateLayerData(layerId, nextData);
    }
  }

  setLayerVisibility(layerId: MapLayerId, visibility: MapLayerVisibility) {
    this.assertInitialized("set layer visibility");
    const layer = this.assertLayerExists(layerId, "toggle visibility");

    this.layers.set(layerId, {
      ...layer,
      visibility
    });
    this.adapter.setLayerVisibility(layerId, visibility);
    this.syncVisibleLayers();

    if (visibility === "hidden") {
      const interactionState = this.interactionStore.getState();
      if (interactionState.selectedLayerId === layerId) {
        this.clearSelection("system");
      }
      if (interactionState.hoveredLayerId === layerId) {
        this.clearHighlight("system");
        this.closePopup("system");
      }
    }
  }

  onFeatureClick(layerId: MapLayerId, handler: InteractionHandler<FeatureInteractionEvent>) {
    this.assertInitialized("register feature click handler");
    this.assertLayerExists(layerId, "register feature click handler");
    return this.addFeatureListener(this.featureClickListeners, layerId, handler);
  }

  onFeatureHover(layerId: MapLayerId, handler: InteractionHandler<FeatureInteractionEvent>) {
    this.assertInitialized("register feature hover handler");
    this.assertLayerExists(layerId, "register feature hover handler");
    return this.addFeatureListener(this.featureHoverListeners, layerId, handler);
  }

  onFeatureLeave(layerId: MapLayerId, handler: InteractionHandler<FeatureInteractionEvent>) {
    this.assertInitialized("register feature leave handler");
    this.assertLayerExists(layerId, "register feature leave handler");
    return this.addFeatureListener(this.featureLeaveListeners, layerId, handler);
  }

  onMapClick(handler: InteractionHandler<MapInteractionEvent>) {
    this.assertInitialized("register map click handler");
    this.mapClickListeners.add(handler);

    return () => {
      this.mapClickListeners.delete(handler);
    };
  }

  onViewportChange(handler: InteractionHandler<ViewportChangeEvent>) {
    this.assertInitialized("register viewport change handler");
    this.viewportChangeListeners.add(handler);

    return () => {
      this.viewportChangeListeners.delete(handler);
    };
  }

  selectFeature(
    layerId: MapLayerId,
    featureId: MapFeatureId,
    options: SelectFeatureOptions = {}
  ) {
    this.assertInitialized("select feature");
    if (!this.isLayerVisible(layerId)) {
      return null;
    }

    const featureReference = this.findFeatureReference(layerId, featureId);
    if (!featureReference) {
      return null;
    }

    this.applyFeatureSelection(featureReference, {
      source: options.source ?? "system",
      openPopup: options.openPopup,
      openDetail: options.openDetail,
      interactionMode: options.interactionMode
    });

    if (options.fit) {
      this.fitToFeature(layerId, featureId);
    }

    return featureReference;
  }

  selectExternalFeature(
    feature: NormalizedFeatureReference,
    options: SelectFeatureOptions = {}
  ) {
    this.assertInitialized("select external feature");
    this.applyFeatureSelection(feature, {
      source: options.source ?? "system",
      openPopup: options.openPopup,
      openDetail: options.openDetail,
      interactionMode: options.interactionMode
    });
  }

  previewExternalFeature(feature: NormalizedFeatureReference, source: InteractionSource = "system") {
    this.assertInitialized("preview feature");
    this.applyFeatureHover(feature, source);
  }

  clearSelection(source: InteractionSource = "system") {
    this.assertInitialized("clear selection");
    this.adapter.clearSelection();

    const current = this.interactionStore.getState();
    const shouldClosePopup = current.activePopupFeatureId === current.selectedFeatureId;
    this.patchInteractionState({
      selectedFeatureId: null,
      selectedLayerId: null,
      selectedFeature: null,
      activeDetailFeatureId: null,
      detailFeature: null,
      activePopupFeatureId: shouldClosePopup ? null : current.activePopupFeatureId,
      popupFeature: shouldClosePopup ? null : current.popupFeature,
      lastInteractionSource: source,
      interactionMode: current.hoveredFeatureId ? "browse" : "browse"
    });
  }

  highlightFeature(layerId: MapLayerId, featureId: MapFeatureId) {
    this.assertInitialized("highlight feature");
    const featureReference = this.findFeatureReference(layerId, featureId);
    if (!featureReference) {
      return null;
    }

    this.applyFeatureHover(featureReference, "system");
    return featureReference;
  }

  clearHighlight(source: InteractionSource = "system") {
    this.assertInitialized("clear highlight");
    this.adapter.clearHighlight();

    const current = this.interactionStore.getState();
    const closePopup = current.activePopupFeatureId === current.hoveredFeatureId;
    this.patchInteractionState({
      hoveredFeatureId: null,
      hoveredLayerId: null,
      hoveredFeature: null,
      activePopupFeatureId: closePopup ? null : current.activePopupFeatureId,
      popupFeature: closePopup ? null : current.popupFeature,
      lastInteractionSource: source
    });
    this.adapter.setCursor(null);
  }

  openPopup(feature: NormalizedFeatureReference, source: InteractionSource = "system") {
    this.assertInitialized("open popup");
    this.patchInteractionState({
      activePopupFeatureId: feature.featureId,
      popupFeature: feature,
      lastInteractionSource: source
    });
  }

  closePopup(source: InteractionSource = "system") {
    this.assertInitialized("close popup");
    this.patchInteractionState({
      activePopupFeatureId: null,
      popupFeature: null,
      lastInteractionSource: source
    });
  }

  openDetail(feature: NormalizedFeatureReference, source: InteractionSource = "system") {
    this.assertInitialized("open detail");
    this.patchInteractionState({
      activeDetailFeatureId: feature.featureId,
      detailFeature: feature,
      lastInteractionSource: source
    });
  }

  closeDetail(source: InteractionSource = "system") {
    this.assertInitialized("close detail");
    this.patchInteractionState({
      activeDetailFeatureId: null,
      detailFeature: null,
      lastInteractionSource: source
    });
  }

  setCursor(cursor: string | null) {
    this.assertInitialized("set cursor");
    this.adapter.setCursor(cursor);
  }

  subscribeToInteractionState(listener: () => void) {
    return this.interactionStore.subscribe(listener);
  }

  getInteractionState(): FeatureSelectionState {
    return this.interactionStore.getState();
  }

  getSelectedFeatureId() {
    return this.interactionStore.getState().selectedFeatureId;
  }

  getLayerIds() {
    return Array.from(this.layers.keys());
  }

  getStatus() {
    if (this.destroyed) {
      return "destroyed";
    }

    return this.adapter.getStatus?.() ?? (this.initialized ? "ready" : "idle");
  }

  getViewport(): MapViewport | null {
    return this.adapter.getViewport?.() ?? this.interactionStore.getState().viewport;
  }

  resize() {
    this.assertInitialized("resize");
    this.adapter.resize?.();
  }

  destroy() {
    this.layerInteractionCleanups.forEach((cleanups) => cleanups.forEach((cleanup) => cleanup()));
    this.layerInteractionCleanups.clear();
    this.globalCleanups.forEach((cleanup) => cleanup());
    this.globalCleanups.length = 0;
    this.featureClickListeners.clear();
    this.featureHoverListeners.clear();
    this.featureLeaveListeners.clear();
    this.mapClickListeners.clear();
    this.viewportChangeListeners.clear();
    this.adapter.destroy();
    this.layers.clear();
    this.interactionStore.reset();
    this.initialized = false;
    this.destroyed = true;
    this.globalInteractionBridges = false;
  }

  private registerGlobalInteractionBridges() {
    if (this.globalInteractionBridges) {
      return;
    }

    this.globalCleanups.push(
      this.adapter.onMapClick((event) => this.handleAdapterMapClick(event)),
      this.adapter.onViewportChange((event) => this.handleAdapterViewportChange(event))
    );
    this.globalInteractionBridges = true;
  }

  private registerLayerInteractionBridge(layer: MapLayerConfig) {
    if (!layer.interactive || this.layerInteractionCleanups.has(layer.id)) {
      return;
    }

    const cleanups = [
      this.adapter.onFeatureClick(layer.id, (event) =>
        this.handleAdapterFeatureInteraction("click", "map", event)
      ),
      this.adapter.onFeatureHover(layer.id, (event) =>
        this.handleAdapterFeatureInteraction("hover", "map", event)
      ),
      this.adapter.onFeatureLeave(layer.id, (event) =>
        this.handleAdapterFeatureInteraction("leave", "map", event)
      )
    ];

    this.layerInteractionCleanups.set(layer.id, cleanups);
  }

  private cleanupLayerInteractionBridge(layerId: MapLayerId) {
    const cleanups = this.layerInteractionCleanups.get(layerId);
    cleanups?.forEach((cleanup) => cleanup());
    this.layerInteractionCleanups.delete(layerId);
  }

  private handleAdapterFeatureInteraction(
    interactionType: FeatureInteractionEvent["interactionType"],
    source: InteractionSource,
    event: MapFeatureInteractionPayload
  ) {
    const normalized = this.normalizeFeatureInteraction(interactionType, source, event);
    if (!normalized.layerId || (interactionType !== "leave" && !this.isLayerVisible(normalized.layerId))) {
      return;
    }

    if (interactionType === "click") {
      this.applyFeatureSelection(normalized, { source });
      this.emitFeatureListeners(this.featureClickListeners, normalized.layerId, normalized);
      return;
    }

    if (interactionType === "hover") {
      this.applyFeatureHover(normalized, source);
      this.emitFeatureListeners(this.featureHoverListeners, normalized.layerId, normalized);
      return;
    }

    this.handleFeatureLeave(normalized, source);
    this.emitFeatureListeners(this.featureLeaveListeners, normalized.layerId, normalized);
  }

  private handleAdapterMapClick(event: MapClickEvent) {
    const normalized: MapInteractionEvent = {
      interactionType: "map-click",
      lngLat: event.coordinate,
      screenPoint: event.screenPoint ?? null,
      source: "map"
    };

    this.clearHighlight("map");
    this.closePopup("map");
    this.mapClickListeners.forEach((listener) => listener(normalized));
  }

  private handleAdapterViewportChange(event: MapViewportChangePayload) {
    const normalized: ViewportChangeEvent = {
      interactionType: "viewport-change",
      viewport: event.viewport,
      source: "map"
    };

    this.patchInteractionState({
      viewport: event.viewport,
      lastInteractionSource: "map"
    });
    this.viewportChangeListeners.forEach((listener) => listener(normalized));
  }

  private applyFeatureSelection(
    feature: NormalizedFeatureReference,
    options: Required<Pick<SelectFeatureOptions, "source">> &
      Pick<SelectFeatureOptions, "openPopup" | "openDetail" | "interactionMode">
  ) {
    const openPopup = options.openPopup ?? true;
    const openDetail = options.openDetail ?? true;

    this.adapter.selectFeature(feature.layerId, feature.featureId);
    this.adapter.clearHighlight();
    this.setCursorForLayer(feature.layerId);

    this.patchInteractionState({
      selectedFeatureId: feature.featureId,
      selectedLayerId: feature.layerId,
      selectedFeature: feature,
      activeDetailFeatureId: openDetail ? feature.featureId : null,
      detailFeature: openDetail ? feature : null,
      activePopupFeatureId: openPopup ? feature.featureId : null,
      popupFeature: openPopup ? feature : null,
      hoveredFeatureId: null,
      hoveredLayerId: null,
      hoveredFeature: null,
      lastInteractionSource: options.source,
      interactionMode: options.interactionMode ?? "select"
    });
  }

  private applyFeatureHover(feature: NormalizedFeatureReference, source: InteractionSource) {
    this.adapter.highlightFeature(feature.layerId, feature.featureId);
    this.setCursorForLayer(feature.layerId);
    this.patchInteractionState({
      hoveredFeatureId: feature.featureId,
      hoveredLayerId: feature.layerId,
      hoveredFeature: feature,
      activePopupFeatureId: feature.featureId,
      popupFeature: feature,
      lastInteractionSource: source
    });
  }

  private handleFeatureLeave(feature: NormalizedFeatureReference, source: InteractionSource) {
    const current = this.interactionStore.getState();
    const leavingCurrentHover =
      current.hoveredLayerId === feature.layerId &&
      (current.hoveredFeatureId === feature.featureId || feature.featureId === null);

    if (!leavingCurrentHover) {
      return;
    }

    this.clearHighlight(source);
  }

  private normalizeFeatureInteraction(
    interactionType: FeatureInteractionEvent["interactionType"],
    source: InteractionSource,
    event: MapFeatureInteractionPayload
  ): FeatureInteractionEvent {
    return {
      interactionType,
      source,
      featureId: event.featureId ?? getFeatureId(event.feature),
      layerId: event.layerId,
      geometry: event.feature.geometry ?? null,
      properties: event.feature.properties ?? emptyProperties,
      lngLat: event.coordinate ?? getRepresentativeCoordinate(event.feature.geometry),
      screenPoint: event.screenPoint ?? null
    };
  }

  private findFeature(layerId: MapLayerId, featureId: MapFeatureId) {
    const layer = this.layers.get(layerId);
    return layer?.data?.features.find((feature) => featureIdMatches(feature, featureId)) ?? null;
  }

  private findFeatureReference(layerId: MapLayerId, featureId: MapFeatureId) {
    const feature = this.findFeature(layerId, featureId);
    if (!feature) {
      return null;
    }

    return this.buildFeatureReference(layerId, feature);
  }

  private buildFeatureReference(layerId: MapLayerId, feature: MapFeature): NormalizedFeatureReference {
    return {
      featureId: getFeatureId(feature),
      layerId,
      geometry: feature.geometry ?? null,
      properties: feature.properties ?? emptyProperties,
      lngLat: getRepresentativeCoordinate(feature.geometry),
      screenPoint: null
    };
  }

  private setCursorForLayer(layerId: MapLayerId | null) {
    if (!layerId) {
      this.adapter.setCursor(null);
      return;
    }

    const layer = this.layers.get(layerId);
    this.adapter.setCursor(layer?.interactions?.cursor ?? (layer?.interactive ? "pointer" : null));
  }

  private syncVisibleLayers() {
    this.patchInteractionState({
      visibleLayerIds: Array.from(this.layers.values())
        .filter((layer) => layer.visibility !== "hidden")
        .map((layer) => layer.id)
    });
  }

  private isLayerVisible(layerId: MapLayerId) {
    return this.layers.get(layerId)?.visibility !== "hidden";
  }

  private patchInteractionState(partialState: Partial<FeatureSelectionState>) {
    this.interactionStore.patchState(partialState);
  }

  private addFeatureListener(
    listeners: FeatureListenerMap,
    layerId: MapLayerId,
    handler: InteractionHandler<FeatureInteractionEvent>
  ) {
    const layerListeners = listeners.get(layerId) ?? new Set<InteractionHandler<FeatureInteractionEvent>>();
    layerListeners.add(handler);
    listeners.set(layerId, layerListeners);

    return () => {
      const current = listeners.get(layerId);
      current?.delete(handler);
      if (current && current.size === 0) {
        listeners.delete(layerId);
      }
    };
  }

  private emitFeatureListeners(
    listeners: FeatureListenerMap,
    layerId: MapLayerId,
    event: FeatureInteractionEvent
  ) {
    listeners.get(layerId)?.forEach((listener) => listener(event));
  }

  private assertInitialized(action: string) {
    if (!this.initialized || this.destroyed) {
      throw createControllerError(`cannot ${action} before initialize`);
    }
  }

  private assertLayerExists(layerId: MapLayerId, action: string) {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw createControllerError(`cannot ${action} missing layer "${layerId}"`);
    }

    return layer;
  }
}
