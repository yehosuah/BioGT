import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ensureAccountForAuthUser } from "@/lib/account-service";
import { isDatabaseConfigured } from "@/lib/db";
import type { Role, SessionUser } from "@/lib/types";

const roleRank: Record<Role, number> = {
  member: 0,
  contributor: 1,
  moderator: 2,
  admin: 3
};

export type AppSession = {
  accountId: string;
  user: SessionUser;
};

export const getCurrentSession = cache(async (): Promise<AppSession | null> => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return null;
  }

  const account = await ensureAccountForAuthUser({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    emailVerified: session.user.emailVerified
  });

  return {
    accountId: account.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: account.role,
      slug: account.slug,
      emailVerified: session.user.emailVerified
    }
  };
});

export const requireSession = async () => {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
};

export const requireRole = async (minimumRole: Role) => {
  const session = await requireSession();
  if (roleRank[session.user.role] < roleRank[minimumRole]) {
    redirect("/");
  }
  return session;
};
