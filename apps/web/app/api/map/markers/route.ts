import { NextRequest } from "next/server";

import {
  coerceMapFilters,
  coerceMapMarkerMode,
  coerceMapScopeType
} from "@/lib/filters";
import { getMapMarkers } from "@/lib/repository";

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

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  return Response.json(
    await getMapMarkers({
      mode: coerceMapMarkerMode(params.get("mode") ?? undefined),
      scopeType: coerceMapScopeType(params.get("scopeType") ?? undefined),
      scopeId: params.get("scopeId") ?? undefined,
      filters: coerceMapFilters(params),
      bbox: coerceBBox(params.get("bbox"))
    })
  );
}
