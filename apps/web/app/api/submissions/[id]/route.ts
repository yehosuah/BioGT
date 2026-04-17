import { getSubmissionById, updateSubmissionDraft } from "@/lib/submissions-service";
import { updateSubmissionSchema } from "@/lib/submission-schema";
import { requireSession } from "@/lib/server-session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await context.params;
  const submission = await getSubmissionById(id);

  if (
    submission.accountId !== session.accountId &&
    !["moderator", "admin"].includes(session.user.role)
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json({ submission });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await context.params;
  const parsed = updateSubmissionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await updateSubmissionDraft({
    actorAccountId: session.accountId,
    accountId: session.accountId,
    submissionId: id,
    title: parsed.data.title,
    payload: parsed.data.payload
  });

  return Response.json({ ok: true });
}
