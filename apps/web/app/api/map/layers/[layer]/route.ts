import { NextRequest } from "next/server";

import { getLayerConfig } from "@/features/map/registry/layerRegistry";
import { coerceMapFilters } from "@/lib/filters";
import { getLayerCollection } from "@/lib/repository";

const coerceBBox = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const parts = value.split(",").map((entry) => Number(entry.trim()));
  if (parts.length !== 4 || parts.some((entry) => !Number.isFinite(entry))) {
    return undefined;
  }

  const [west, south, east, north] = parts;
  return { west, south, east, north };
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ layer: string }> }
) {
  const { layer } = await context.params;
  const filters = coerceMapFilters(request.nextUrl.searchParams);
  const layerConfig = getLayerConfig(layer);

  if (
    !layerConfig ||
    layerConfig.renderMode !== "geojson" ||
    layerConfig.dataSource.kind !== "atlas-api-layer"
  ) {
    return Response.json({ error: "Layer not found" }, { status: 404 });
  }

  return Response.json(
    await getLayerCollection(layer as Parameters<typeof getLayerCollection>[0], filters, {
      bbox: coerceBBox(request.nextUrl.searchParams.get("bbox")),
      taxonSlug: request.nextUrl.searchParams.get("taxonSlug") ?? undefined
    })
  );
}
