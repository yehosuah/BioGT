import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MapLayerToggle } from "@/features/map/components/MapLayerToggle";
import { createPointLayerConfig } from "@/features/map/testing/mapTestFixtures";

describe("MapLayerToggle", () => {
  it("toggles layer visibility state", async () => {
    const user = userEvent.setup();
    const onToggleLayer = vi.fn();
    const layer = createPointLayerConfig();

    render(
      createElement(MapLayerToggle, {
        layerStatuses: {},
        layerVisibility: { [layer.id]: true },
        layers: [layer],
        onToggleLayer
      })
    );

    const toggle = screen.getByTestId("layer-toggle-places");
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(onToggleLayer).toHaveBeenCalledWith("places", false);
  });

  it("communicates disabled or unavailable layer state", () => {
    const layer = createPointLayerConfig({
      id: "zones",
      label: "Zones"
    });

    render(
      createElement(MapLayerToggle, {
        layerStatuses: {
          zones: {
            status: "disabled",
            message: "No disponible en modo actual"
          }
        },
        layerVisibility: { zones: false },
        layers: [layer],
        onToggleLayer: vi.fn()
      })
    );

    expect(screen.getByText("No disponible en modo actual")).toBeInTheDocument();
  });
});
