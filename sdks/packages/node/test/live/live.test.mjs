/**
 * Live smoke tests against the real API (TASKS.md 4.3).
 *
 * Skipped unless credentials are present, so `npm test` stays offline and
 * credential-free. To run:
 *
 *   TURBOSMTP_CONSUMER_KEY=... TURBOSMTP_CONSUMER_SECRET=... \
 *   TURBOSMTP_TEST_FROM=noreply@example.com TURBOSMTP_TEST_TO=you@example.com \
 *   npm run test:live
 *
 * These send real email. Point TURBOSMTP_TEST_TO at a mailbox you own.
 *
 * They exist to catch what the mocked suite structurally cannot: whether the API
 * *accepts* what the facade serializes. That is not hypothetical — the recipient
 * comma rule in §4.1 was written only after a live run rejected an RFC-correct
 * quoted display name.
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, describe, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const {
  TurboSMTPClient,
  AuthenticationError,
  BadRequestError,
  TurboSMTPError,
} = require('../../dist/cjs/index.js');

const KEY = process.env.TURBOSMTP_CONSUMER_KEY;
const SECRET = process.env.TURBOSMTP_CONSUMER_SECRET;
const FROM = process.env.TURBOSMTP_TEST_FROM;
const TO = process.env.TURBOSMTP_TEST_TO;

const missing = Object.entries({
  TURBOSMTP_CONSUMER_KEY: KEY,
  TURBOSMTP_CONSUMER_SECRET: SECRET,
  TURBOSMTP_TEST_FROM: FROM,
  TURBOSMTP_TEST_TO: TO,
})
  .filter(([, value]) => !value)
  .map(([name]) => name);

// `describe.skip` exits 0, so in CI an unset or misnamed secret would turn the live
// job into a green tick that sent nothing — and that job is dispatched by hand to
// verify a release candidate against the real API, which is the one claim the mocked
// suite cannot make. Locally, skipping stays the right behaviour.
if (process.env.CI && missing.length > 0) {
  throw new Error(`Live tests cannot run: ${missing.join(', ')} not set in the environment.`);
}

const suite = missing.length === 0 ? describe : describe.skip;

suite('live smoke tests', () => {
  const client = new TurboSMTPClient({ consumerKey: KEY, consumerSecret: SECRET });
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const subject = (name) => `[live] ${name} — ${stamp}`;

  // The API is rate limited, and the spec models neither 429 nor rate-limit headers
  // (contract §7, discrepancy 7), so the suite paces itself instead of firing every
  // send back to back. node:test already runs these sequentially; the gap makes the
  // throttling deliberate rather than incidental.
  const PACE_MS = Number(process.env.TURBOSMTP_LIVE_PACE_MS ?? 1000);
  beforeEach(() => sleep(PACE_MS));

  /** A message id is only useful if it survived as exact digits. */
  const assertExactId = (messageId) => {
    assert.match(messageId, /^\d+$/, 'messageId is a digit string');
    assert.equal(messageId, String(BigInt(messageId)), 'a 64-bit mid must not be rounded');
  };

  test('a minimal send is accepted and returns an exact message id', async () => {
    const res = await client.mail.send({
      from: FROM,
      to: [TO],
      subject: subject('minimal'),
      text: 'Plain text body.',
    });

    assertExactId(res.messageId);
  });

  test('every optional field the facade maps is accepted together', async () => {
    const res = await client.mail.send({
      from: { address: FROM, name: 'Live Suite' },
      to: [TO],
      cc: [TO],
      bcc: [TO],
      replyTo: { address: FROM, name: 'Desk, Reply' },
      subject: subject('all mapped fields'),
      text: 'Plain part.',
      html: '<p>HTML part.</p>',
      headers: { 'X-Live-Suite': 'yes', 'List-Unsubscribe': `<mailto:${FROM}>` },
      referenceId: `live-${Date.now()}`,
      campaignId: 'live-suite',
      attachments: [
        { content: new TextEncoder().encode('attached'), filename: 'note.txt', contentType: 'text/plain' },
      ],
    });

    assertExactId(res.messageId);
  });

  test('an inline image send is accepted with the qualified cid reference', async () => {
    // A 1x1 PNG is enough: this asserts acceptance, not rendering. Whether the part
    // renders inline can only be judged in a mail client.
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      ),
      (c) => c.charCodeAt(0),
    );

    const res = await client.mail.send({
      from: FROM,
      to: [TO],
      subject: subject('inline image'),
      html: '<p>Inline:</p><img src="cid:dot" alt="dot">',
      attachments: [{ content: png, filename: 'dot.png', contentType: 'image/png', contentId: 'dot' }],
    });

    assertExactId(res.messageId);
  });

  test('a raw MIME send is accepted', async () => {
    const mime = [
      `From: ${FROM}`,
      `To: ${TO}`,
      `Subject: ${subject('mimeRaw')}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Body assembled by the caller.',
    ].join('\r\n');

    const res = await client.mail.send({ from: FROM, to: [TO], subject: subject('mimeRaw'), mimeRaw: mime });

    assertExactId(res.messageId);
  });

  test('the ESM build sends too, not only the CJS one the suite otherwise drives', async () => {
    const { TurboSMTPClient: EsmClient } = await import('../../dist/esm/index.mjs');
    const res = await new EsmClient({ consumerKey: KEY, consumerSecret: SECRET }).mail.send({
      from: FROM,
      to: [TO],
      subject: subject('esm build'),
      text: 'Sent through dist/esm.',
    });

    assertExactId(res.messageId);
  });

  // The mocked suite asserts which URL the region selects; only a live run can say
  // whether the EU host accepts the same credentials, which is what a developer
  // switching regions actually needs to know.
  test('the eu region reaches the eu host and accepts the same credentials', async () => {
    let seen;
    const spy = async (url, init) => {
      seen = url.toString();
      return fetch(url, init);
    };
    const eu = new TurboSMTPClient({
      consumerKey: KEY,
      consumerSecret: SECRET,
      region: 'eu',
      fetchApi: spy,
    });

    const res = await eu.mail.send({
      from: FROM,
      to: [TO],
      subject: subject('eu region'),
      text: 'Sent through the EU host.',
    });

    assert.match(seen, /^https:\/\/api\.eu\.turbo-smtp\.com\//, 'eu must not fall back to another host');
    assertExactId(res.messageId);
  });

  test('bad credentials produce a typed AuthenticationError', async () => {
    const bad = new TurboSMTPClient({ consumerKey: KEY, consumerSecret: 'not-the-secret' });

    await assert.rejects(
      bad.mail.send({ from: FROM, to: [TO], subject: subject('401'), text: 'x' }),
      (err) => err instanceof AuthenticationError && err.status === 401,
    );
  });

  test('an invalid sender produces a typed BadRequestError carrying errors[]', async () => {
    await assert.rejects(
      client.mail.send({ from: 'not-an-address', to: [TO], subject: subject('400'), text: 'x' }),
      (err) => err instanceof BadRequestError && err.status === 400 && Array.isArray(err.errors),
    );
  });

  test('a comma in a recipient display name fails before any request is made', async () => {
    await assert.rejects(
      client.mail.send({
        from: FROM,
        to: [{ address: TO, name: 'Doe, Jane' }],
        subject: subject('comma'),
        text: 'x',
      }),
      (err) => err instanceof TurboSMTPError && err.status === null,
    );
  });
});
