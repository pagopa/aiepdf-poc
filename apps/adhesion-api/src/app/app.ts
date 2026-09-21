/**
 * Fastify application factory.
 *
 * Wiring is explicit (no filesystem autoload) so the dependency graph is
 * visible, testable, and independent of the folder layout.
 */

import { AgreementError } from '@aiepdf/adhesion-domain';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';

import { internalErrorProblem, toProblemBody } from '../http/problem.js';
import { registerHealthRoutes } from '../http/routes/health.js';
import { registerPracticeRoutes } from '../http/routes/practices.js';
import type { AppDependencies } from './dependencies.js';

export interface BuildAppOptions {
  readonly logger?: boolean;
}

export function buildApp(
  dependencies: AppDependencies,
  options: BuildAppOptions = {},
): FastifyInstance {
  const maxUploadBytes = dependencies.settings.maxUploadMb * 1024 * 1024;
  const app = Fastify({
    logger: options.logger ?? false,
    // A little headroom over the file limit so multipart framing is not cut
    // off before the file-size limit produces the typed error.
    bodyLimit: maxUploadBytes + 1024 * 1024,
  });

  // The UI is served from a different origin (Static Web App in Azure, nginx
  // locally), so the API must answer CORS pre-flight and allow that origin.
  if (dependencies.settings.corsAllowedOrigins.length > 0) {
    app.register(cors, {
      origin: [...dependencies.settings.corsAllowedOrigins],
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['content-type'],
      maxAge: 600,
    });
  }

  app.register(multipart, {
    limits: { fileSize: maxUploadBytes, files: 1, fields: 5 },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AgreementError) {
      reply
        .code(error.httpStatus)
        .type('application/problem+json')
        .send(toProblemBody(error));
      return;
    }

    const status = error.statusCode ?? 500;
    if (status < 500) {
      reply
        .code(status)
        .type('application/problem+json')
        .send(internalErrorProblem());
      return;
    }

    request.log.error({ err: error }, 'unhandled error');
    reply
      .code(500)
      .type('application/problem+json')
      .send(internalErrorProblem());
  });

  registerHealthRoutes(app, dependencies.readiness);
  registerPracticeRoutes(app, dependencies);

  return app;
}
