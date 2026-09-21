import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Generates a real detached-content CAdES (`.p7m`) fixture with OpenSSL.
 *
 * The verifier checks the CMS signature, not a trust chain, so a self-signed
 * certificate is sufficient. Generating at runtime (instead of checking in a
 * binary) avoids a stale/expired fixture. Requires `openssl` on PATH.
 */

let cachedAgreement: Buffer | undefined;

export function validCadesAgreement(): Buffer {
  if (cachedAgreement) {
    return cachedAgreement;
  }

  const directory = mkdtempSync(join(tmpdir(), 'adhesion-cades-'));
  const keyPath = join(directory, 'key.pem');
  const certPath = join(directory, 'cert.pem');
  const contentPath = join(directory, 'content.txt');
  const outputPath = join(directory, 'agreement.p7m');

  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', keyPath, '-out', certPath,
      '-days', '1', '-nodes', '-subj', '/CN=Adhesion Integration Test',
    ], { stdio: 'ignore' });

    writeFileSync(contentPath, 'adhesion integration agreement content');

    execFileSync('openssl', [
      'smime', '-sign', '-in', contentPath,
      '-signer', certPath, '-inkey', keyPath,
      '-outform', 'DER', '-nodetach', '-out', outputPath,
    ], { stdio: 'ignore' });
  } catch (error) {
    throw new Error(
      'Integration fixture generation needs the `openssl` CLI on PATH.',
      { cause: error },
    );
  }

  cachedAgreement = readFileSync(outputPath);
  return cachedAgreement;
}
