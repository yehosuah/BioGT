import { z } from "zod";

import {
  moderationDecisionValues,
  roleValues,
  submissionStatusValues,
  submissionTypeValues,
  targetEntityTypeValues
} from "@/lib/types";

export const targetEntityTypeSchema = z.enum(targetEntityTypeValues);
export const submissionTypeSchema = z.enum(submissionTypeValues);
export const submissionStatusSchema = z.enum(submissionStatusValues);
export const moderationDecisionSchema = z.enum(moderationDecisionValues);
export const roleSchema = z.enum(roleValues);

export const observationCreatePayloadSchema = z.object({
  observedAt: z.string().min(1),
  scientificName: z.string().min(1),
  commonName: z.string().min(1),
  locality: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevationBand: z.enum(["baja", "media", "alta"]),
  notes: z.string().trim().max(5000).optional()
});

export const dataCorrectionPayloadSchema = z.object({
  targetEntityType: targetEntityTypeSchema,
  targetEntityRef: z.string().min(1),
  fieldPath: z.string().min(1),
  currentValue: z.unknown().optional(),
  proposedValue: z.unknown(),
  rationale: z.string().min(1).max(5000)
});

export const speciesEditorialPayloadSchema = z.object({
  targetEntityRef: z.string().min(1),
  summary: z.string().min(1).max(5000),
  status: z.string().min(1).max(200),
  endemism: z.string().min(1).max(200),
  notes: z.string().trim().max(5000).optional()
});

export const areaEditorialPayloadSchema = z.object({
  targetEntityRef: z.string().min(1),
  summary: z.string().min(1).max(5000),
  storyLabel: z.string().min(1).max(200),
  notes: z.string().trim().max(5000).optional()
});

export const submissionPayloadSchema = z.discriminatedUnion("submissionType", [
  z.object({
    submissionType: z.literal("observation_create"),
    payload: observationCreatePayloadSchema,
    targetEntityType: z.literal("observation").optional(),
    targetEntityRef: z.string().optional()
  }),
  z.object({
    submissionType: z.literal("data_correction"),
    payload: dataCorrectionPayloadSchema,
    targetEntityType: targetEntityTypeSchema,
    targetEntityRef: z.string().min(1)
  }),
  z.object({
    submissionType: z.literal("species_editorial"),
    payload: speciesEditorialPayloadSchema,
    targetEntityType: z.literal("species"),
    targetEntityRef: z.string().min(1)
  }),
  z.object({
    submissionType: z.literal("area_editorial"),
    payload: areaEditorialPayloadSchema,
    targetEntityType: z.literal("area"),
    targetEntityRef: z.string().min(1)
  })
]);

export const createSubmissionSchema = submissionPayloadSchema.and(
  z.object({
    title: z.string().min(3).max(200),
    schemaVersion: z.number().int().positive().default(1)
  })
);

export const updateSubmissionSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const finalizeUploadSchema = z.object({
  objectKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  byteSize: z.number().int().positive().max(50_000_000),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const presignUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  byteSize: z.number().int().positive().max(50_000_000),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i)
});

export const reviewSubmissionSchema = z.object({
  decision: moderationDecisionSchema,
  notes: z.string().trim().max(5000).optional(),
  diff: z.record(z.string(), z.unknown()).default({})
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(120),
  bio: z.string().trim().max(1000).nullable(),
  affiliation: z.string().trim().max(200).nullable(),
  avatarUrl: z.string().url().nullable()
});

export const updateRoleSchema = z.object({
  role: roleSchema
});

export const updateTrustSchema = z.object({
  trustScore: z.number().int().min(-100).max(100),
  trustFlags: z.array(z.string().min(1).max(100)).max(20).default([])
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type FinalizeUploadInput = z.infer<typeof finalizeUploadSchema>;
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
