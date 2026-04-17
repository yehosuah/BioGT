import { NextRequest } from "next/server";

import { coerceMapFilters } from "@/lib/filters";
import { getMapSummary } from "@/lib/repository";

export async function GET(request: NextRequest) {
  const filters = coerceMapFilters(request.nextUrl.searchParams);
  return Response.json(await getMapSummary(filters));
}
