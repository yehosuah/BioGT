import { getAccountByAuthUserId, updateMyProfile } from "@/lib/account-service";
import { updateProfileSchema } from "@/lib/submission-schema";
import { requireSession } from "@/lib/server-session";

export async function GET() {
  const session = await requireSession();
  const account = await getAccountByAuthUserId(session.user.id);

  return Response.json({
    user: session.user,
    account
  });
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  const parsed = updateProfileSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await updateMyProfile({
    accountId: session.accountId,
    actorAccountId: session.accountId,
    displayName: parsed.data.displayName,
    bio: parsed.data.bio,
    affiliation: parsed.data.affiliation,
    avatarUrl: parsed.data.avatarUrl
  });

  return Response.json({ account: updated });
}
