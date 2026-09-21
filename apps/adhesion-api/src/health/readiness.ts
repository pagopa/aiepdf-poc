/**
 * Readiness probing.
 *
 * Liveness (`/health`) only says the process is up; readiness (`/ready`) says
 * the API can serve traffic, which means its dependencies are reachable. The
 * Container App readiness probe points at `/ready`, so a revision with a broken
 * database or storage connection is never marked healthy.
 *
 * Checks run in parallel with a timeout: a hung dependency must fail fast, not
 * hang the probe.
 */

export interface NamedReadinessCheck {
  readonly name: string;
  readonly check: () => Promise<void>;
}

export type ReadinessStatus = 'ok' | 'fail';

export interface ReadinessResult {
  readonly ok: boolean;
  readonly checks: Record<string, ReadinessStatus>;
}

export type ReadinessProbe = () => Promise<ReadinessResult>;

const defaultTimeoutMs = 2_000;

async function withTimeout(
  promise: Promise<void>,
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function createReadinessProbe(
  checks: readonly NamedReadinessCheck[],
  timeoutMs: number = defaultTimeoutMs,
): ReadinessProbe {
  return async () => {
    const results: Record<string, ReadinessStatus> = {};
    await Promise.all(
      checks.map(async ({ name, check }) => {
        try {
          await withTimeout(check(), timeoutMs);
          results[name] = 'ok';
        } catch {
          results[name] = 'fail';
        }
      }),
    );
    return {
      ok: Object.values(results).every((status) => status === 'ok'),
      checks: results,
    };
  };
}
