/**
 * Multiple recipients + Reply-To.
 *
 * `to`, `cc`, and `bcc` accept a single address or an array; the SDK joins arrays for the wire.
 * `replyTo` is first-class and is sent as a custom `reply-to` header.
 *
 * In your own project: import { TurboSMTPClient } from '@turbosmtp/mail';
 * Run: node examples/js/multiple-recipients.mjs  (build first; set creds).
 */
import { TurboSMTPClient } from '../../dist/esm/index.mjs';

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
if (!consumerKey || !consumerSecret) {
  console.error('Set CONSUMER_KEY and CONSUMER_SECRET in your environment.');
  process.exit(1);
}

const from = process.env.EXAMPLE_FROM ?? 'newsletter@yourdomain.com';
const primary = process.env.EXAMPLE_TO ?? 'recipient@example.com';

const client = new TurboSMTPClient({ consumerKey, consumerSecret });

const { messageId } = await client.mail.send({
  from,
  to: [primary, 'second@example.com'],
  cc: ['manager@example.com'],
  bcc: ['archive@yourdomain.com'],
  replyTo: 'support@yourdomain.com',
  subject: 'March newsletter',
  html: '<p>Read the latest updates from our team.</p>',
});

console.log(`Queued as ${messageId}`);
