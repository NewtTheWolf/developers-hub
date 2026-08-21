#!/usr/bin/env node
/**
 * End-to-end webhook check: send a real mail, receive the real callback, parse it.
 *
 * The parser is asserted against recorded payloads in the test suite. This closes the
 * one gap that cannot close offline — whether TurboSMTP still sends the shape we
 * recorded, and whether `referenceId` comes back on the event as documented.
 *
 * Operator-driven, and it has to be: the callback URL is configured in the TurboSMTP
 * dashboard and there is no endpoint for it in the OpenAPI spec, so nothing here can
 * register itself. Run it once the dashboard points at this receiver.
 *
 *   TURBOSMTP_CONSUMER_KEY=... TURBOSMTP_CONSUMER_SECRET=... \
 *   TURBOSMTP_TEST_FROM=... TURBOSMTP_TEST_TO=... \
 *   TURBOSMTP_HOOK_USER=... TURBOSMTP_HOOK_PASS=... \
 *   node scripts/live-loop.mjs [--port=8099] [--timeout=300]
 *
 * Exit 0 means a matching event arrived and parsed. Exit 1 means it did not.
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseWebhookEvents, verifyBasicAuth } = require('../dist/cjs/index.js');
const { TurboSMTPClient } = require('../../node/dist/cjs/index.js');

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const PORT = Number(arg('port', 8099));
const TIMEOUT_S = Number(arg('timeout', 300));
const { TURBOSMTP_HOOK_USER: USER, TURBOSMTP_HOOK_PASS: PASS } = process.env;

const required = [
  'TURBOSMTP_CONSUMER_KEY',
  'TURBOSMTP_CONSUMER_SECRET',
  'TURBOSMTP_TEST_FROM',
  'TURBOSMTP_TEST_TO',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing: ${missing.join(', ')}`);
  process.exit(1);
}

const reference = `live-loop-${process.pid}-${process.hrtime.bigint()}`;
let matched = false;

const server = createServer((req, res) => {
  if (USER && PASS && !verifyBasicAuth(req.headers.authorization, USER, PASS)) {
    res.writeHead(401).end();
    return;
  }

  req.setEncoding('utf8');
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    res.writeHead(200).end();
    let events;
    try {
      events = parseWebhookEvents(body);
    } catch (err) {
      console.error(`  rejected a payload: ${err.message}`);
      return;
    }

    for (const event of events) {
      const tag = `${event.status} mid=${event.mid} ${event.email}`;
      if (event.referenceId === reference) {
        console.log(`  MATCH  ${tag}`);
        matched = true;
        server.close();
        return;
      }
      console.log(`  other  ${tag}`);
    }
  });
});

server.listen(PORT, async () => {
  console.log(`Listening on :${PORT}. The dashboard callback must reach this port.`);
  console.log(`Waiting for reference_id ${reference} (${TIMEOUT_S}s).`);

  const client = new TurboSMTPClient({
    consumerKey: process.env.TURBOSMTP_CONSUMER_KEY,
    consumerSecret: process.env.TURBOSMTP_CONSUMER_SECRET,
  });
  const { messageId } = await client.mail.send({
    from: process.env.TURBOSMTP_TEST_FROM,
    to: [process.env.TURBOSMTP_TEST_TO],
    subject: `[live-loop] ${reference}`,
    text: 'Sent by the webhook live loop.',
    referenceId: reference,
  });
  console.log(`  sent   mid=${messageId}`);

  setTimeout(() => {
    if (!matched) {
      console.error('No matching event arrived. Check the dashboard callback URL and the delivery delay.');
      server.close();
    }
  }, TIMEOUT_S * 1000).unref();
});

server.on('close', () => {
  process.exitCode = matched ? 0 : 1;
});
