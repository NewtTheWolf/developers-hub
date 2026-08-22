/**
 * P0 Mail — Layer 3 conformance tests (client-contract.md §3.3).
 *
 * The numbered scenarios below map 1:1 to the contract's conformance matrix; the
 * numbering is permanent and new rules append (§8.1). Scenarios 9 and 10 are address
 * rules and live in address.test.mjs. A few extra tests cover cross-cutting behavior
 * (config validation, network errors).
 *
 * Run: `npm test` (builds first, then `node --test`). Imports the built facade
 * from ../dist so the tests exercise the real published entry point.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ApiError,
  AuthenticationError,
  BadRequestError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  TurboSMTPClient,
  TurboSMTPError,
} from '../dist/cjs/index.js';

import { lastBody, lastHeaders, lastUrl, makeFetch, makeThrowingFetch } from './helpers.mjs';

const creds = { consumerKey: 'ck', consumerSecret: 'cs' };
const clientWith = (fetchApi, extra = {}) => new TurboSMTPClient({ ...creds, fetchApi, ...extra });

// §3.3.1 — Minimal send -------------------------------------------------------
test('§3.3.1 minimal send returns messageId and maps text→content', async () => {
  // Raw string body so the exact 64-bit digits reach the SDK (a real server sends this).
  const fetchApi = makeFetch(200, '{"message":"OK","mid":9007199254740993}');
  const client = clientWith(fetchApi);

  const res = await client.mail.send({ from: 'a@x.com', to: ['b@y.com'], subject: 'Hi', text: 'hello' });

  assert.equal(typeof res.messageId, 'string');
  assert.ok(res.messageId.length > 0, 'messageId is non-empty');
  assert.equal(res.messageId, '9007199254740993', 'preserves 64-bit id without float rounding');

  const body = lastBody(fetchApi);
  assert.equal(body.content, 'hello');
  assert.equal(body.from, 'a@x.com');
  assert.equal(body.to, 'b@y.com');

  // Auth is hidden: both consumer headers sent, Authorization never sent.
  const headers = lastHeaders(fetchApi);
  assert.equal(headers.consumerKey, 'ck');
  assert.equal(headers.consumerSecret, 'cs');
  assert.ok(!('Authorization' in headers), 'Authorization must never be sent to /mail/send');

  // Default region → global send host.
  assert.equal(lastUrl(fetchApi), 'https://api.turbo-smtp.com/api/v2/mail/send');
});

// §3.3.2 — HTML send ----------------------------------------------------------
test('§3.3.2 HTML send maps html→html_content and omits content', async () => {
  const fetchApi = makeFetch(200, { message: 'OK', mid: 42 });
  const client = clientWith(fetchApi);

  await client.mail.send({ from: 'a@x.com', to: ['b@y.com'], subject: 'Hi', html: '<b>hi</b>' });

  const body = lastBody(fetchApi);
  assert.equal(body.html_content, '<b>hi</b>');
  assert.ok(!('content' in body), 'content omitted when only html is given');
});

// §3.3.3 — Multi-recipient arrays → CSV --------------------------------------
test('§3.3.3 to/cc/bcc arrays serialize as comma-joined CSV', async () => {
  const fetchApi = makeFetch(200, { message: 'OK', mid: 1 });
  const client = clientWith(fetchApi);

  await client.mail.send({
    from: 'a@x.com',
    to: ['b@y.com', 'c@y.com'],
    cc: ['d@y.com', 'e@y.com'],
    bcc: ['f@y.com', 'g@y.com'],
    text: 'x',
  });

  const body = lastBody(fetchApi);
  assert.equal(body.to, 'b@y.com,c@y.com');
  assert.equal(body.cc, 'd@y.com,e@y.com');
  assert.equal(body.bcc, 'f@y.com,g@y.com');
});

// §3.3.4 — Reply-To mapping ---------------------------------------------------
test('§3.3.4 replyTo maps to custom_headers["reply-to"] and never leaks top-level', async () => {
  const fetchApi = makeFetch(200, { message: 'OK', mid: 1 });
  const client = clientWith(fetchApi);

  await client.mail.send({
    from: 'a@x.com',
    to: ['b@y.com'],
    text: 'x',
    replyTo: 'reply@x.com',
    headers: { 'X-Foo': 'bar' },
  });

  const body = lastBody(fetchApi);
  assert.equal(body.custom_headers['reply-to'], 'reply@x.com');
  assert.equal(body.custom_headers['X-Foo'], 'bar', 'explicit headers merged alongside replyTo');
  assert.ok(!('replyTo' in body) && !('reply_to' in body), 'no top-level replyTo on the wire');
});

test('§3.3.4b explicit replyTo wins over a reply-to key in headers', async () => {
  const fetchApi = makeFetch(200, { message: 'OK', mid: 1 });
  const client = clientWith(fetchApi);

  await client.mail.send({
    from: 'a@x.com',
    to: ['b@y.com'],
    text: 'x',
    replyTo: 'winner@x.com',
    headers: { 'reply-to': 'loser@x.com' },
  });

  assert.equal(lastBody(fetchApi).custom_headers['reply-to'], 'winner@x.com');
});

// §3.3.5 — Byte attachment → base64 ------------------------------------------
test('§3.3.5 byte attachment is base64-encoded with renamed fields', async () => {
  const fetchApi = makeFetch(200, { message: 'OK', mid: 1 });
  const client = clientWith(fetchApi);

  const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
  await client.mail.send({
    from: 'a@x.com',
    to: ['b@y.com'],
    text: 'x',
    attachments: [{ content: bytes, filename: 'h.txt', contentType: 'text/plain', contentId: 'cid1' }],
  });

  const att = lastBody(fetchApi).attachments[0];
  assert.equal(att.content, 'aGVsbG8=', 'content is base64 of the raw bytes');
  assert.equal(att.name, 'h.txt', 'filename → name');
  assert.equal(att.type, 'text/plain', 'contentType → type');
  assert.equal(att.content_id, 'cid1', 'contentId → content_id');
});

test('§3.3.5b attachment without contentId omits content_id', async () => {
  const fetchApi = makeFetch(200, { message: 'OK', mid: 1 });
  const client = clientWith(fetchApi);

  await client.mail.send({
    from: 'a@x.com',
    to: ['b@y.com'],
    text: 'x',
    attachments: [
      { content: new Uint8Array([1, 2, 3]), filename: 'a.bin', contentType: 'application/octet-stream' },
    ],
  });

  const att = lastBody(fetchApi).attachments[0];
  assert.ok(!('content_id' in att), 'content_id omitted when contentId not provided');
});

// §3.3.6 — Region routing -----------------------------------------------------
test('§3.3.6 region:"eu" targets the EU host; global targets the global host', async () => {
  const euFetch = makeFetch(200, { message: 'OK', mid: 1 });
  await clientWith(euFetch, { region: 'eu' }).mail.send({ from: 'a@x.com', to: ['b@y.com'], text: 'x' });
  assert.equal(lastUrl(euFetch), 'https://api.eu.turbo-smtp.com/api/v2/mail/send');

  const globalFetch = makeFetch(200, { message: 'OK', mid: 1 });
  await clientWith(globalFetch, { region: 'global' }).mail.send({
    from: 'a@x.com',
    to: ['b@y.com'],
    text: 'x',
  });
  assert.equal(lastUrl(globalFetch), 'https://api.turbo-smtp.com/api/v2/mail/send');
});

// §3.3.7 — Auth failure (401) -------------------------------------------------
test('§3.3.7 a 401 throws AuthenticationError carrying errorCode/message/details', async () => {
  const fetchApi = makeFetch(401, { errorCode: 7, message: 'unauthorized', details: 'bad key' });
  const client = clientWith(fetchApi);

  await assert.rejects(
    () => client.mail.send({ from: 'a@x.com', to: ['b@y.com'], text: 'x' }),
    (err) => {
      assert.ok(err instanceof AuthenticationError);
      assert.ok(err instanceof TurboSMTPError, 'subclass of the base error');
      assert.equal(err.status, 401);
      assert.equal(err.errorCode, 7);
      assert.equal(err.message, 'unauthorized');
      assert.equal(err.details, 'bad key');
      return true;
    },
  );
});

// §3.3.8 — Validation error (400) --------------------------------------------
test('§3.3.8 a 400 throws BadRequestError exposing the errors[] array', async () => {
  const fetchApi = makeFetch(400, { message: 'bad request', errors: ['from required', 'nocredit'] });
  const client = clientWith(fetchApi);

  await assert.rejects(
    () => client.mail.send({ from: '', to: [], text: 'x' }),
    (err) => {
      assert.ok(err instanceof BadRequestError);
      assert.equal(err.status, 400);
      assert.deepEqual(err.errors, ['from required', 'nocredit']);
      return true;
    },
  );
});

// --- Extra coverage (not numbered scenarios) --------------------------------
test('constructor rejects missing credentials with TurboSMTPError', () => {
  assert.throws(() => new TurboSMTPClient({ consumerKey: 'ck' }), TurboSMTPError);
  assert.throws(() => new TurboSMTPClient({ consumerSecret: 'cs' }), TurboSMTPError);
  assert.throws(() => new TurboSMTPClient({}), TurboSMTPError);
});

test('transport failure maps to NetworkError (status null)', async () => {
  const client = clientWith(makeThrowingFetch());

  await assert.rejects(
    () => client.mail.send({ from: 'a@x.com', to: ['b@y.com'], text: 'x' }),
    (err) => {
      assert.ok(err instanceof NetworkError);
      assert.equal(err.status, null);
      return true;
    },
  );
});

// §3.3.11 — Region rejection (routing itself is §3.3.6) ----------------------
test('§3.3.11 an unknown region is rejected at construction', () => {
  assert.throws(() => new TurboSMTPClient({ ...creds, region: 'EU' }), TurboSMTPError);
  assert.throws(() => new TurboSMTPClient({ ...creds, region: 'us' }), TurboSMTPError);
  assert.doesNotThrow(() => new TurboSMTPClient({ ...creds, region: 'eu' }));
  assert.doesNotThrow(() => new TurboSMTPClient({ ...creds, region: 'global' }));
  assert.doesNotThrow(() => new TurboSMTPClient(creds));
});

// Both fields are typed as required, but the package ships to JavaScript callers
// too, and the mapping runs before send's try block — so an omitted field used to
// surface as a TypeError naming an internal property, outside §3.4's hierarchy.
test('an omitted from or to throws a typed error naming the field', async () => {
  const client = clientWith(makeFetch(200, { mid: '1' }));

  for (const [field, message] of [
    ['from', { to: ['b@y.com'], text: 'x' }],
    ['to', { from: 'a@x.com', text: 'x' }],
  ]) {
    await assert.rejects(
      () => client.mail.send(message),
      (err) => err instanceof TurboSMTPError && err.message.includes(field),
      `an omitted ${field} must throw a typed error naming it`,
    );
  }
});

// §3.3 numbers the statuses the spec documents. These four are the rest of the §3.4
// hierarchy, and until now only the export list mentioned them: 429 and 5xx are not in
// the spec at all and are handled defensively, so nothing else would catch a regression.
test('the remaining §3.4 statuses map to their own error classes', async () => {
  const cases = [
    [403, { message: 'wrong_credentials_specified' }, ForbiddenError],
    [404, { message: 'domain_not_found' }, NotFoundError],
    [429, { message: 'too many requests' }, RateLimitError],
    [503, { message: 'upstream unavailable' }, ApiError],
  ];

  for (const [status, body, Expected] of cases) {
    const client = clientWith(makeFetch(status, body));

    await assert.rejects(
      () => client.mail.send({ from: 'a@x.com', to: ['b@y.com'], text: 'x' }),
      (err) => {
        assert.ok(err instanceof Expected, `${status} must be a ${Expected.name}, got ${err.name}`);
        assert.ok(err instanceof TurboSMTPError, 'every error stays under the base class');
        assert.equal(err.status, status);
        return true;
      },
      `status ${status}`,
    );
  }
});

test('a 429 carrying Retry-After exposes it as retryAfter', async () => {
  const client = clientWith(makeFetch(429, { message: 'slow down' }, { 'Retry-After': '30' }));

  await assert.rejects(
    () => client.mail.send({ from: 'a@x.com', to: ['b@y.com'], text: 'x' }),
    (err) => err instanceof RateLimitError && err.retryAfter === 30,
  );
});
