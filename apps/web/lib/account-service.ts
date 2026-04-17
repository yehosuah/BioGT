import { cache } from "react";
import type { PoolClient } from "pg";

import { writeAuditEvent } from "@/lib/audit";
import { maybeOne, one, query, withTransaction } from "@/lib/db";
import type { PublicProfileRecord, Role } from "@/lib/types";

type AuthUserRecord = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

type AccountRow = {
  id: string;
  auth_user_id: string | null;
  slug: string | null;
  display_name: string | null;
  bio: string | null;
  affiliation: string | null;
  avatar_url: string | null;
  role: Role;
  trust_score: number;
  trust_flags: string[];
  email: string | null;
  suspended_at: string | null;
  contribution_count: number;
  approved_contribution_count: number;
  created_at: string;
};

export type AdminAccountRecord = {
  id: string;
  slug: string | null;
  display_name: string | null;
  email: string | null;
  role: Role;
  trust_score: number;
  trust_flags: string[];
  contribution_count: number;
  approved_contribution_count: number;
  suspended_at: string | null;
  created_at: string;
};

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "colaborador";

const nextAvailableSlug = async (client: PoolClient, desired: string, accountId?: string) => {
  let candidate = desired;
  let suffix = 2;

  // Keep the slug lookup simple and deterministic.
  while (true) {
    const taken = await client.query<{ id: string }>(
      `
        select id
        from accounts
        where slug = $1
          and ($2::uuid is null or id <> $2::uuid)
        limit 1
      `,
      [candidate, accountId ?? null]
    );

    if (taken.rowCount === 0) {
      return candidate;
    }

    candidate = `${desired}-${suffix}`;
    suffix += 1;
  }
};

const mapPublicProfile = (row: {
  id: string;
  slug: string;
  display_name: string;
  bio: string | null;
  affiliation: string | null;
  avatar_url: string | null;
  role: Role;
  contribution_count: number;
  approved_contribution_count: number;
  joined_at: string;
}): PublicProfileRecord => ({
  id: row.id,
  slug: row.slug,
  displayName: row.display_name,
  bio: row.bio,
  affiliation: row.affiliation,
  avatarUrl: row.avatar_url,
  role: row.role,
  contributionCount: Number(row.contribution_count ?? 0),
  approvedContributionCount: Number(row.approved_contribution_count ?? 0),
  joinedAt: row.joined_at
});

export const ensureAccountForAuthUser = async (user: AuthUserRecord) =>
  withTransaction(async (client) => {
    const existing = await client.query<AccountRow>(
      `
        select
          id,
          auth_user_id,
          slug,
          display_name,
          bio,
          affiliation,
          avatar_url,
          role,
          trust_score,
          trust_flags,
          email,
          suspended_at,
          contribution_count,
          approved_contribution_count,
          created_at
        from accounts
        where auth_user_id = $1
        limit 1
      `,
      [user.id]
    );

    if (existing.rowCount && existing.rows[0]) {
      const row = existing.rows[0];
      const desiredSlug =
        row.slug ?? slugify((user.name || user.email.split("@")[0]) ?? "colaborador");
      const slug = row.slug ?? (await nextAvailableSlug(client, desiredSlug, row.id));

      const updated = await client.query<AccountRow>(
        `
          update accounts
          set
            slug = $2,
            display_name = coalesce(display_name, $3),
            email = coalesce($4, email)
          where id = $1
          returning
            id,
            auth_user_id,
            slug,
            display_name,
            bio,
            affiliation,
            avatar_url,
            role,
            trust_score,
            trust_flags,
            email,
            suspended_at,
            contribution_count,
            approved_contribution_count,
            created_at
        `,
        [row.id, slug, user.name, user.email]
      );

      return updated.rows[0]!;
    }

    const slug = await nextAvailableSlug(
      client,
      slugify((user.name || user.email.split("@")[0]) ?? "colaborador")
    );
    const inserted = await client.query<AccountRow>(
      `
        insert into accounts (
          auth_user_id,
          slug,
          display_name,
          email,
          role
        )
        values ($1, $2, $3, $4, 'member')
        returning
          id,
          auth_user_id,
          slug,
          display_name,
          bio,
          affiliation,
          avatar_url,
          role,
          trust_score,
          trust_flags,
          email,
          suspended_at,
          contribution_count,
          approved_contribution_count,
          created_at
      `,
      [user.id, slug, user.name, user.email]
    );

    await writeAuditEvent(
      {
        actorAccountId: inserted.rows[0]!.id,
        eventType: "account.created_from_auth",
        entityType: "account",
        entityRef: inserted.rows[0]!.id,
        afterPayload: {
          authUserId: user.id,
          slug,
          displayName: user.name,
          email: user.email
        }
      },
      client
    );

    return inserted.rows[0]!;
  });

export const getAccountByAuthUserId = cache(async (authUserId: string) =>
  maybeOne<AccountRow>(
    `
      select
        id,
        auth_user_id,
        slug,
        display_name,
        bio,
        affiliation,
        avatar_url,
        role,
        trust_score,
        trust_flags,
        email,
        suspended_at,
        contribution_count,
        approved_contribution_count,
        created_at
      from accounts
      where auth_user_id = $1
      limit 1
    `,
    [authUserId]
  )
);

export const getPublicProfileBySlug = cache(
  async (slug: string): Promise<PublicProfileRecord | null> => {
  const row = await maybeOne<{
    id: string;
    slug: string;
    display_name: string;
    bio: string | null;
    affiliation: string | null;
    avatar_url: string | null;
    role: Role;
    contribution_count: number;
    approved_contribution_count: number;
    joined_at: string;
  }>(
    `
      select
        id,
        slug,
        display_name,
        bio,
        affiliation,
        avatar_url,
        role,
        contribution_count,
        approved_contribution_count,
        joined_at
      from contributor_profiles
      where slug = $1
      limit 1
    `,
    [slug]
  );

  return row ? mapPublicProfile(row) : null;
});

export const updateMyProfile = async ({
  accountId,
  actorAccountId,
  affiliation,
  avatarUrl,
  bio,
  displayName
}: {
  accountId: string;
  actorAccountId: string;
  affiliation: string | null;
  avatarUrl: string | null;
  bio: string | null;
  displayName: string;
}) =>
  withTransaction(async (client) => {
    const previous = await one<AccountRow>(
      `
        select
          id,
          auth_user_id,
          slug,
          display_name,
          bio,
          affiliation,
          avatar_url,
          role,
          trust_score,
          trust_flags,
          email,
          suspended_at,
          contribution_count,
          approved_contribution_count,
          created_at
        from accounts
        where id = $1
      `,
      [accountId]
    );

    const updated = await client.query<AccountRow>(
      `
        update accounts
        set
          display_name = $2,
          bio = $3,
          affiliation = $4,
          avatar_url = $5
        where id = $1
        returning
          id,
          auth_user_id,
          slug,
          display_name,
          bio,
          affiliation,
          avatar_url,
          role,
          trust_score,
          trust_flags,
          email,
          suspended_at,
          contribution_count,
          approved_contribution_count,
          created_at
      `,
      [accountId, displayName, bio, affiliation, avatarUrl]
    );

    await writeAuditEvent(
      {
        actorAccountId,
        eventType: "account.profile_updated",
        entityType: "account",
        entityRef: accountId,
        beforePayload: {
          displayName: previous.display_name,
          bio: previous.bio,
          affiliation: previous.affiliation,
          avatarUrl: previous.avatar_url
        },
        afterPayload: {
          displayName,
          bio,
          affiliation,
          avatarUrl
        }
      },
      client
    );

    return updated.rows[0]!;
  });

export const listAdminAccounts = cache(async (): Promise<AdminAccountRecord[]> => {
  const result = await query<AdminAccountRecord>(
    `
      select
        id,
        slug,
        display_name,
        email,
        role,
        trust_score,
        trust_flags,
        contribution_count,
        approved_contribution_count,
        suspended_at,
        created_at
      from accounts
      order by created_at desc
    `
  );

  return result.rows;
});

export const updateAccountRole = async ({
  accountId,
  actorAccountId,
  role
}: {
  accountId: string;
  actorAccountId: string;
  role: Role;
}) =>
  withTransaction(async (client) => {
    const previous = await one<{ role: Role }>(`select role from accounts where id = $1`, [accountId]);
    await client.query(`update accounts set role = $2::app_role where id = $1`, [accountId, role]);
    await writeAuditEvent(
      {
        actorAccountId,
        eventType: "account.role_updated",
        entityType: "account",
        entityRef: accountId,
        beforePayload: { role: previous.role },
        afterPayload: { role }
      },
      client
    );
  });

export const updateAccountTrust = async ({
  accountId,
  actorAccountId,
  trustFlags,
  trustScore
}: {
  accountId: string;
  actorAccountId: string;
  trustFlags: string[];
  trustScore: number;
}) =>
  withTransaction(async (client) => {
    const previous = await one<{ trust_score: number; trust_flags: string[] }>(
      `select trust_score, trust_flags from accounts where id = $1`,
      [accountId]
    );
    await client.query(
      `
        update accounts
        set trust_score = $2, trust_flags = $3::jsonb
        where id = $1
      `,
      [accountId, trustScore, JSON.stringify(trustFlags)]
    );
    await writeAuditEvent(
      {
        actorAccountId,
        eventType: "account.trust_updated",
        entityType: "account",
        entityRef: accountId,
        beforePayload: {
          trustScore: previous.trust_score,
          trustFlags: previous.trust_flags
        },
        afterPayload: {
          trustScore,
          trustFlags
        }
      },
      client
    );
  });
