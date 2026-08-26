/**
 * Address formatting (client-contract.md §4.1), plus conformance scenarios §3.3.9
 * and §3.3.10, which are address rules rather than send-shape rules.
 *
 * Every address parameter accepts a pre-formatted string, a structured address
 * with an optional display name, or a collection of either. Assertions read the
 * serialized request body, so they pin the wire form rather than the facade's
 * internals.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TurboSMTPClient } from '../dist/cjs/index.js';
import { lastBody, makeFetch } from './helpers.mjs';

const creds = { consumerKey: 'ck', consumerSecret: 'cs' };

const send = async (message) => {
  const fetchApi = makeFetch(200, { message: 'OK', mid: 1 });
  await new TurboSMTPClient({ ...creds, fetchApi }).mail.send(message);
  return lastBody(fetchApi);
};

const base = { subject: 'Hi', text: 'hello' };

test('a plain string address is passed through verbatim', async () => {
  const body = await send({ ...base, from: 'Sales <a@x.com>', to: ['b@y.com'] });

  assert.equal(body.from, 'Sales <a@x.com>');
  assert.equal(body.to, 'b@y.com');
});

test('an address object without a name serializes to the bare address', async () => {
  const body = await send({ ...base, from: { address: 'a@x.com' }, to: [{ address: 'b@y.com' }] });

  assert.equal(body.from, 'a@x.com');
  assert.equal(body.to, 'b@y.com');
});

test('a plain display name is emitted unquoted', async () => {
  const body = await send({ ...base, from: { address: 'a@x.com', name: 'Sales' }, to: ['b@y.com'] });

  assert.equal(body.from, 'Sales <a@x.com>');
});

test('a display name containing specials is quoted', async () => {
  const body = await send({ ...base, from: 'a@x.com', to: [{ address: 'b@y.com', name: 'Dr. Smith' }] });

  assert.equal(body.to, '"Dr. Smith" <b@y.com>');
});

// Live-verified: the API splits to/cc/bcc on commas before it parses quoted strings,
// so a comma in a recipient display name is rejected with a 400 no matter how it is
// quoted. Failing locally with a usable message beats a remote "'\"Doe' not valid".
test('a comma in a recipient display name is rejected with an actionable message', async () => {
  for (const field of ['to', 'cc', 'bcc']) {
    await assert.rejects(
      send({
        ...base,
        from: 'a@x.com',
        to: ['b@y.com'],
        [field]: [{ address: 'c@y.com', name: 'Doe, Jane' }],
      }),
      (err) => err.message.includes(field) && /comma/i.test(err.message),
      `${field} must reject a comma in a display name`,
    );
  }
});

// The check reads the display name, not the formatted output: a bare CSV is the
// wire format of these fields, so rejecting it would refuse the exact string the
// SDK itself emits, and §4.1 passes a pre-formatted string through verbatim.
test('a comma-separated recipient string is passed through, not rejected', async () => {
  const body = await send({ ...base, from: 'a@x.com', to: 'b@y.com,c@y.com' });

  assert.equal(body.to, 'b@y.com,c@y.com');
});

test('an array of plain addresses still joins to the same CSV it accepts', async () => {
  const body = await send({ ...base, from: 'a@x.com', to: ['b@y.com', 'c@y.com'] });

  assert.equal(body.to, 'b@y.com,c@y.com');
});

test('a comma in the sender display name is allowed and quoted', async () => {
  const body = await send({ ...base, from: { address: 'a@x.com', name: 'Acme, Inc.' }, to: ['b@y.com'] });

  assert.equal(body.from, '"Acme, Inc." <a@x.com>');
});

test('a comma in a replyTo display name is allowed and quoted', async () => {
  const body = await send({
    ...base,
    from: 'a@x.com',
    to: ['b@y.com'],
    replyTo: { address: 'r@x.com', name: 'Desk, Reply' },
  });

  assert.equal(body.custom_headers['reply-to'], '"Desk, Reply" <r@x.com>');
});

test('quotes and backslashes inside a display name are escaped', async () => {
  const body = await send({ ...base, from: 'a@x.com', to: [{ address: 'b@y.com', name: 'A "B" \\ C' }] });

  assert.equal(body.to, '"A \\"B\\" \\\\ C" <b@y.com>');
});

test('a single address needs no array', async () => {
  const body = await send({ ...base, from: 'a@x.com', to: 'b@y.com' });

  assert.equal(body.to, 'b@y.com');
});

test('mixed strings and objects join as CSV across to, cc and bcc', async () => {
  const body = await send({
    ...base,
    from: 'a@x.com',
    to: ['b@y.com', { address: 'c@y.com', name: 'C' }],
    cc: { address: 'd@y.com', name: 'D Jr' },
    bcc: ['e@y.com'],
  });

  assert.equal(body.to, 'b@y.com,C <c@y.com>');
  assert.equal(body.cc, 'D Jr <d@y.com>');
  assert.equal(body.bcc, 'e@y.com');
});

test('replyTo accepts an address object and reaches custom_headers', async () => {
  const body = await send({
    ...base,
    from: 'a@x.com',
    to: ['b@y.com'],
    replyTo: { address: 'r@x.com', name: 'Reply Desk' },
  });

  assert.equal(body.custom_headers['reply-to'], 'Reply Desk <r@x.com>');
});

// §3.3.9 — Reply-To precedence ------------------------------------------------
test('§3.3.9 an explicit replyTo replaces a custom header of any casing', async () => {
  const body = await send({
    ...base,
    from: 'a@x.com',
    to: ['b@y.com'],
    replyTo: 'wins@x.com',
    headers: { 'Reply-To': 'loses@x.com' },
  });

  const keys = Object.keys(body.custom_headers).filter((k) => k.toLowerCase() === 'reply-to');
  assert.deepEqual(keys, ['reply-to'], 'exactly one reply-to header reaches the wire');
  assert.equal(body.custom_headers['reply-to'], 'wins@x.com');
});

test('a custom Reply-To header survives when no replyTo is given', async () => {
  const body = await send({
    ...base,
    from: 'a@x.com',
    to: ['b@y.com'],
    headers: { 'Reply-To': 'kept@x.com' },
  });

  assert.equal(body.custom_headers['Reply-To'], 'kept@x.com');
});

// §3.3.10 — Line-break rejection ----------------------------------------------
// Every address field routes through formatAddress, so the guard is asserted on all
// five rather than on the one that happened to be reported. Custom headers reach a
// MIME header just as directly, so they are covered by the same scenario.
const FIELDS = ['from', 'to', 'cc', 'bcc', 'replyTo'];
const valid = { from: 'a@x.com', to: ['b@y.com'] };

test('§3.3.10 a line break in a display name is rejected in every address field', async () => {
  for (const field of FIELDS) {
    const injected = { address: 'evil@x.com', name: 'Jane\r\nBcc: evil@example.com' };
    await assert.rejects(
      send({ ...base, ...valid, [field]: field === 'from' || field === 'replyTo' ? injected : [injected] }),
      /line break/i,
      `a display name in ${field} must not be able to inject a header`,
    );
  }
});

test('§3.3.10 a line break in a pre-formatted address string is rejected in every address field', async () => {
  for (const field of FIELDS) {
    const injected = 'evil@x.com\nBcc: evil@example.com';
    await assert.rejects(
      send({ ...base, ...valid, [field]: field === 'from' || field === 'replyTo' ? injected : [injected] }),
      /line break/i,
      `a pre-formatted address in ${field} must not be able to inject a header`,
    );
  }
});

test('§3.3.10 a line break in a custom header is rejected, in the name and in the value', async () => {
  const cases = [{ 'X-Foo': 'bar\r\nBcc: evil@example.com' }, { 'X-Foo\r\nBcc: evil@example.com': 'bar' }];
  for (const headers of cases) {
    await assert.rejects(send({ ...base, ...valid, headers }), /line break/i);
  }
});
