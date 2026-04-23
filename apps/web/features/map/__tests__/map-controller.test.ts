import { describe, expect, it, vi } from "vitest";

import { MapController } from "@/features/map/core/MapController";
import type { MapAdapter } from "@/features/map/core/MapAdapter";
import type {
  FeatureClickHandler,
  FeatureHoverHandler,
  MapClickHandler,
  MapFeatureCollection,
  MapFeatureId,
  MapInitOptions,
  MapLayerConfig,
  MapProviderName,
  MapViewportChangeHandler
} from "@/features/map/core/MapTypes";

const container = { id: "map-shell" } as HTMLElement;

const sampleCollection: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      id: "feature-1",
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-90.5069, 14.6349]
      },
      properties: {
        label: "Specimen 1"
      }
    }
  ]
};

const sampleLayer: MapLayerConfig = {
  id: "places",
  label: "Places",
  sourceId: "places-source",
  dataKey: "places",
  dataSource: {
    kind: "custom",
    dataShape: "geojson"
  },
  geometryType: "point",
  layerKind: "circle",
  renderMode: "geojson",
  visibleByDefault: true,
  toggleable: true,
  type: "point",
  selectable: true,
  order: 10,
  requiredProperties: [],
  states: {
    loading: { message: "Loading places..." },
    empty: { message: "No places found." },
    error: { message: "Places failed to load.", severity: "error" }
  },
  data: sampleCollection,
  interactive: true,
  visibility: "visible"
};

const initOptions: MapInitOptions = {
  provider: "null",
  center: [-90.5069, 14.6349],
  zoom: 7
};

class FakeMapAdapter implements MapAdapter {
  public getProviderName = vi.fn((): MapProviderName => "null");
  public initialize = vi.fn(async (_container: HTMLElement, _options: MapInitOptions) => {});
  public setView = vi.fn((_center, _zoom) => {});
  public fitBounds = vi.fn((_bounds, _options) => {});
  public addGeoJSONLayer = vi.fn((_layer: MapLayerConfig) => {});
  public removeLayer = vi.fn((_layerId: string) => {});
  public updateLayerData = vi.fn((_layerId: string, _data: MapFeatureCollection) => {});
  public setLayerVisibility = vi.fn((_layerId: string, _visibility) => {});
  public addMarker = vi.fn((_config) => "marker:test");
  public removeMarker = vi.fn((_markerId: string) => {});
  public onFeatureClick = vi.fn((_layerId: string, _handler: FeatureClickHandler) => vi.fn());
  public onFeatureHover = vi.fn((_layerId: string, _handler: FeatureHoverHandler) => vi.fn());
  public onFeatureLeave = vi.fn((_layerId: string, _handler: FeatureClickHandler) => vi.fn());
  public onMapClick = vi.fn((_handler: MapClickHandler) => vi.fn());
  public onViewportChange = vi.fn((_handler: MapViewportChangeHandler) => vi.fn());
  public openPopup = vi.fn((_config) => {});
  public closePopup = vi.fn(() => {});
  public selectFeature = vi.fn((_layerId: string | null, _featureId: MapFeatureId | null) => {});
  public clearSelection = vi.fn(() => {});
  public highlightFeature = vi.fn((_layerId: string | null, _featureId: MapFeatureId | null) => {});
  public clearHighlight = vi.fn(() => {});
  public setCursor = vi.fn((_cursor: string | null) => {});
  public destroy = vi.fn(() => {});
}

describe("MapController", () => {
  it("throws when used before initialize", () => {
    const controller = new MapController(new FakeMapAdapter());

    expect(() => controller.setView([-90.5, 14.6], 8)).toThrow(/initialize/i);
  });

  it("registers a layer and delegates addGeoJSONLayer", async () => {
    const adapter = new FakeMapAdapter();
    const controller = new MapController(adapter);

    await controller.initialize(container, initOptions);
    controller.addLayer(sampleLayer);

    expect(adapter.addGeoJSONLayer).toHaveBeenCalledWith(sampleLayer);
  });

  it("updates a known layer and delegates updateLayerData", async () => {
    const adapter = new FakeMapAdapter();
    const controller = new MapController(adapter);

    await controller.initialize(container, initOptions);
    controller.addLayer(sampleLayer);
    controller.updateLayerData(sampleLayer.id, sampleCollection);

    expect(adapter.updateLayerData).toHaveBeenCalledWith(sampleLayer.id, sampleCollection);
  });

  it("removes a known layer and delegates removeLayer", async () => {
    const adapter = new FakeMapAdapter();
    const controller = new MapController(adapter);

    await controller.initialize(container, initOptions);
    controller.addLayer(sampleLayer);
    controller.removeLayer(sampleLayer.id);

    expect(adapter.removeLayer).toHaveBeenCalledWith(sampleLayer.id);
  });

  it("returns unsubscribe functions for feature and map listeners", async () => {
    const adapter = new FakeMapAdapter();
    const controller = new MapController(adapter);
    await controller.initialize(container, initOptions);
    controller.addLayer(sampleLayer);

    const featureUnsubscribe = controller.onFeatureClick(sampleLayer.id, vi.fn());
    const mapUnsubscribe = controller.onMapClick(vi.fn());

    expect(typeof featureUnsubscribe).toBe("function");
    expect(typeof mapUnsubscribe).toBe("function");
    expect(adapter.onFeatureClick).toHaveBeenCalledTimes(1);
    expect(adapter.onMapClick).toHaveBeenCalledTimes(1);
  });

  it("forwards selection commands through adapter", async () => {
    const adapter = new FakeMapAdapter();
    const controller = new MapController(adapter);

    await controller.initialize(container, initOptions);
    controller.addLayer(sampleLayer);
    controller.selectFeature(sampleLayer.id, "feature-1");
    controller.clearSelection();

    expect(adapter.selectFeature).toHaveBeenCalledWith(sampleLayer.id, "feature-1");
    expect(adapter.clearSelection).toHaveBeenCalledTimes(1);
  });

  it("destroys adapter and clears internal state", async () => {
    const adapter = new FakeMapAdapter();
    const controller = new MapController(adapter);

    await controller.initialize(container, initOptions);
    controller.addLayer(sampleLayer);
    controller.destroy();

    expect(adapter.destroy).toHaveBeenCalledTimes(1);
    expect(() => controller.updateLayerData(sampleLayer.id, sampleCollection)).toThrow(/initialize/i);
  });
});
