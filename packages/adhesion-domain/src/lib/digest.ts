/**
 * Digest helper used to record the content hash of an uploaded agreement.
 *
 * SHA-256 is used because the DR references a "digest" without naming an
 * algorithm; SHA-256 is the default choice for integrity checks in the
 * ecosystem.
 */

import { createHash } from 'node:crypto';

export function sha256Hex(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}
