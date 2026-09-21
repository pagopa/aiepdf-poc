/**
 * Dependencies injected into the Fastify application.
 *
 * Keeping them in one place lets tests build the API with in-memory adapters
 * and lets `main.ts` assemble the Azure ones, without the HTTP layer knowing
 * which implementation it is talking to.
 */

import type {
  AgreementBlobWriter,
  PracticeRepository,
  SignatureVerifier,
} from '@aiepdf/adhesion-domain';

import type { FeatureFlags } from '../config/feature-flags.js';
import type { Settings } from '../config/settings.js';
import type { ReadinessProbe } from '../health/readiness.js';

export interface AppDependencies {
  readonly settings: Settings;
  readonly featureFlags: FeatureFlags;
  readonly practices: PracticeRepository;
  readonly storage: AgreementBlobWriter;
  readonly verifier: SignatureVerifier;
  readonly readiness: ReadinessProbe;
  readonly newDocumentId: () => string;
  readonly now: () => Date;
}
