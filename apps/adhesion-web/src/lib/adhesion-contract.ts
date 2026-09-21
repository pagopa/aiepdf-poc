import { z } from 'zod';

/**
 * Runtime view of the signed-agreement upload contract
 * (`contracts.item-001`). The web app validates every payload it receives, so
 * a contract change that is not mirrored here fails loudly instead of silently
 * rendering `undefined`.
 */

export const practiceStatusSchema = z.enum(['REQUEST', 'PENDING']);

export type PracticeStatus = z.infer<typeof practiceStatusSchema>;

export const errorCodeSchema = z.enum([
  'AGREEMENT_EXTENSION_INVALID',
  'AGREEMENT_SIGNATURE_INVALID',
  'AGREEMENT_FILE_TOO_LARGE',
  'PRACTICE_STATE_INVALID',
  'PRACTICE_NOT_FOUND',
  'UPLOAD_DISABLED',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const uploadSignedAgreementResponseSchema = z.object({
  documentId: z.string().min(1),
  status: practiceStatusSchema,
  signingStep: z.number().int().min(1).optional(),
});

export type UploadSignedAgreementResponse = z.infer<
  typeof uploadSignedAgreementResponseSchema
>;

export const practiceSchema = z.object({
  onboardingId: z.string().min(1),
  status: practiceStatusSchema,
  documentId: z.string().min(1).optional(),
});

export type Practice = z.infer<typeof practiceSchema>;

/** RFC 9457 problem detail carrying a stable semantic `errorCode`. */
export const problemSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().int().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errorCode: z.string().optional(),
});

export type Problem = z.infer<typeof problemSchema>;

/**
 * Pilot runtime configuration exposed by `GET /config`, so App Configuration
 * feature flags and settings can drive the UI without a redeploy.
 */
export const pilotConfigSchema = z.object({
  uploadEnabled: z.boolean(),
  maxUploadMb: z.number().int().positive(),
});

export type PilotConfig = z.infer<typeof pilotConfigSchema>;
