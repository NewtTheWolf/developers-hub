/**
 * Packaging conformance — the published artifacts, not the source tree.
 *
 * The package ships two builds from one source: `dist/cjs` (tsc) and
 * `dist/esm/index.mjs` (esbuild bundle). The scenario suite in mail-send.test.mjs
 * drives only the CJS build, and the `examples/js` scripts that drive the ESM build
 * need live credentials so they never run in CI. Without this file the ESM artifact
 * would ship having been executed by nothing automated.
 *
 * Asserting the two against each other is not enough on its own — a symbol dropped
 * from BOTH builds would still compare equal. So each build is checked against an
 * explicit expected surface first, and only then against the other.
 *
 * This is the Node instance of a language-agnostic requirement: "the packaged
 * artifact loads and exposes the contracted surface" (TASKS.md 4.1).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * The contracted runtime surface of `src/index.ts` — client, namespace, and the
 * §3.4 error taxonomy. Types are compile-time only and cannot appear here.
 * Adding a public export is a deliberate act: update this list in the same commit.
 */
const CONTRACTED_EXPORTS = [
  'ApiError',
  'AuthenticationError',
  'BadRequestError',
  'ForbiddenError',
  'MailNamespace',
  'NetworkError',
  'NotFoundError',
  'RateLimitError',
  'TurboSMTPClient',
  'TurboSMTPError',
  'ValidationError',
].sort();

const surfaceOf = (mod) => Object.keys(mod).sort();

test('CJS build exposes exactly the contracted surface', () => {
  const cjs = require('../dist/cjs/index.js');
  assert.deepEqual(surfaceOf(cjs), CONTRACTED_EXPORTS);
});

test('ESM build exposes exactly the contracted surface', async () => {
  const esm = await import('../dist/esm/index.mjs');
  // Node adds `default` to the namespace only when the module declares one; the
  // facade deliberately has no default export, so the surfaces compare directly.
  assert.deepEqual(surfaceOf(esm), CONTRACTED_EXPORTS);
});

test('CJS and ESM builds do not diverge', async () => {
  const cjs = require('../dist/cjs/index.js');
  const esm = await import('../dist/esm/index.mjs');
  assert.deepEqual(surfaceOf(esm), surfaceOf(cjs));
});

test('both builds export a usable client constructor', async () => {
  const cjs = require('../dist/cjs/index.js');
  const esm = await import('../dist/esm/index.mjs');

  for (const [label, mod] of [['cjs', cjs], ['esm', esm]]) {
    assert.equal(typeof mod.TurboSMTPClient, 'function', `${label}: TurboSMTPClient not callable`);
    const client = new mod.TurboSMTPClient({ consumerKey: 'ck', consumerSecret: 'cs' });
    assert.ok(client.mail, `${label}: client.mail namespace missing`);
    assert.equal(typeof client.mail.send, 'function', `${label}: client.mail.send not callable`);
  }
});

test('error taxonomy inherits from TurboSMTPError in both builds', async () => {
  const cjs = require('../dist/cjs/index.js');
  const esm = await import('../dist/esm/index.mjs');
  const subclasses = CONTRACTED_EXPORTS.filter(
    (n) => n.endsWith('Error') && n !== 'TurboSMTPError',
  );

  for (const [label, mod] of [['cjs', cjs], ['esm', esm]]) {
    for (const name of subclasses) {
      assert.ok(
        Object.create(mod[name].prototype) instanceof mod.TurboSMTPError,
        `${label}: ${name} does not extend TurboSMTPError`,
      );
    }
  }
});
