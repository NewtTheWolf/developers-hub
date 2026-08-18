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
import { describe, test } from 'node:test';

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

const configured = Boolean(KEY && SECRET && FROM && TO);
const suite = configured ? describe : describe.skip;

suite('live smoke tests', () => {
  const client = new TurboSMTPClient({ consumerKey: KEY, consumerSecret: SECRET });
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const subject = (name) => `[live] ${name} — ${stamp}`;

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
