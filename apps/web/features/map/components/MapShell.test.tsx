import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MapShell } from "@/features/map/components/MapShell";

vi.mock("@/components/map-explorer", () => ({
  MapExplorer: () => createElement("div", { "data-testid": "map-explorer-stub" }, "Explorer")
}));

describe("MapShell", () => {
  it("renders stable shell container", () => {
    render(createElement(MapShell));

    expect(screen.getByTestId("map-shell")).toBeInTheDocument();
    expect(screen.getByTestId("map-explorer-stub")).toBeInTheDocument();
  });
});
