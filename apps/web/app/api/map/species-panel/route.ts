import { NextRequest } from "next/server";

import { coerceMapFilters } from "@/lib/filters";
import { getMapSpeciesPanel } from "@/lib/repository";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  return Response.json(
    await getMapSpeciesPanel({
      taxonSlug: params.get("taxonSlug") ?? undefined,
      filters: coerceMapFilters(params)
    })
  );
}
