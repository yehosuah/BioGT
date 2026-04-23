import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MobileBottomSheet } from "@/features/map/components/MobileBottomSheet";

describe("MobileBottomSheet", () => {
  it("opens on feature selection and can dismiss", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      createElement(
        MobileBottomSheet,
        {
          feature: {
            layerId: "places",
            featureId: "place-1",
            properties: {
              label: "Quetzal Ridge"
            }
          },
          onClose,
          open: true
        },
        createElement("button", { type: "button" }, "Acción crítica")
      )
    );

    expect(screen.getByTestId("mobile-bottom-sheet")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("button", { name: "Acción crítica" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cerrar panel móvil" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
