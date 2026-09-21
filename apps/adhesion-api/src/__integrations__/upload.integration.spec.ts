import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { validCadesAgreement } from './support/cades-fixture.js';
import {
  buildIntegrationApp,
  documentCount,
  listAgreementBlobs,
  multipartUpload,
  practiceStatus,
  readAgreementBlob,
  resetState,
  seedPractice,
} from './support/harness.js';

/**
 * `UC-01` upload against the full HTTP runtime with the real PostgreSQL and
 * Azurite adapters.
 */
describe('upload signed agreement (integration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildIntegrationApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetState();
  });

  it('AC-01: persists the blob, the document and moves the practice to PENDING', async () => {
    const agreement = validCadesAgreement();
    await seedPractice('practice-1');

    const response = await app.inject(
      multipartUpload({
        url: '/practices/practice-1/agreements',
        filename: 'agreement.p7m',
        content: agreement,
      }),
    );

    expect(response.statusCode).toBe(201);
    const body = response.json<{ documentId: string; status: string }>();
    expect(body.status).toBe('PENDING');
    expect(await practiceStatus('practice-1')).toBe('PENDING');
    expect(await documentCount('practice-1')).toBe(1);

    const blobs = await listAgreementBlobs();
    expect(blobs).toEqual([`practice-1/${body.documentId}.p7m`]);
    // The stored blob is byte-identical to the uploaded CAdES file.
    expect(await readAgreementBlob(blobs[0])).toEqual(agreement);
  });

  it('AC-02: rejects a disallowed extension without side effects', async () => {
    await seedPractice('practice-2');

    const response = await app.inject(
      multipartUpload({
        url: '/practices/practice-2/agreements',
        filename: 'agreement.pdf',
        content: validCadesAgreement(),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      errorCode: 'AGREEMENT_EXTENSION_INVALID',
    });
    expect(await practiceStatus('practice-2')).toBe('REQUEST');
    expect(await documentCount('practice-2')).toBe(0);
    expect(await listAgreementBlobs()).toEqual([]);
  });

  it('AC-02: rejects an invalid signature without side effects', async () => {
    await seedPractice('practice-3');

    const response = await app.inject(
      multipartUpload({
        url: '/practices/practice-3/agreements',
        filename: 'agreement.p7m',
        content: Buffer.from('not a cades document'),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      errorCode: 'AGREEMENT_SIGNATURE_INVALID',
    });
    expect(await documentCount('practice-3')).toBe(0);
    expect(await listAgreementBlobs()).toEqual([]);
  });

  it('AC-03: rejects a duplicate step-1 upload and keeps a single document', async () => {
    await seedPractice('practice-4');
    const first = await app.inject(
      multipartUpload({
        url: '/practices/practice-4/agreements',
        filename: 'agreement.p7m',
        content: validCadesAgreement(),
      }),
    );
    expect(first.statusCode).toBe(201);

    const second = await app.inject(
      multipartUpload({
        url: '/practices/practice-4/agreements',
        filename: 'agreement.p7m',
        content: validCadesAgreement(),
      }),
    );

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({
      errorCode: 'PRACTICE_STATE_INVALID',
    });
    expect(await documentCount('practice-4')).toBe(1);
    expect(await listAgreementBlobs()).toHaveLength(1);
  });

  it('rejects an oversized file with AGREEMENT_FILE_TOO_LARGE', async () => {
    const lowLimitApp = await buildIntegrationApp({ MAX_UPLOAD_MB: '1' });
    await lowLimitApp.ready();
    await seedPractice('practice-5');

    const response = await lowLimitApp.inject(
      multipartUpload({
        url: '/practices/practice-5/agreements',
        filename: 'agreement.p7m',
        content: Buffer.alloc(1_500_000, 1),
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      errorCode: 'AGREEMENT_FILE_TOO_LARGE',
    });
    await lowLimitApp.close();
  });
});
