#!/usr/bin/env node
/**
 * Environment smoke test for the CED Adhesion pilot.
 *
 * Runs against a live deployment (local compose stack or Azure) and fails with
 * a non-zero exit code on the first contract break. No dependencies: uses the
 * Node global `fetch`.
 *
 * Usage:
 *   node scripts/smoke-test.mjs \
 *     --base-url http://localhost:3000 \
 *     [--origin http://localhost:8080] \
 *     [--web-url http://localhost:8080]
 *
 * Environment fallbacks: SMOKE_BASE_URL, SMOKE_ORIGIN, SMOKE_WEB_URL.
 *
 * The `--origin` check is the regression guard for the browser CORS contract;
 * `--web-url` verifies the built UI actually embeds the configured API URL
 * (Next.js only inlines `process.env.NEXT_PUBLIC_*` with dot notation).
 */

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function trimTrailingSlash(value) {
  return value ? value.replace(/\/$/, '') : value;
}

const args = parseArgs(process.argv.slice(2));
const baseUrl = trimTrailingSlash(args['base-url'] ?? process.env.SMOKE_BASE_URL);
const origin = args.origin ?? process.env.SMOKE_ORIGIN;
const webUrl = trimTrailingSlash(args['web-url'] ?? process.env.SMOKE_WEB_URL);

if (!baseUrl) {
  console.error('Missing --base-url (or SMOKE_BASE_URL).');
  process.exit(2);
}

let failures = 0;

async function check(name, run) {
  try {
    await run();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const random = Math.random().toString(36).slice(2, 10);

console.log(`Smoke test against ${baseUrl}`);

await check('liveness /health returns 200 ok', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert(response.status === 200, `status ${response.status}`);
  const body = await response.json();
  assert(body.status === 'ok', `unexpected body ${JSON.stringify(body)}`);
});

await check('readiness /ready returns 200 with all checks ok', async () => {
  const response = await fetch(`${baseUrl}/ready`);
  const body = await response.json();
  assert(response.status === 200, `status ${response.status}: ${JSON.stringify(body)}`);
  assert(body.ok === true, `not ready: ${JSON.stringify(body)}`);
});

await check('GET /config returns the pilot configuration', async () => {
  const response = await fetch(`${baseUrl}/config`);
  assert(response.status === 200, `status ${response.status}`);
  const body = await response.json();
  assert(typeof body.uploadEnabled === 'boolean', 'uploadEnabled missing');
  assert(typeof body.maxUploadMb === 'number', 'maxUploadMb missing');
});

await check('unknown practice returns the typed 404 problem', async () => {
  const response = await fetch(`${baseUrl}/practices/smoke-${random}`);
  assert(response.status === 404, `status ${response.status}`);
  assert(
    response.headers.get('content-type')?.includes('application/problem+json'),
    `content-type ${response.headers.get('content-type')}`,
  );
  const body = await response.json();
  assert(
    body.errorCode === 'PRACTICE_NOT_FOUND',
    `errorCode ${body.errorCode}`,
  );
});

if (origin) {
  await check(`CORS preflight allows ${origin}`, async () => {
    const response = await fetch(`${baseUrl}/practices/smoke-${random}/agreements`, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
      },
    });
    assert(response.status < 300, `status ${response.status}`);
    assert(
      response.headers.get('access-control-allow-origin') === origin,
      `access-control-allow-origin ${response.headers.get('access-control-allow-origin')}`,
    );
  });

  await check(`CORS header present on a real response for ${origin}`, async () => {
    const response = await fetch(`${baseUrl}/config`, { headers: { origin } });
    assert(
      response.headers.get('access-control-allow-origin') === origin,
      `access-control-allow-origin ${response.headers.get('access-control-allow-origin')}`,
    );
  });
}

if (webUrl) {
  await check('web UI is reachable', async () => {
    const response = await fetch(webUrl);
    assert(response.status === 200, `status ${response.status}`);
  });

  await check('web UI bundle embeds the API base URL', async () => {
    const html = await (await fetch(webUrl)).text();
    const scriptSources = [...html.matchAll(/src="([^"]+\.js)"/g)].map(
      (match) => match[1],
    );
    assert(scriptSources.length > 0, 'no script tags found in the page');

    let found = false;
    for (const source of scriptSources) {
      const url = source.startsWith('http') ? source : `${webUrl}${source}`;
      const script = await (await fetch(url)).text();
      if (script.includes(baseUrl)) {
        found = true;
        break;
      }
    }
    assert(found, `API base URL ${baseUrl} not found in the UI bundle`);
  });
}

if (failures > 0) {
  console.error(`Smoke test failed: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('Smoke test passed.');
