import type { SignatureVerifier } from '@aiepdf/adhesion-domain';
import { describe, expect, it } from 'vitest';

import { createInMemoryAgreementStorage } from '../../adapters/in-memory-agreement-storage.js';
import { createInMemoryPracticeRepository } from '../../adapters/in-memory-practice-repository.js';
import { buildApp } from '../../app/app.js';
import type { AppDependencies } from '../../app/dependencies.js';
import { createStaticFeatureFlags } from '../../config/feature-flags.js';
import { loadSettingsFromEnvironment } from '../../config/settings.js';
import type { ReadinessProbe } from '../../health/readiness.js';

const validVerifier: SignatureVerifier = {
  verify: () => Promise.resolve({ valid: true }),
};

const healthyReadiness: ReadinessProbe = () =>
  Promise.resolve({ ok: true, checks: {} });

function buildTestDependencies(
  overrides: Partial<AppDependencies> = {},
): AppDependencies {
  return {
    settings: loadSettingsFromEnvironment({}),
    featureFlags: createStaticFeatureFlags({ uploadEnabled: true }),
    practices: createInMemoryPracticeRepository({
      practices: [
        { onboardingId: 'practice-1', status: 'REQUEST' },
        { onboardingId: 'practice-pending', status: 'PENDING' },
      ],
    }),
    storage: createInMemoryAgreementStorage(),
    verifier: validVerifier,
    readiness: healthyReadiness,
    newDocumentId: () => 'document-1',
    now: () => new Date('2026-09-21T00:00:00.000Z'),
    ...overrides,
  };
}

function multipartPayload(input: {
  filename: string;
  content: string;
}): { body: string; boundary: string } {
  const boundary = '----adhesionTestBoundary';
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${input.filename}"`,
    'Content-Type: application/pkcs7-mime',
    '',
    input.content,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return { body, boundary };
}

function uploadRequest(input: {
  url: string;
  filename: string;
  content?: string;
}) {
  const { body, boundary } = multipartPayload({
    filename: input.filename,
    content: input.content ?? '',
  });
  return {
    method: 'POST' as const,
    url: input.url,
    payload: body,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
  };
}

describe('adhesion API routes', () => {
  it('AC-01: accepts a valid agreement and moves the practice to PENDING', async () => {
    const app = buildApp(buildTestDependencies());

    const response = await app.inject(
      uploadRequest({
        url: '/practices/practice-1/agreements',
        filename: 'agreement.p7m',
        content: 'signed-bytes',
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      documentId: 'document-1',
      status: 'PENDING',
      signingStep: 1,
    });
  });

  it('AC-02: returns a typed 400 for a disallowed extension', async () => {
    const app = buildApp(buildTestDependencies());

    const response = await app.inject(
      uploadRequest({
        url: '/practices/practice-1/agreements',
        filename: 'agreement.pdf',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.json()).toMatchObject({
      errorCode: 'AGREEMENT_EXTENSION_INVALID',
      status: 400,
    });
  });

  it('AC-02: returns a typed 400 for an invalid signature', async () => {
    const app = buildApp(
      buildTestDependencies({
        verifier: {
          verify: () => Promise.resolve({ valid: false, reason: 'malformed' }),
        },
      }),
    );

    const response = await app.inject(
      uploadRequest({
        url: '/practices/practice-1/agreements',
        filename: 'agreement.p7m',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      errorCode: 'AGREEMENT_SIGNATURE_INVALID',
    });
  });

  it('AC-03: rejects a duplicate step-1 upload with 409', async () => {
    const app = buildApp(buildTestDependencies());

    await app.inject(
      uploadRequest({
        url: '/practices/practice-1/agreements',
        filename: 'agreement.p7m',
      }),
    );
    const second = await app.inject(
      uploadRequest({
        url: '/practices/practice-1/agreements',
        filename: 'agreement.p7m',
      }),
    );

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({
      errorCode: 'PRACTICE_STATE_INVALID',
    });
  });

  it('reads the practice status', async () => {
    const app = buildApp(buildTestDependencies());

    const response = await app.inject({
      method: 'GET',
      url: '/practices/practice-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      onboardingId: 'practice-1',
      status: 'REQUEST',
    });
  });

  it('returns 404 for an unknown practice', async () => {
    const app = buildApp(buildTestDependencies());

    const response = await app.inject({
      method: 'GET',
      url: '/practices/missing',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ errorCode: 'PRACTICE_NOT_FOUND' });
  });

  it('returns 503 when uploads are disabled by the feature flag', async () => {
    const app = buildApp(
      buildTestDependencies({
        featureFlags: createStaticFeatureFlags({ uploadEnabled: false }),
      }),
    );

    const response = await app.inject(
      uploadRequest({
        url: '/practices/practice-1/agreements',
        filename: 'agreement.p7m',
      }),
    );

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ errorCode: 'UPLOAD_DISABLED' });
  });

  it('exposes the pilot configuration for the UI', async () => {
    const app = buildApp(buildTestDependencies());

    const response = await app.inject({ method: 'GET', url: '/config' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ uploadEnabled: true, maxUploadMb: 10 });
  });

  it('liveness probe is always ok', async () => {
    const app = buildApp(buildTestDependencies());

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('readiness probe reports dependency health', async () => {
    const app = buildApp(
      buildTestDependencies({
        readiness: () =>
          Promise.resolve({
            ok: true,
            checks: { 'practice-registry': 'ok', 'agreement-storage': 'ok' },
          }),
      }),
    );

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      checks: { 'practice-registry': 'ok', 'agreement-storage': 'ok' },
    });
  });

  it('readiness probe returns 503 when a dependency is down', async () => {
    const app = buildApp(
      buildTestDependencies({
        readiness: () =>
          Promise.resolve({
            ok: false,
            checks: { 'practice-registry': 'fail' },
          }),
      }),
    );

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ ok: false });
  });

  it('answers the CORS preflight for the allowed UI origin', async () => {
    const app = buildApp(
      buildTestDependencies({
        settings: loadSettingsFromEnvironment({
          CORS_ALLOWED_ORIGINS: 'http://localhost:8080',
        }),
      }),
    );

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/practices/practice-1/agreements',
      headers: {
        origin: 'http://localhost:8080',
        'access-control-request-method': 'POST',
      },
    });

    expect(response.statusCode).toBeLessThan(300);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8080',
    );
  });

  it('adds the CORS header to upload responses for the allowed origin', async () => {
    const app = buildApp(
      buildTestDependencies({
        settings: loadSettingsFromEnvironment({
          CORS_ALLOWED_ORIGINS: 'http://localhost:8080',
        }),
      }),
    );

    const response = await app.inject({
      ...uploadRequest({
        url: '/practices/practice-1/agreements',
        filename: 'agreement.p7m',
      }),
      headers: {
        ...uploadRequest({
          url: '/practices/practice-1/agreements',
          filename: 'agreement.p7m',
        }).headers,
        origin: 'http://localhost:8080',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8080',
    );
  });
});
