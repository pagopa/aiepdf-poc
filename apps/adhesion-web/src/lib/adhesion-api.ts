import {
  type ErrorCode,
  type PilotConfig,
  pilotConfigSchema,
  type Practice,
  type Problem,
  practiceSchema,
  problemSchema,
  type UploadSignedAgreementResponse,
  uploadSignedAgreementResponseSchema,
} from './adhesion-contract';

/**
 * Typed client for the Adhesion API (`contracts.item-001`).
 *
 * The browser talks to the public API directly because the UI is served from
 * Azure Static Web Apps: there is no server-side proxy in the pilot.
 */

export class ApiError extends Error {
  readonly httpStatus: number;
  readonly errorCode: ErrorCode | undefined;

  constructor(
    message: string,
    httpStatus: number,
    errorCode: ErrorCode | undefined,
  ) {
    super(message);
    this.name = 'ApiError';
    this.httpStatus = httpStatus;
    this.errorCode = errorCode;
  }
}

function apiBaseUrl(): string {
  // Must use dot notation: Next.js inlines `process.env.NEXT_PUBLIC_*` at build
  // time only for static access. Bracket access is left as-is and is undefined
  // in the browser.
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      'NEXT_PUBLIC_API_BASE_URL is not configured. Set it at build time.',
    );
  }
  return baseUrl.replace(/\/$/, '');
}

async function readProblem(response: Response): Promise<Problem> {
  try {
    const parsed = problemSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export async function uploadSignedAgreement(input: {
  onboardingId: string;
  file: File;
  signal?: AbortSignal;
}): Promise<UploadSignedAgreementResponse> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('signingStep', '1');

  const response = await fetch(
    `${apiBaseUrl()}/practices/${encodeURIComponent(input.onboardingId)}/agreements`,
    { method: 'POST', body: form, signal: input.signal },
  );

  if (!response.ok) {
    const problem = await readProblem(response);
    throw new ApiError(
      problem.detail ?? problem.title ?? 'Upload failed',
      response.status,
      problem.errorCode as ErrorCode | undefined,
    );
  }

  const parsed = uploadSignedAgreementResponseSchema.safeParse(
    await response.json(),
  );
  if (!parsed.success) {
    throw new ApiError(
      'The API returned an unexpected upload response.',
      response.status,
      undefined,
    );
  }
  return parsed.data;
}

export async function getPractice(input: {
  onboardingId: string;
  signal?: AbortSignal;
}): Promise<Practice> {
  const response = await fetch(
    `${apiBaseUrl()}/practices/${encodeURIComponent(input.onboardingId)}`,
    { method: 'GET', signal: input.signal },
  );

  if (!response.ok) {
    const problem = await readProblem(response);
    throw new ApiError(
      problem.detail ?? problem.title ?? 'Practice lookup failed',
      response.status,
      problem.errorCode as ErrorCode | undefined,
    );
  }

  const parsed = practiceSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError(
      'The API returned an unexpected practice response.',
      response.status,
      undefined,
    );
  }
  return parsed.data;
}

export async function getPilotConfig(signal?: AbortSignal): Promise<PilotConfig> {
  const response = await fetch(`${apiBaseUrl()}/config`, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    throw new ApiError(
      'The API configuration could not be read.',
      response.status,
      undefined,
    );
  }

  const parsed = pilotConfigSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError(
      'The API returned an unexpected configuration.',
      response.status,
      undefined,
    );
  }
  return parsed.data;
}
