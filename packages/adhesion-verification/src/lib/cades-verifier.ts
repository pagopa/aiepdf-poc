/**
 * CAdES (`.p7m`) signature verifier, in-process.
 *
 * Implements the `SignatureVerifier` port from `@aiepdf/adhesion-domain` using
 * PKIjs. Per the DR assumption `solution.decision.item-001`, the pilot verifies
 * the signature format and cryptographic validity; signer identity and trust
 * chain are explicitly out of scope.
 *
 * The port is the seam: replacing this adapter with an external verification
 * service or a stricter library does not touch the upload use case.
 */

import { webcrypto } from 'node:crypto';

import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

import type {
  SignatureVerificationResult,
  SignatureVerifier,
} from '@aiepdf/adhesion-domain';

/** OID of PKCS#7/CMS `SignedData`. */
const signedDataOid = '1.2.840.113549.1.7.2';

function toArrayBuffer(content: Uint8Array): ArrayBuffer {
  return content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength,
  ) as ArrayBuffer;
}

export function createCadesVerifier(): SignatureVerifier {
  // PKIjs needs a WebCrypto implementation; Node exposes one since v20.
  pkijs.setEngine(
    'node',
    new pkijs.CryptoEngine({
      name: 'node-webcrypto',
      crypto: webcrypto as unknown as Crypto,
    }),
  );

  return {
    async verify({ content }): Promise<SignatureVerificationResult> {
      try {
        const parsed = asn1js.fromBER(toArrayBuffer(content));
        if (parsed.offset === -1) {
          return { valid: false, reason: 'not-der' };
        }

        const contentInfo = new pkijs.ContentInfo({ schema: parsed.result });
        if (contentInfo.contentType !== signedDataOid) {
          return { valid: false, reason: 'not-signed-data' };
        }

        const signedData = new pkijs.SignedData({
          schema: contentInfo.content,
        });
        if (!signedData.signerInfos || signedData.signerInfos.length === 0) {
          return { valid: false, reason: 'no-signers' };
        }

        const valid = await signedData.verify({ signer: 0 });
        return valid
          ? { valid: true }
          : { valid: false, reason: 'signature-invalid' };
      } catch {
        // A malformed CMS structure is a rejection, not an application error.
        return { valid: false, reason: 'malformed' };
      }
    },
  };
}
