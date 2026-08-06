/**
 * EU-region routing (§3.3.6) — send through EU infrastructure.
 *
 * Pass `region: 'eu'` to route to https://api.eu.turbo-smtp.com/api/v2.
 * The default, `'global'`, uses https://api.turbo-smtp.com/api/v2.
 *
 * In your own project: import { TurboSMTPClient } from '@turbosmtp/sdk';
 * Run: node examples/js/eu-region.mjs  (build first; set creds).
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

const client = new TurboSMTPClient({ consumerKey, consumerSecret, region: 'eu' });

const { messageId } = await client.mail.send({
  from,
  to,
  subject: 'Hello from the EU region',
  text: 'This send was routed through EU infrastructure.',
});

console.log(`Queued (EU) as ${messageId}`);
