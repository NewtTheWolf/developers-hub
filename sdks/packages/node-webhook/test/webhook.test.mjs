/**
 * Event webhook conformance.
 *
 * The assertions pin the payload shape TurboSMTP actually sends, which differs
 * from the published documentation: the object is flat, `status` is uppercase,
 * the timestamp key is capitalised, and `mid` is a 64-bit snowflake.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseWebhookEvents, verifyBasicAuth } from '../dist/cjs/index.js';

const event = {
  mid: '9007199254740993',
  email: 'b@y.com',
  status: 'DELIVERED',
  Timestamp: 1755500000,
  subject: 'Hi',
  reference_id: 'ref-1',
  useragent: 'Mozilla/5.0',
};

test('a flat single event parses into one typed event', () => {
  const [parsed] = parseWebhookEvents(event);

  assert.equal(parsed.mid, '9007199254740993');
  assert.equal(parsed.email, 'b@y.com');
  assert.equal(parsed.status, 'DELIVERED');
  assert.deepEqual(parsed.timestamp, new Date(1755500000 * 1000));
  assert.equal(parsed.subject, 'Hi');
  assert.equal(parsed.referenceId, 'ref-1');
  assert.equal(parsed.userAgent, 'Mozilla/5.0');
  assert.deepEqual(parsed.raw, event);
});

test('an array body parses every event', () => {
  const events = parseWebhookEvents([event, { ...event, status: 'OPENED' }]);

  assert.equal(events.length, 2);
  assert.equal(events[1].status, 'OPENED');
});

test('a JSON string body is parsed before mapping', () => {
  const [parsed] = parseWebhookEvents(JSON.stringify(event));

  assert.equal(parsed.email, 'b@y.com');
});

test('the capitalised Timestamp wins over a lowercase one', () => {
  const [parsed] = parseWebhookEvents({ ...event, timestamp: 1 });

  assert.deepEqual(parsed.timestamp, new Date(1755500000 * 1000));
});

test('a lowercase timestamp is accepted when Timestamp is absent', () => {
  const { Timestamp, ...rest } = event;
  const [parsed] = parseWebhookEvents({ ...rest, timestamp: 1755500000 });

  assert.deepEqual(parsed.timestamp, new Date(1755500000 * 1000));
});

test('a numeric string timestamp is accepted', () => {
  const [parsed] = parseWebhookEvents({ ...event, Timestamp: '1755500000' });

  assert.deepEqual(parsed.timestamp, new Date(1755500000 * 1000));
});

test('a 64-bit mid survives a string body that JSON.parse would round', () => {
  const body = '{"mid":9007199254740993,"email":"b@y.com","status":"DELIVERED","Timestamp":1755500000}';
  const [parsed] = parseWebhookEvents(body);

  assert.equal(parsed.mid, '9007199254740993', 'plain JSON.parse would yield ...992');
});

test('an unsafe numeric mid from a parsed object is rejected instead of returned rounded', () => {
  const parsedBody = JSON.parse(
    '{"mid":9007199254740993,"email":"b@y.com","status":"DELIVERED","Timestamp":1755500000}',
  );

  assert.equal(parsedBody.mid, 9007199254740992, 'JSON.parse demonstrates that the original value is lost');
  assert.throws(() => parseWebhookEvents(parsedBody), /unsafe numeric mid/);
});

test('a safe numeric mid from a parsed object is converted to a string', () => {
  const [parsed] = parseWebhookEvents({ ...event, mid: 42 });

  assert.equal(parsed.mid, '42');
});

test('a missing required field throws', () => {
  assert.throws(() => parseWebhookEvents({ mid: '1', email: 'b@y.com' }), /missing required fields/);
});

test('a non-numeric timestamp throws', () => {
  assert.throws(() => parseWebhookEvents({ ...event, Timestamp: 'soon' }), /invalid timestamp/);
});

test('a non-object event throws', () => {
  assert.throws(() => parseWebhookEvents(['nope']), /not an object/);
});

test('malformed JSON throws', () => {
  assert.throws(() => parseWebhookEvents('{'), SyntaxError);
});

test('an empty optional field becomes undefined', () => {
  const [parsed] = parseWebhookEvents({ ...event, subject: '' });

  assert.equal(parsed.subject, undefined);
  assert.equal(parsed.url, undefined);
  assert.equal(parsed.ip, undefined);
});

const header = (secret) => `Basic ${Buffer.from(secret).toString('base64')}`;

test('a matching basic credential is accepted', () => {
  assert.equal(verifyBasicAuth(header('user:pass'), 'user:pass'), true);
});

test('the scheme is matched case-insensitively', () => {
  assert.equal(verifyBasicAuth(header('user:pass').replace('Basic', 'basic'), 'user:pass'), true);
});

test('a wrong secret is rejected', () => {
  assert.equal(verifyBasicAuth(header('user:pass'), 'user:nope'), false);
});

test('a secret of a different length is rejected without throwing', () => {
  assert.equal(verifyBasicAuth(header('user:pass'), 'u:p'), false);
});

test('a non-basic scheme is rejected', () => {
  assert.equal(verifyBasicAuth('Bearer abc', 'user:pass'), false);
});

test('a missing or malformed header is rejected', () => {
  assert.equal(verifyBasicAuth(null, 'user:pass'), false);
  assert.equal(verifyBasicAuth(undefined, 'user:pass'), false);
  assert.equal(verifyBasicAuth('', 'user:pass'), false);
  assert.equal(verifyBasicAuth('Basic', 'user:pass'), false);
});

// An end-to-end pass over the receiver shape the README documents: real request,
// real header casing, body arriving in chunks.
test('the documented receiver accepts an authentic request and rejects a forged one', async () => {
  const { createServer } = await import('node:http');
  const secret = 'hooks:s3cret';
  const received = [];

  const server = createServer((req, res) => {
    if (!verifyBasicAuth(req.headers.authorization, secret)) {
      res.writeHead(401).end();
      return;
    }
    req.setEncoding('utf8');
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      received.push(...parseWebhookEvents(body));
      res.writeHead(200).end();
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/turbosmtp`;

  try {
    const authed = await fetch(url, {
      method: 'POST',
      headers: { authorization: header(secret), 'content-type': 'application/json' },
      body: JSON.stringify(event),
    });
    assert.equal(authed.status, 200);
    assert.equal(received.length, 1);
    assert.equal(received[0].mid, '9007199254740993');
    assert.equal(received[0].status, 'DELIVERED');

    const forged = await fetch(url, {
      method: 'POST',
      headers: { authorization: header('hooks:guess') },
      body: JSON.stringify(event),
    });
    assert.equal(forged.status, 401);
    assert.equal(received.length, 1, 'a forged request reaches no handler');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// The 64-bit precision guard rewrites number literals, so it must never touch a
// digit run that sits inside a string value.
test('a 16-digit run inside a subject is left alone', () => {
  const body = JSON.stringify({ ...event, subject: 'Order [1234567890123456] shipped' });
  const [parsed] = parseWebhookEvents(body);

  assert.equal(parsed.subject, 'Order [1234567890123456] shipped');
});

test('a 16-digit run inside a url is left alone', () => {
  const body = JSON.stringify({ ...event, url: 'https://x.com/?t=1234567890123456,9' });
  const [parsed] = parseWebhookEvents(body);

  assert.equal(parsed.url, 'https://x.com/?t=1234567890123456,9');
});

test('an escaped quote before a digit run does not confuse the scanner', () => {
  const body = JSON.stringify({ ...event, subject: 'say \\" then [1234567890123456]' });
  const [parsed] = parseWebhookEvents(body);

  assert.equal(parsed.subject, 'say \\" then [1234567890123456]');
  assert.equal(parsed.mid, '9007199254740993');
});

test('a long fractional part is not quoted', () => {
  const [parsed] = parseWebhookEvents(
    '{"mid":1,"email":"b@y.com","status":"OK","Timestamp":1.12345678901234567}',
  );

  assert.equal(parsed.mid, '1');
});

test('an unsafe exponent-form mid is not quoted and is rejected after parsing', () => {
  assert.throws(
    () => parseWebhookEvents('{"mid":1234567890123456e2,"email":"b@y.com","status":"OK","Timestamp":1}'),
    /unsafe numeric mid/,
  );
});

test('a negative long integer stays a number', () => {
  const [parsed] = parseWebhookEvents(
    '{"mid":-1234567890123456,"email":"b@y.com","status":"OK","Timestamp":1}',
  );

  assert.equal(parsed.mid, '-1234567890123456');
});

test('a multi-byte subject split across chunks survives the documented receiver', async () => {
  const { createServer } = await import('node:http');
  const secret = 'hooks:s3cret';
  const subject = 'Grüße aus München — 日本語テスト';
  const received = [];

  const server = createServer((req, res) => {
    if (!verifyBasicAuth(req.headers.authorization, secret)) {
      res.writeHead(401).end();
      return;
    }
    req.setEncoding('utf8');
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      received.push(...parseWebhookEvents(body));
      res.writeHead(200).end();
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/turbosmtp`;

  try {
    // Emit the payload one byte at a time so multi-byte characters straddle chunks.
    const payload = Buffer.from(JSON.stringify({ ...event, subject }), 'utf8');
    const stream = new ReadableStream({
      start(controller) {
        for (const byte of payload) {
          controller.enqueue(new Uint8Array([byte]));
        }
        controller.close();
      },
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: header(secret), 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    });

    assert.equal(res.status, 200);
    assert.equal(received.at(-1).subject, subject, 'no replacement characters on chunk boundaries');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// The sibling package carries the same assertion. It was added there first, and this
// package kept emitting maps that `files` does not ship — so the check belongs in both.
test('the shipped builds carry no dangling source map references', async () => {
  const { readFileSync } = await import('node:fs');

  for (const artifact of ['../dist/cjs/index.js', '../dist/esm/index.mjs', '../dist/cjs/index.d.ts']) {
    const text = readFileSync(new URL(artifact, import.meta.url), 'utf8');
    assert.ok(
      !text.includes('sourceMappingURL'),
      `${artifact} points at a source map the tarball does not ship`,
    );
  }
});
