import { requireRole } from "@/lib/server-session";
import { reviewSubmission } from "@/lib/submissions-service";
import { reviewSubmissionSchema } from "@/lib/submission-schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireRole("moderator");
  const { id } = await context.params;
  const parsed = reviewSubmissionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  return Response.json(
    await reviewSubmission({
      reviewerId: session.accountId,
      actorAccountId: session.accountId,
      submissionId: id,
      input: parsed.data
    })
  );
}
