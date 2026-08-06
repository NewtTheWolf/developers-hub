/**
 * HTML send (client-contract.md §3.3.2) — an HTML body.
 *
 * In your own project: import { TurboSMTPClient } from '@turbosmtp/sdk';
 * Run: node examples/js/html-email.mjs  (build first; set CONSUMER_KEY / CONSUMER_SECRET).
 */
import { TurboSMTPClient } from '../../dist/esm/index.mjs';

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
if (!consumerKey || !consumerSecret) {
  console.error('Set CONSUMER_KEY and CONSUMER_SECRET in your environment.');
  process.exit(1);
}

const from = process.env.EXAMPLE_FROM ?? 'you@yourdomain.com';
const to = (process.env.EXAMPLE_TO ?? 'recipient@example.com').split(',');

const client = new TurboSMTPClient({ consumerKey, consumerSecret });

const { messageId } = await client.mail.send({
  from,
  to,
  subject: 'Your receipt',
  html: '<h1>Thanks!</h1><p>Your order is <strong>confirmed</strong>.</p>',
});

console.log(`Queued as ${messageId}`);
