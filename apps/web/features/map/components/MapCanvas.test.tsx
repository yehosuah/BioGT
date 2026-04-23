import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MapCanvas } from "@/features/map/components/MapCanvas";
import { MapController } from "@/features/map/core/MapController";
import { MapLibreAdapter } from "@/features/map/adapters/MapLibreAdapter";
import { mapTestInitOptions } from "@/features/map/testing/mapTestFixtures";

vi.mock("@/features/map/components/LazyMapLibreDeckCanvas", () => ({
  LazyMapLibreDeckCanvas: ({ children }: { children?: ReactNode }) =>
    createElement("div", { "data-testid": "mock-maplibre-canvas" }, children)
}));

const createProps = (overrides: Record<string, unknown> = {}) => ({
  adapter: new MapLibreAdapter(),
  controller: new MapController(new MapLibreAdapter()),
  mapStyleUrl: "/style.json",
  options: mapTestInitOptions,
  ...overrides
});

describe("MapCanvas", () => {
  it("renders map container", () => {
    render(createElement(MapCanvas, createProps()));

    expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    render(createElement(MapCanvas, createProps({ loading: true })));

    expect(screen.getByTestId("map-loading")).toHaveTextContent("Cargando mapa");
  });

  it("renders empty state", () => {
    render(
      createElement(
        MapCanvas,
        createProps({
          emptyMessage: "No hay datos visibles"
        })
      )
    );

    expect(screen.getByTestId("map-empty")).toHaveTextContent("No hay datos visibles");
  });

  it("renders error state", () => {
    render(
      createElement(
        MapCanvas,
        createProps({
          errorMessage: "No se pudo iniciar el mapa"
        })
      )
    );

    expect(screen.getByTestId("map-error")).toHaveTextContent("No se pudo iniciar el mapa");
  });
});
