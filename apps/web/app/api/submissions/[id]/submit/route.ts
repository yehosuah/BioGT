import { requireSession } from "@/lib/server-session";
import { submitSubmission } from "@/lib/submissions-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await context.params;

  if (!session.user.emailVerified) {
    return Response.json({ error: "Verified email required." }, { status: 403 });
  }

  const conflicts = await submitSubmission({
    accountId: session.accountId,
    actorAccountId: session.accountId,
    submissionId: id
  });

  return Response.json({ ok: true, conflicts });
}
