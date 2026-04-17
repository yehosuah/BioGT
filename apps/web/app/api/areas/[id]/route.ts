import { getArea, getAreaSpecies, getEntityCitations } from "@/lib/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const area = await getArea(id);

  if (!area) {
    return Response.json({ error: "Area not found" }, { status: 404 });
  }

  return Response.json({
    area,
    species: await getAreaSpecies(area.id),
    citations: await getEntityCitations(area.id)
  });
}
