import { afterEach, describe, expect, it, vi } from "vitest";

const { mockEnsureAtlasBootstrap, mockQuery } = vi.hoisted(() => ({
  mockEnsureAtlasBootstrap: vi.fn(async () => {}),
  mockQuery: vi.fn()
}));

vi.mock("@/lib/atlas-bootstrap", () => ({
  ensureAtlasBootstrap: mockEnsureAtlasBootstrap
}));

vi.mock("@/lib/db", () => ({
  isDatabaseConfigured: () => true,
  maybeOne: vi.fn(),
  query: mockQuery
}));

describe("database-backed species media", () => {
  afterEach(() => {
    mockEnsureAtlasBootstrap.mockClear();
    mockQuery.mockReset();
    vi.resetModules();
  });

  it("surfaces taxon_media rows through the species panel visual", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "basiliscus-vittatus",
            slug: "basiliscus-vittatus",
            common_name: "Basiliscus vittatus",
            scientific_name: "Basiliscus vittatus",
            taxonomic_group: "reptiles",
            status: "",
            endemism: "",
            summary: "",
            hero_metric: "",
            presence_area_ids: [],
            source_ids: ["biodiversidad-gt"],
            source_tiers: ["institutional"]
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            species_id: "basiliscus-vittatus",
            slug: "basiliscus-vittatus",
            common_name: "Basiliscus vittatus",
            scientific_name: "Basiliscus vittatus",
            taxonomic_group: "reptiles",
            status: "",
            endemism: "",
            summary: "",
            hero_metric: "",
            presence_count: 3,
            latest_observed_at: "2026-03-01",
            source_tiers: ["institutional"],
            media_url: "https://example.com/basiliscus-medium.jpg",
            media_alt_text: "Basiliscus vittatus",
            media_attribution: "Ricard Busquets Reverte",
            media_license: "https://creativecommons.org/licenses/by/4.0/",
            media_source_name: "Portal de Biodiversidad de Guatemala",
            occurrence_total: 3,
            visible_departments: 1,
            visible_protected_areas: 1,
            visible_cells: 2,
            active_sources: 1
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: []
      });

    const { getMapSpeciesPanel } = await import("@/lib/repository");
    const panel = await getMapSpeciesPanel({
      taxonSlug: "basiliscus-vittatus"
    });

    expect(mockEnsureAtlasBootstrap).toHaveBeenCalled();
    expect(panel.focusSpecies.visual).toMatchObject({
      kind: "photo",
      src: "https://example.com/basiliscus-medium.jpg",
      attribution: "Ricard Busquets Reverte",
      license: "https://creativecommons.org/licenses/by/4.0/",
      sourceName: "Portal de Biodiversidad de Guatemala"
    });
  });
});
