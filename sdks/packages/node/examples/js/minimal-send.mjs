/**
 * Minimal send (client-contract.md §3.3.1) — a plain-text email.
 *
 * In your own project, install the package and import from it:
 *     import { TurboSMTPClient } from '@turbosmtp/sdk';
 * These in-repo examples import from the built output (run `npm run build` first).
 *
 * Run: node examples/js/minimal-send.mjs  (set CONSUMER_KEY / CONSUMER_SECRET first).
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
  subject: 'Hello from TurboSMTP',
  text: 'Sent with the TurboSMTP Node.js SDK.',
});

console.log(`Queued as ${messageId}`);
