import { requireRole } from "@/lib/server-session";
import { getModerationSubmissionDetail } from "@/lib/submissions-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireRole("moderator");
  const { id } = await context.params;
  return Response.json(await getModerationSubmissionDetail(id));
}
