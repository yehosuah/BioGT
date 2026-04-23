import { describe, expect, it } from "vitest";

import { MapController } from "@/features/map/core/MapController";
import { MockMapAdapter } from "@/features/map/testing/MockMapAdapter";
import {
  createPointLayerConfig,
  mapTestInitOptions,
  placesFixture
} from "@/features/map/testing/mapTestFixtures";

describe("MockMapAdapter contract", () => {
  it("records provider-independent controller calls", async () => {
    const adapter = new MockMapAdapter();
    const controller = new MapController(adapter);
    const layer = createPointLayerConfig();
    const container = { id: "map-shell" } as HTMLElement;

    await controller.initialize(container, mapTestInitOptions);
    controller.addLayer(layer);
    controller.setView([-90.4, 14.7], 8);
    controller.fitBounds([-90.6, 14.5, -90.2, 14.9], {
      padding: 24
    });
    controller.updateLayerData(layer.id, placesFixture);

    expect(adapter.getCallHistory().map((entry) => entry.name)).toEqual([
      "initialize",
      "addGeoJSONLayer",
      "setView",
      "fitBounds",
      "updateLayerData"
    ]);
    expect(adapter.hasLayer(layer.id)).toBe(true);
    expect(adapter.getLayer(layer.id)?.data).toEqual(placesFixture);
  });

  it("can trigger feature and map clicks without real provider SDK", async () => {
    const adapter = new MockMapAdapter();
    const controller = new MapController(adapter);
    const layer = createPointLayerConfig();
    const container = { id: "map-shell" } as HTMLElement;

    await controller.initialize(container, mapTestInitOptions);
    controller.addLayer(layer);

    adapter.triggerFeatureClick(layer.id, placesFixture.features[0]);
    expect(controller.getInteractionState()).toMatchObject({
      selectedLayerId: layer.id,
      selectedFeatureId: "place-1",
      activeDetailFeatureId: "place-1"
    });

    adapter.triggerMapClick({
      coordinate: [-90.3, 14.7]
    });
    expect(controller.getInteractionState()).toMatchObject({
      hoveredFeatureId: null,
      activePopupFeatureId: null
    });
  });
});
