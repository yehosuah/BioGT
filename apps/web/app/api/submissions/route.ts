import { createSubmission, listMySubmissions } from "@/lib/submissions-service";
import { createSubmissionSchema } from "@/lib/submission-schema";
import { requireSession } from "@/lib/server-session";

export async function GET() {
  const session = await requireSession();
  return Response.json({
    submissions: await listMySubmissions(session.accountId)
  });
}

export async function POST(request: Request) {
  const session = await requireSession();

  if (!session.user.emailVerified) {
    return Response.json({ error: "Verified email required." }, { status: 403 });
  }

  const parsed = createSubmissionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const submissionId = await createSubmission({
    accountId: session.accountId,
    actorAccountId: session.accountId,
    input: parsed.data
  });

  return Response.json({ submissionId }, { status: 201 });
}
