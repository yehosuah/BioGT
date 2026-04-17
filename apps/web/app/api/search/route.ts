import { NextRequest } from "next/server";

import { searchEntities } from "@/lib/repository";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";
  return Response.json({ results: await searchEntities(query) });
}
