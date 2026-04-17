import { requireRole } from "@/lib/server-session";
import { updateAccountRole } from "@/lib/account-service";
import { updateRoleSchema } from "@/lib/submission-schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireRole("admin");
  const { id } = await context.params;
  const parsed = updateRoleSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await updateAccountRole({
    accountId: id,
    actorAccountId: session.accountId,
    role: parsed.data.role
  });

  return Response.json({ ok: true });
}
