import { createObjectKey, createUploadUrl, getStorageBucket } from "@/lib/storage";
import { writeAuditEvent } from "@/lib/audit";
import { one, query, withTransaction } from "@/lib/db";
import type {
  AuditLogRecord,
  ModerationQueueItem,
  ModerationReviewRecord,
  Role,
  SubmissionMediaRecord,
  SubmissionRecord,
  SubmissionStatus
} from "@/lib/types";
import type {
  CreateSubmissionInput,
  FinalizeUploadInput,
  PresignUploadInput,
  ReviewSubmissionInput
} from "@/lib/submission-schema";

const allowedUploadTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime"
]);

type SubmissionRow = {
  id: string;
  title: string;
  account_id: string;
  account_slug: string | null;
  account_display_name: string | null;
  submission_type: SubmissionRecord["submissionType"];
  status: SubmissionStatus;
  schema_version: number;
  target_entity_type: SubmissionRecord["targetEntityType"];
  target_entity_ref: string | null;
  payload: Record<string, unknown>;
  reviewer_notes: string | null;
  conflict_summary: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

const mapMedia = (row: {
  id: string;
  file_name: string | null;
  content_type: string | null;
  byte_size: number | null;
  checksum_sha256: string | null;
  bucket: string | null;
  object_key: string | null;
  upload_status: SubmissionMediaRecord["uploadStatus"];
  uploaded_at: string | null;
  finalized_at: string | null;
  metadata: Record<string, unknown> | null;
}): SubmissionMediaRecord => ({
  id: row.id,
  fileName: row.file_name ?? "",
  contentType: row.content_type ?? "application/octet-stream",
  byteSize: Number(row.byte_size ?? 0),
  checksumSha256: row.checksum_sha256 ?? "",
  bucket: row.bucket ?? "",
  objectKey: row.object_key ?? "",
  uploadStatus: row.upload_status,
  uploadedAt: row.uploaded_at,
  finalizedAt: row.finalized_at,
  metadata: row.metadata ?? {}
});

const mapSubmission = (
  row: SubmissionRow,
  media: SubmissionMediaRecord[]
): SubmissionRecord => ({
  id: row.id,
  title: row.title,
  accountId: row.account_id,
  accountSlug: row.account_slug,
  accountDisplayName: row.account_display_name,
  submissionType: row.submission_type,
  status: row.status,
  schemaVersion: Number(row.schema_version),
  targetEntityType: row.target_entity_type,
  targetEntityRef: row.target_entity_ref,
  payload: row.payload ?? {},
  reviewerNotes: row.reviewer_notes,
  conflictSummary: row.conflict_summary ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  submittedAt: row.submitted_at,
  media
});

const submissionQuery = `
  select
    sub.id,
    sub.title,
    sub.account_id,
    acc.slug as account_slug,
    acc.display_name as account_display_name,
    sub.submission_type::text as submission_type,
    sub.status::text as status,
    sub.schema_version,
    sub.target_entity_type,
    sub.target_entity_ref,
    sub.payload,
    sub.reviewer_notes,
    sub.conflict_summary,
    sub.created_at,
    sub.updated_at,
    sub.submitted_at
  from submissions sub
  join accounts acc on acc.id = sub.account_id
`;

const loadMedia = async (submissionId: string) => {
  const result = await query<{
    id: string;
    file_name: string | null;
    content_type: string | null;
    byte_size: number | null;
    checksum_sha256: string | null;
    bucket: string | null;
    object_key: string | null;
    upload_status: SubmissionMediaRecord["uploadStatus"];
    uploaded_at: string | null;
    finalized_at: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `
      select
        id,
        file_name,
        content_type,
        byte_size,
        checksum_sha256,
        bucket,
        object_key,
        upload_status::text as upload_status,
        uploaded_at,
        finalized_at,
        metadata
      from submission_media
      where submission_id = $1
      order by created_at asc
    `,
    [submissionId]
  );

  return result.rows.map(mapMedia);
};

const loadConflictsForSubmission = async (submissionId: string) => {
  const result = await query<{
    id: string;
    left_source_id: string | null;
    right_source_id: string | null;
    field_path: string;
    left_value: Record<string, unknown>;
    right_value: Record<string, unknown>;
    resolution: string | null;
  }>(
    `
      select
        id,
        left_source_id,
        right_source_id,
        field_path,
        left_value,
        right_value,
        resolution
      from source_conflicts
      where submission_id = $1
      order by created_at asc
    `,
    [submissionId]
  );

  return result.rows;
};

const detectConflicts = async ({
  submissionId,
  targetEntityRef,
  targetEntityType
}: {
  submissionId: string;
  targetEntityRef: string | null;
  targetEntityType: string | null;
}) => {
  if (!targetEntityRef || !targetEntityType) {
    return [];
  }

  const result = await query<{
    institutional_source_id: string | null;
    community_source_id: string | null;
  }>(
    `
      select
        min(case when src.tier in ('official', 'institutional') then src.id end) as institutional_source_id,
        min(case when src.tier = 'community' then src.id end) as community_source_id
      from entity_source_links links
      join sources src on src.id = links.source_id
      where links.entity_type = $1
        and links.entity_ref = $2
    `,
    [targetEntityType, targetEntityRef]
  );

  const row = result.rows[0];
  if (!row?.institutional_source_id || !row.community_source_id) {
    return [];
  }

  return withTransaction(async (client) => {
    const inserted = await client.query<{
      id: string;
      left_source_id: string | null;
      right_source_id: string | null;
      field_path: string;
      left_value: Record<string, unknown>;
      right_value: Record<string, unknown>;
      resolution: string | null;
    }>(
      `
        insert into source_conflicts (
          submission_id,
          entity_type,
          entity_ref,
          field_path,
          left_source_id,
          right_source_id,
          left_value,
          right_value
        )
        values (
          $1,
          $2,
          $3,
          'pending_review',
          $4,
          $5,
          '{}'::jsonb,
          '{}'::jsonb
        )
        returning
          id,
          left_source_id,
          right_source_id,
          field_path,
          left_value,
          right_value,
          resolution
      `,
      [
        submissionId,
        targetEntityType,
        targetEntityRef,
        row.institutional_source_id,
        row.community_source_id
      ]
    );

    return inserted.rows;
  });
};

const createOverlayEntries = (submission: SubmissionRecord) => {
  switch (submission.submissionType) {
    case "observation_create":
      return Object.entries(submission.payload).map(([fieldPath, value]) => ({
        entityType: "observation",
        entityRef: submission.id,
        fieldPath,
        value
      }));
    case "data_correction":
      return [
        {
          entityType: submission.targetEntityType ?? "dataset",
          entityRef: submission.targetEntityRef ?? submission.id,
          fieldPath: String(submission.payload.fieldPath ?? "correction"),
          value: submission.payload.proposedValue
        }
      ];
    case "species_editorial":
    case "area_editorial":
      return Object.entries(submission.payload).map(([fieldPath, value]) => ({
        entityType: submission.targetEntityType ?? "dataset",
        entityRef: submission.targetEntityRef ?? submission.id,
        fieldPath,
        value
      }));
    default:
      return [];
  }
};

export const createSubmission = async ({
  accountId,
  actorAccountId,
  input
}: {
  accountId: string;
  actorAccountId: string;
  input: CreateSubmissionInput;
}) =>
  withTransaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `
        insert into submissions (
          account_id,
          title,
          submission_type,
          status,
          schema_version,
          target_entity_type,
          target_entity_ref,
          payload
        )
        values ($1, $2, $3::submission_type_enum, 'draft', $4, $5, $6, $7::jsonb)
        returning id
      `,
      [
        accountId,
        input.title,
        input.submissionType,
        input.schemaVersion,
        input.targetEntityType ?? null,
        input.targetEntityRef ?? null,
        JSON.stringify(input.payload)
      ]
    );

    await writeAuditEvent(
      {
        actorAccountId,
        eventType: "submission.created",
        entityType: "submission",
        entityRef: inserted.rows[0]!.id,
        afterPayload: input
      },
      client
    );

    return inserted.rows[0]!.id;
  });

export const listMySubmissions = async (accountId: string) => {
  const result = await query<SubmissionRow>(
    `
      ${submissionQuery}
      where sub.account_id = $1
      order by sub.created_at desc
    `,
    [accountId]
  );

  return Promise.all(
    result.rows.map(async (row) => mapSubmission(row, await loadMedia(row.id)))
  );
};

export const getSubmissionById = async (submissionId: string) => {
  const row = await one<SubmissionRow>(
    `
      ${submissionQuery}
      where sub.id = $1
      limit 1
    `,
    [submissionId]
  );

  return mapSubmission(row, await loadMedia(submissionId));
};

export const updateSubmissionDraft = async ({
  actorAccountId,
  accountId,
  payload,
  submissionId,
  title
}: {
  actorAccountId: string;
  accountId: string;
  submissionId: string;
  title?: string;
  payload?: Record<string, unknown>;
}) =>
  withTransaction(async (client) => {
    const current = await client.query<{
      title: string;
      payload: Record<string, unknown>;
      status: SubmissionStatus;
    }>(
      `
        select title, payload, status::text as status
        from submissions
        where id = $1 and account_id = $2
        limit 1
      `,
      [submissionId, accountId]
    );

    if (!current.rowCount || !current.rows[0]) {
      throw new Error("Submission not found.");
    }

    if (!["draft", "changes_requested"].includes(current.rows[0].status)) {
      throw new Error("Only draft or changes-requested submissions can be edited.");
    }

    await client.query(
      `
        update submissions
        set
          title = coalesce($3, title),
          payload = coalesce($4::jsonb, payload)
        where id = $1 and account_id = $2
      `,
      [submissionId, accountId, title ?? null, payload ? JSON.stringify(payload) : null]
    );

    await writeAuditEvent(
      {
        actorAccountId,
        eventType: "submission.updated",
        entityType: "submission",
        entityRef: submissionId,
        beforePayload: current.rows[0].payload,
        afterPayload: payload ?? current.rows[0].payload,
        metadata: {
          title: title ?? current.rows[0].title
        }
      },
      client
    );
  });

export const presignSubmissionMedia = async ({
  accountId,
  actorAccountId,
  input,
  submissionId
}: {
  accountId: string;
  actorAccountId: string;
  submissionId: string;
  input: PresignUploadInput;
}) => {
  if (!allowedUploadTypes.has(input.contentType)) {
    throw new Error("Unsupported media type.");
  }

  return withTransaction(async (client) => {
    const submission = await client.query<{ id: string }>(
      `
        select id
        from submissions
        where id = $1 and account_id = $2
        limit 1
      `,
      [submissionId, accountId]
    );

    if (!submission.rowCount) {
      throw new Error("Submission not found.");
    }

    const objectKey = createObjectKey({
      fileName: input.fileName,
      submissionId
    });
    const bucket = getStorageBucket();
    const uploadUrl = await createUploadUrl({
      contentType: input.contentType,
      objectKey
    });

    const inserted = await client.query<{ id: string }>(
      `
        insert into submission_media (
          submission_id,
          storage_path,
          media_type,
          bucket,
          object_key,
          file_name,
          content_type,
          byte_size,
          checksum_sha256,
          upload_status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'presigned')
        returning id
      `,
      [
        submissionId,
        `${bucket}/${objectKey}`,
        input.contentType,
        bucket,
        objectKey,
        input.fileName,
        input.contentType,
        input.byteSize,
        input.checksumSha256
      ]
    );

    await writeAuditEvent(
      {
        actorAccountId,
        eventType: "submission.media_presigned",
        entityType: "submission_media",
        entityRef: inserted.rows[0]!.id,
        afterPayload: {
          bucket,
          objectKey,
          fileName: input.fileName,
          contentType: input.contentType,
          byteSize: input.byteSize
        }
      },
      client
    );

    return {
      mediaId: inserted.rows[0]!.id,
      uploadUrl,
      objectKey,
      headers: {
        "Content-Type": input.contentType
      }
    };
  });
};

export const finalizeSubmissionMedia = async ({
  accountId,
  actorAccountId,
  input,
  submissionId
}: {
  accountId: string;
  actorAccountId: string;
  submissionId: string;
  input: FinalizeUploadInput;
}) =>
  withTransaction(async (client) => {
    const previous = await client.query<{
      id: string;
      upload_status: SubmissionMediaRecord["uploadStatus"];
    }>(
      `
        select media.id, media.upload_status::text as upload_status
        from submission_media media
        join submissions sub on sub.id = media.submission_id
        where media.object_key = $1
          and media.submission_id = $2
          and sub.account_id = $3
        limit 1
      `,
      [input.objectKey, submissionId, accountId]
    );

    if (!previous.rowCount || !previous.rows[0]) {
      throw new Error("Upload placeholder not found.");
    }

    await client.query(
      `
        update submission_media
        set
          file_name = $2,
          content_type = $3,
          byte_size = $4,
          checksum_sha256 = $5,
          metadata = $6::jsonb,
          upload_status = 'finalized',
          uploaded_at = now(),
          finalized_at = now()
        where id = $1
      `,
      [
        previous.rows[0].id,
        input.fileName,
        input.contentType,
        input.byteSize,
        input.checksumSha256,
        JSON.stringify(input.metadata)
      ]
    );

    await writeAuditEvent(
      {
        actorAccountId,
        eventType: "submission.media_finalized",
        entityType: "submission_media",
        entityRef: previous.rows[0].id,
        beforePayload: {
          uploadStatus: previous.rows[0].upload_status
        },
        afterPayload: {
          uploadStatus: "finalized",
          fileName: input.fileName,
          contentType: input.contentType,
          byteSize: input.byteSize,
          checksumSha256: input.checksumSha256
        }
      },
      client
    );
  });

export const submitSubmission = async ({
  accountId,
  actorAccountId,
  submissionId
}: {
  accountId: string;
  actorAccountId: string;
  submissionId: string;
}) =>
  withTransaction(async (client) => {
    const current = await client.query<{
      status: SubmissionStatus;
      target_entity_type: string | null;
      target_entity_ref: string | null;
    }>(
      `
        select
          status::text as status,
          target_entity_type,
          target_entity_ref
        from submissions
        where id = $1 and account_id = $2
        limit 1
      `,
      [submissionId, accountId]
    );

    if (!current.rowCount || !current.rows[0]) {
      throw new Error("Submission not found.");
    }

    if (!["draft", "changes_requested"].includes(current.rows[0].status)) {
      throw new Error("Only draft submissions can be submitted.");
    }

    await client.query(
      `
        update submissions
        set status = 'submitted', submitted_at = now()
        where id = $1
      `,
      [submissionId]
    );

    await client.query(
      `
        update accounts
        set contribution_count = contribution_count + 1
        where id = $1
      `,
      [accountId]
    );

    await writeAuditEvent(
      {
        actorAccountId,
        eventType: "submission.submitted",
        entityType: "submission",
        entityRef: submissionId,
        afterPayload: {
          status: "submitted"
        }
      },
      client
    );
  }).then(async () =>
    detectConflicts({
      submissionId,
      targetEntityRef: (await getSubmissionById(submissionId)).targetEntityRef,
      targetEntityType: (await getSubmissionById(submissionId)).targetEntityType
    })
  );

export const listModerationQueue = async ({
  hasConflict,
  sourceTier,
  status,
  submissionType
}: {
  hasConflict?: boolean;
  sourceTier?: string;
  status?: string;
  submissionType?: string;
} = {}): Promise<ModerationQueueItem[]> => {
  const params: unknown[] = [];
  const where: string[] = [];

  if (submissionType) {
    params.push(submissionType);
    where.push(`submission_type::text = $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`status::text = $${params.length}`);
  }

  if (sourceTier) {
    params.push(sourceTier);
    where.push(`source_tier::text = $${params.length}`);
  }

  if (typeof hasConflict === "boolean") {
    params.push(hasConflict);
    where.push(`has_conflict = $${params.length}`);
  }

  const result = await query<{
    id: string;
    title: string;
    submission_type: ModerationQueueItem["submissionType"];
    status: SubmissionStatus;
    account_display_name: string | null;
    account_slug: string | null;
    contributor_role: Role;
    contributor_trust_score: number;
    source_tier: ModerationQueueItem["sourceTier"];
    has_conflict: boolean;
    target_entity_type: ModerationQueueItem["targetEntityType"];
    target_entity_ref: string | null;
    created_at: string;
    submitted_at: string | null;
  }>(
    `
      select
        id,
        title,
        submission_type::text as submission_type,
        status::text as status,
        account_display_name,
        account_slug,
        contributor_role,
        contributor_trust_score,
        source_tier::text as source_tier,
        has_conflict,
        target_entity_type,
        target_entity_ref,
        created_at,
        submitted_at
      from moderation_queue
      ${where.length > 0 ? `where ${where.join(" and ")}` : ""}
      order by submitted_at desc nulls last, created_at desc
    `,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    submissionType: row.submission_type,
    status: row.status,
    accountDisplayName: row.account_display_name,
    accountSlug: row.account_slug,
    contributorRole: row.contributor_role,
    contributorTrustScore: Number(row.contributor_trust_score ?? 0),
    sourceTier: row.source_tier,
    hasConflict: row.has_conflict,
    targetEntityType: row.target_entity_type,
    targetEntityRef: row.target_entity_ref,
    createdAt: row.created_at,
    submittedAt: row.submitted_at
  }));
};

export const listSubmissionReviews = async (submissionId: string): Promise<ModerationReviewRecord[]> => {
  const result = await query<{
    id: string;
    submission_id: string;
    reviewer_id: string;
    reviewer_name: string | null;
    decision: ModerationReviewRecord["decision"];
    notes: string | null;
    structured_diff: Record<string, unknown>;
    review_round: number;
    created_at: string;
  }>(
    `
      select
        review.id,
        review.submission_id,
        review.reviewer_id,
        reviewer.display_name as reviewer_name,
        review.decision::text as decision,
        review.notes,
        review.structured_diff,
        review.review_round,
        review.created_at
      from moderation_reviews review
      join accounts reviewer on reviewer.id = review.reviewer_id
      where review.submission_id = $1
      order by review.created_at asc
    `,
    [submissionId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    submissionId: row.submission_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    decision: row.decision,
    notes: row.notes,
    diff: row.structured_diff ?? {},
    reviewRound: Number(row.review_round ?? 1),
    createdAt: row.created_at
  }));
};

export const reviewSubmission = async ({
  actorAccountId,
  reviewerId,
  input,
  submissionId
}: {
  reviewerId: string;
  actorAccountId: string;
  submissionId: string;
  input: ReviewSubmissionInput;
}) =>
  withTransaction(async (client) => {
    const submission = await getSubmissionById(submissionId);
    const reviewRound = (await listSubmissionReviews(submissionId)).length + 1;

    const review = await client.query<{ id: string }>(
      `
        insert into moderation_reviews (
          submission_id,
          reviewer_id,
          decision,
          notes,
          structured_diff,
          review_round
        )
        values ($1, $2, $3::moderation_decision_enum, $4, $5::jsonb, $6)
        returning id
      `,
      [
        submissionId,
        reviewerId,
        input.decision,
        input.notes ?? null,
        JSON.stringify(input.diff),
        reviewRound
      ]
    );

    const nextStatus =
      input.decision === "approve"
        ? "approved"
        : input.decision === "reject"
          ? "rejected"
          : "changes_requested";

    await client.query(
      `
        update submissions
        set
          status = $2::submission_status_enum,
          reviewer_notes = $3
        where id = $1
      `,
      [submissionId, nextStatus, input.notes ?? null]
    );

    if (input.decision === "approve") {
      const entries = createOverlayEntries(submission);
      for (const entry of entries) {
        const inserted = await client.query<{ id: string }>(
          `
            insert into curated_overlays (
              entity_type,
              entity_ref,
              field_path,
              value,
              submission_id,
              review_id,
              status
            )
            values ($1, $2, $3, $4::jsonb, $5, $6, 'approved')
            returning id
          `,
          [
            entry.entityType,
            entry.entityRef,
            entry.fieldPath,
            JSON.stringify(entry.value),
            submissionId,
            review.rows[0]!.id
          ]
        );

        await client.query(
          `
            update curated_overlays
            set
              status = 'superseded',
              superseded_by = $4
            where entity_type = $1
              and entity_ref = $2
              and field_path = $3
              and id <> $4
              and superseded_by is null
          `,
          [entry.entityType, entry.entityRef, entry.fieldPath, inserted.rows[0]!.id]
        );
      }

      await client.query(
        `
          update accounts
          set approved_contribution_count = approved_contribution_count + 1
          where id = $1
        `,
        [submission.accountId]
      );
    }

    if (input.decision === "reject") {
      await client.query(
        `
          update accounts
          set rejected_contribution_count = rejected_contribution_count + 1
          where id = $1
        `,
        [submission.accountId]
      );
    }

    await writeAuditEvent(
      {
        actorAccountId,
        eventType: `submission.reviewed.${input.decision}`,
        entityType: "submission",
        entityRef: submissionId,
        beforePayload: {
          status: submission.status
        },
        afterPayload: {
          status: nextStatus,
          reviewId: review.rows[0]!.id,
          notes: input.notes ?? null
        }
      },
      client
    );

    return {
      reviewId: review.rows[0]!.id,
      status: nextStatus
    };
  });

export const getModerationSubmissionDetail = async (submissionId: string) => {
  const [submission, reviews, conflicts] = await Promise.all([
    getSubmissionById(submissionId),
    listSubmissionReviews(submissionId),
    loadConflictsForSubmission(submissionId)
  ]);

  return {
    submission,
    reviews,
    conflicts
  };
};

export const listAuditEvents = async (): Promise<AuditLogRecord[]> => {
  const result = await query<{
    id: string;
    actor_account_id: string | null;
    event_type: string;
    entity_type: string;
    entity_ref: string;
    before_payload: Record<string, unknown>;
    after_payload: Record<string, unknown>;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `
      select
        id,
        actor_account_id,
        event_type,
        entity_type,
        entity_ref,
        before_payload,
        after_payload,
        metadata,
        created_at
      from audit_log
      order by created_at desc
      limit 200
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    actorAccountId: row.actor_account_id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityRef: row.entity_ref,
    beforePayload: row.before_payload ?? {},
    afterPayload: row.after_payload ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  }));
};
