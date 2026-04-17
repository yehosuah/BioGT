import { NextRequest } from "next/server";

import {
  coerceMapFilters,
  coerceMapScopeType,
  coerceMapSpeciesSort,
  coercePositiveInt
} from "@/lib/filters";
import { getMapPanel } from "@/lib/repository";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  return Response.json(
    await getMapPanel({
      scopeType: coerceMapScopeType(params.get("scopeType") ?? undefined),
      scopeId: params.get("scopeId") ?? undefined,
      filters: coerceMapFilters(params),
      sort: coerceMapSpeciesSort(params.get("sort") ?? undefined),
      page: coercePositiveInt(params.get("page") ?? undefined, 1),
      pageSize: coercePositiveInt(params.get("pageSize") ?? undefined, 8)
    })
  );
}
