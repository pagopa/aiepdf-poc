import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { validCadesAgreement } from './support/cades-fixture.js';
import {
  buildIntegrationApp,
  multipartUpload,
  resetState,
  seedPractice,
  UI_ORIGIN,
} from './support/harness.js';

/**
 * Regression guard for the class of failure where the browser UI (a different
 * origin) calls the API and the request is blocked by CORS.
 */
describe('CORS between the UI origin and the API (integration)', () => {
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

  it('answers the preflight for the allowed UI origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/practices/practice-1/agreements',
      headers: {
        origin: UI_ORIGIN,
        'access-control-request-method': 'POST',
      },
    });

    expect(response.statusCode).toBeLessThan(300);
    expect(response.headers['access-control-allow-origin']).toBe(UI_ORIGIN);
    expect(String(response.headers['access-control-allow-methods'])).toContain(
      'POST',
    );
  });

  it('adds the CORS header to a real upload response', async () => {
    await seedPractice('practice-cors');

    const response = await app.inject(
      multipartUpload({
        url: '/practices/practice-cors/agreements',
        filename: 'agreement.p7m',
        content: validCadesAgreement(),
        origin: UI_ORIGIN,
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(response.headers['access-control-allow-origin']).toBe(UI_ORIGIN);
  });

  it('does not allow an unknown origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/config',
      headers: { origin: 'http://not-allowed.example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
