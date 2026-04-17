import type { PoolClient } from "pg";

import { getPool } from "@/lib/db";

type AuditEventInput = {
  actorAccountId?: string | null;
  eventType: string;
  entityType: string;
  entityRef: string;
  beforePayload?: Record<string, unknown>;
  afterPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export const writeAuditEvent = async (
  {
    actorAccountId = null,
    eventType,
    entityType,
    entityRef,
    beforePayload = {},
    afterPayload = {},
    metadata = {}
  }: AuditEventInput,
  client?: PoolClient
) => {
  const executor = client ?? getPool();
  await executor.query(
    `
      insert into audit_log (
        actor_account_id,
        event_type,
        entity_type,
        entity_ref,
        payload,
        before_payload,
        after_payload,
        metadata
      )
      values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
    `,
    [
      actorAccountId,
      eventType,
      entityType,
      entityRef,
      JSON.stringify(afterPayload),
      JSON.stringify(beforePayload),
      JSON.stringify(afterPayload),
      JSON.stringify(metadata)
    ]
  );
};
