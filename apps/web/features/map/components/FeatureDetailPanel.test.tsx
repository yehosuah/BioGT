import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FeatureDetailPanel } from "@/features/map/components/FeatureDetailPanel";

describe("FeatureDetailPanel", () => {
  it("shows selected feature metadata", () => {
    render(
      createElement(
        FeatureDetailPanel,
        {
          feature: {
            layerId: "species_markers",
            featureId: "place-1",
            properties: {
              label: "Quetzal Ridge",
              category: "bird",
              status: "visible"
            }
          },
          isActive: true,
          onClose: vi.fn()
        },
        createElement("div", null, "bird / visible")
      )
    );

    expect(screen.getByTestId("feature-title")).toHaveTextContent("Quetzal Ridge");
    expect(screen.getByText("bird / visible")).toBeInTheDocument();
  });

  it("handles missing optional fields with fallback title", () => {
    render(
      createElement(
        FeatureDetailPanel,
        {
          feature: null,
          isActive: false,
          onClose: vi.fn()
        },
        createElement("div")
      )
    );

    expect(screen.getByTestId("feature-detail-empty")).toHaveTextContent(
      "Selecciona un elemento del mapa"
    );
  });

  it("can close active detail panel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      createElement(
        FeatureDetailPanel,
        {
          feature: {
            layerId: "places",
            featureId: "place-1",
            properties: {
              name: "Quetzal Ridge"
            }
          },
          isActive: true,
          onClose
        },
        createElement("div", null, "detail")
      )
    );

    await user.click(screen.getByRole("button", { name: "Cerrar detalle del mapa" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
