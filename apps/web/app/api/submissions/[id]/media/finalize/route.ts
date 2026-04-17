import { finalizeSubmissionMedia } from "@/lib/submissions-service";
import { finalizeUploadSchema } from "@/lib/submission-schema";
import { requireSession } from "@/lib/server-session";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await context.params;
  const parsed = finalizeUploadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await finalizeSubmissionMedia({
    accountId: session.accountId,
    actorAccountId: session.accountId,
    submissionId: id,
    input: parsed.data
  });

  return Response.json({ ok: true });
}
