import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MapSearch } from "@/features/map/components/MapSearch";

const results = [
  {
    id: "species-1",
    slug: "quetzal",
    type: "species" as const,
    title: "Quetzal",
    subtitle: "Pharomachrus mocinno",
    href: "/species/quetzal"
  }
];

describe("MapSearch", () => {
  it("updates query and selects result", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onSelectResult = vi.fn();

    render(
      createElement(MapSearch, {
        onQueryChange,
        onSelectResult,
        query: "que",
        results
      })
    );

    await user.type(screen.getByTestId("search-input"), "t");
    expect(onQueryChange).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Quetzal/i }));
    expect(onSelectResult).toHaveBeenCalledWith(results[0]);
  });

  it("renders controlled empty results state", () => {
    render(
      createElement(MapSearch, {
        onQueryChange: vi.fn(),
        onSelectResult: vi.fn(),
        query: "zz",
        results: []
      })
    );

    expect(screen.getByTestId("search-empty")).toHaveTextContent("No hay resultados");
  });
});
