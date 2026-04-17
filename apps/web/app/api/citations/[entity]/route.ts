import { getEntityCitations } from "@/lib/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ entity: string }> }
) {
  const { entity } = await context.params;
  const decoded = decodeURIComponent(entity);
  const entityId = decoded.includes(":") ? decoded.split(":").slice(1).join(":") : decoded;
  return Response.json({ citations: await getEntityCitations(entityId) });
}
