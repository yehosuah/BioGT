import { requireRole } from "@/lib/server-session";
import { updateAccountTrust } from "@/lib/account-service";
import { updateTrustSchema } from "@/lib/submission-schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireRole("admin");
  const { id } = await context.params;
  const parsed = updateTrustSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await updateAccountTrust({
    accountId: id,
    actorAccountId: session.accountId,
    trustScore: parsed.data.trustScore,
    trustFlags: parsed.data.trustFlags
  });

  return Response.json({ ok: true });
}
