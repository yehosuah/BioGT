import { describe, expect, it, vi } from "vitest";

import { NullMapAdapter } from "@/features/map/adapters/NullMapAdapter";
import { MapController } from "@/features/map/core/MapController";
import type { MapFeatureCollection, MapInitOptions, MapLayerConfig } from "@/features/map/core/MapTypes";

const container = { id: "map-interaction-shell" } as HTMLElement;

const initOptions: MapInitOptions = {
  provider: "null",
  center: [-90.5069, 14.6349],
  zoom: 7
};

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
        id: "feature-1",
        kind: "department",
        label: "Alta Verapaz",
        speciesCount: 42
      }
    },
    {
      id: "feature-2",
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-90.1069, 14.8349]
      },
      properties: {
        id: "feature-2",
        kind: "department",
        label: "Peten",
        speciesCount: 84
      }
    }
  ]
};

const sampleLayer: MapLayerConfig = {
  id: "departments",
  label: "Departamentos",
  sourceId: "departments-source",
  dataKey: "departments",
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
  requiredProperties: ["id", "kind", "label"],
  states: {
    loading: { message: "Loading departments..." },
    empty: { message: "No departments found." },
    error: { message: "Departments failed to load.", severity: "error" }
  },
  data: sampleCollection,
  interactive: true,
  visibility: "visible"
};

const setup = async () => {
  const adapter = new NullMapAdapter();
  const controller = new MapController(adapter);

  await controller.initialize(container, initOptions);
  controller.addLayer(sampleLayer);
  controller.updateLayerData(sampleLayer.id, sampleCollection);

  return { adapter, controller };
};

describe("MapController interactions", () => {
  it("clicking a feature sets centralized selected state", async () => {
    const { adapter, controller } = await setup();

    adapter.emitFeatureClick(sampleLayer.id, {
      featureId: "feature-1",
      feature: sampleCollection.features[0],
      coordinate: [-90.5069, 14.6349]
    });

    expect(controller.getInteractionState()).toMatchObject({
      selectedFeatureId: "feature-1",
      selectedLayerId: sampleLayer.id,
      activeDetailFeatureId: "feature-1",
      activePopupFeatureId: "feature-1",
      lastInteractionSource: "map"
    });
  });

  it("clicking a second feature replaces previous selection", async () => {
    const { adapter, controller } = await setup();

    adapter.emitFeatureClick(sampleLayer.id, {
      featureId: "feature-1",
      feature: sampleCollection.features[0],
      coordinate: [-90.5069, 14.6349]
    });
    adapter.emitFeatureClick(sampleLayer.id, {
      featureId: "feature-2",
      feature: sampleCollection.features[1],
      coordinate: [-90.1069, 14.8349]
    });

    expect(controller.getInteractionState()).toMatchObject({
      selectedFeatureId: "feature-2",
      selectedLayerId: sampleLayer.id,
      activeDetailFeatureId: "feature-2"
    });
  });

  it("map click clears transient preview without dropping selection", async () => {
    const { adapter, controller } = await setup();

    adapter.emitFeatureClick(sampleLayer.id, {
      featureId: "feature-1",
      feature: sampleCollection.features[0],
      coordinate: [-90.5069, 14.6349]
    });
    adapter.emitFeatureHover(sampleLayer.id, {
      featureId: "feature-2",
      feature: sampleCollection.features[1],
      coordinate: [-90.1069, 14.8349]
    });

    adapter.emitMapClick({
      coordinate: [-90.3, 14.7]
    });

    expect(controller.getInteractionState()).toMatchObject({
      selectedFeatureId: "feature-1",
      hoveredFeatureId: null,
      activePopupFeatureId: null
    });
  });

  it("hidden selected layer clears selection safely", async () => {
    const { controller } = await setup();

    controller.selectFeature(sampleLayer.id, "feature-1");
    controller.setLayerVisibility(sampleLayer.id, "hidden");

    expect(controller.getInteractionState()).toMatchObject({
      selectedFeatureId: null,
      selectedLayerId: null,
      activeDetailFeatureId: null
    });
  });

  it("search result selection triggers selected state", async () => {
    const { controller } = await setup();

    controller.selectFeature(sampleLayer.id, "feature-2", {
      source: "search",
      openPopup: false
    });

    expect(controller.getInteractionState()).toMatchObject({
      selectedFeatureId: "feature-2",
      selectedLayerId: sampleLayer.id,
      lastInteractionSource: "search"
    });
  });

  it("feature hover sets preview state without opening full detail", async () => {
    const { adapter, controller } = await setup();

    adapter.emitFeatureHover(sampleLayer.id, {
      featureId: "feature-1",
      feature: sampleCollection.features[0],
      coordinate: [-90.5069, 14.6349]
    });

    expect(controller.getInteractionState()).toMatchObject({
      hoveredFeatureId: "feature-1",
      hoveredLayerId: sampleLayer.id,
      activePopupFeatureId: "feature-1",
      activeDetailFeatureId: null
    });
  });

  it("feature leave clears hover state", async () => {
    const { adapter, controller } = await setup();

    adapter.emitFeatureHover(sampleLayer.id, {
      featureId: "feature-1",
      feature: sampleCollection.features[0],
      coordinate: [-90.5069, 14.6349]
    });
    adapter.emitFeatureLeave(sampleLayer.id, {
      featureId: "feature-1",
      feature: sampleCollection.features[0],
      coordinate: [-90.5069, 14.6349]
    });

    expect(controller.getInteractionState()).toMatchObject({
      hoveredFeatureId: null,
      hoveredLayerId: null,
      activePopupFeatureId: null
    });
  });

  it("cleanup unregisters controller listeners", async () => {
    const { adapter, controller } = await setup();
    const clickSpy = vi.fn();

    const unsubscribe = controller.onFeatureClick(sampleLayer.id, clickSpy);
    unsubscribe();

    adapter.emitFeatureClick(sampleLayer.id, {
      featureId: "feature-1",
      feature: sampleCollection.features[0],
      coordinate: [-90.5069, 14.6349]
    });

    expect(clickSpy).not.toHaveBeenCalled();

    controller.destroy();
    expect(adapter.getDebugState().featureHandlerCount).toEqual({});
    expect(adapter.getDebugState().mapClickHandlerCount).toBe(0);
  });
});
