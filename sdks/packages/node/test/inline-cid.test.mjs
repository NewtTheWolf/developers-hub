/**
 * Inline image references (client-contract.md §4.5).
 *
 * TurboSMTP composes an inline part's Content-ID as `<content_id@sender-domain>`,
 * so the HTML reference has to carry that domain or the image is delivered as a
 * plain attachment. The wire `content_id` stays bare.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TurboSMTPClient } from '../dist/cjs/index.js';
import { lastBody, makeFetch } from './helpers.mjs';

const creds = { consumerKey: 'ck', consumerSecret: 'cs' };
const bytes = new Uint8Array([1, 2, 3]);

const send = async (message) => {
  const fetchApi = makeFetch(200, { message: 'OK', mid: 1 });
  await new TurboSMTPClient({ ...creds, fetchApi }).mail.send(message);
  return lastBody(fetchApi);
};

const inline = (contentId) => ({ content: bytes, filename: 'l.png', contentType: 'image/png', contentId });

test('§3.3.5 a bare cid reference gains the sender domain', async () => {
  const body = await send({
    from: 'a@x.com',
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:logo">',
    attachments: [inline('logo')],
  });

  assert.equal(body.html_content, '<img src="cid:logo@x.com">');
});

test('§3.3.5 the wire attachment keeps the bare content_id', async () => {
  const body = await send({
    from: 'a@x.com',
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:logo">',
    attachments: [inline('logo')],
  });

  assert.equal(body.attachments[0].content_id, 'logo');
});

test('§3.3.5 a sender with a display name still yields the domain', async () => {
  const body = await send({
    from: { address: 'a@x.com', name: 'Sales' },
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:logo">',
    attachments: [inline('logo')],
  });

  assert.equal(body.html_content, '<img src="cid:logo@x.com">');
});

test('§3.3.5 a pre-formatted sender string still yields the domain', async () => {
  const body = await send({
    from: 'Sales <a@x.com>',
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:logo">',
    attachments: [inline('logo')],
  });

  assert.equal(body.html_content, '<img src="cid:logo@x.com">');
});

test('§3.3.5 an already-qualified reference is left alone', async () => {
  const body = await send({
    from: 'a@x.com',
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:logo@other.com">',
    attachments: [inline('logo@other.com')],
  });

  assert.equal(body.html_content, '<img src="cid:logo@other.com">');
});

test('§3.3.5 a shorter id does not match inside a longer one', async () => {
  const body = await send({
    from: 'a@x.com',
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:logo"><img src="cid:logo2">',
    attachments: [inline('logo'), inline('logo2')],
  });

  assert.equal(body.html_content, '<img src="cid:logo@x.com"><img src="cid:logo2@x.com">');
});

test('§3.3.5 every occurrence of the same id is qualified', async () => {
  const body = await send({
    from: 'a@x.com',
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:logo"><img src="cid:logo">',
    attachments: [inline('logo')],
  });

  assert.equal(body.html_content, '<img src="cid:logo@x.com"><img src="cid:logo@x.com">');
});

test('an attachment without a contentId triggers no rewrite', async () => {
  const body = await send({
    from: 'a@x.com',
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:logo">',
    attachments: [{ content: bytes, filename: 'l.png', contentType: 'image/png' }],
  });

  assert.equal(body.html_content, '<img src="cid:logo">');
});

test('§3.3.5 a text-only message is untouched', async () => {
  const body = await send({
    from: 'a@x.com',
    to: ['b@y.com'],
    subject: 'Hi',
    text: 'see cid:logo',
    attachments: [inline('logo')],
  });

  assert.equal(body.content, 'see cid:logo');
  assert.ok(!('html_content' in body), 'html_content omitted when only text is given');
});

test('§3.3.5 a sender without a parseable domain triggers no rewrite', async () => {
  const body = await send({
    from: 'nodomain',
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:logo">',
    attachments: [inline('logo')],
  });

  assert.equal(body.html_content, '<img src="cid:logo">');
});

test('a contentId containing regex replacement specials is qualified literally', async () => {
  const body = await send({
    from: 'a@x.com',
    to: ['b@y.com'],
    subject: 'Hi',
    html: '<img src="cid:a$&b"><img src="cid:c$`d">',
    attachments: [inline('a$&b'), inline('c$`d')],
  });

  assert.equal(body.html_content, '<img src="cid:a$&b@x.com"><img src="cid:c$`d@x.com">');
});
