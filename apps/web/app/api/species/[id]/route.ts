import { getEntityCitations, getSpecies, getSpeciesAreas } from "@/lib/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const species = await getSpecies(id);

  if (!species) {
    return Response.json({ error: "Species not found" }, { status: 404 });
  }

  return Response.json({
    species,
    areas: await getSpeciesAreas(species.id),
    citations: await getEntityCitations(species.id)
  });
}
