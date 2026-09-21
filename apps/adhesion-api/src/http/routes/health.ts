/**
 * Liveness and readiness endpoints.
 *
 * - `GET /health` is the Container App **liveness** probe: it only proves the
 *   process is alive and the HTTP stack responds.
 * - `GET /ready` is the Container App **readiness** probe: it verifies the
 *   backing dependencies (practice registry, agreement storage). It returns
 *   `503` when any dependency is unreachable, so the revision never receives
 *   traffic in a degraded state.
 */

import type { FastifyInstance } from 'fastify';

import type { ReadinessProbe } from '../../health/readiness.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  readiness: ReadinessProbe,
): void {
  app.get('/health', () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    const result = await readiness();
    reply.code(result.ok ? 200 : 503);
    return result;
  });
}
