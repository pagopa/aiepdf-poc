import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Makes Testcontainers find the Docker daemon on this machine.
 *
 * Testcontainers defaults to `/var/run/docker.sock` (Linux). On macOS with
 * Rancher Desktop or Docker Desktop the socket lives elsewhere and is only
 * exposed by the active Docker context. When `DOCKER_HOST` is unset and the
 * default socket is missing, derive it from `docker context inspect`.
 *
 * Must run before Testcontainers creates its client (i.e. before any
 * container `start()`), which is why the global setup calls it first.
 */
export function ensureDockerHost(): void {
  if (process.env.DOCKER_HOST) {
    return;
  }
  if (existsSync('/var/run/docker.sock')) {
    return;
  }

  try {
    const host = execFileSync(
      'docker',
      ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
      { encoding: 'utf8' },
    ).trim();
    if (host) {
      process.env.DOCKER_HOST = host;
      // On Docker Desktop / Rancher the socket exposed by the context is a host
      // path that the daemon cannot bind-mount (Ryuk). Inside the VM the same
      // socket is at the standard Linux path.
      process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE ??=
        '/var/run/docker.sock';
      console.info(`[integration] DOCKER_HOST resolved to ${host}`);
    }
  } catch {
    // Leave it unset: Testcontainers will report the concrete failure.
  }
}
