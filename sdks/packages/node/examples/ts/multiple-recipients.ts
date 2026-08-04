/**
 * Multiple recipients (§3.3.3) + Reply-To (§3.3.4).
 *
 * `to`, `cc`, and `bcc` are always arrays; the SDK joins them for the wire.
 * `replyTo` is first-class and is sent as a custom `reply-to` header.
 *
 * In your own project: import { TurboSMTPClient } from '@turbosmtp/sdk';
 * Run: see examples/README.md (set CONSUMER_KEY / CONSUMER_SECRET first).
 */
import { TurboSMTPClient } from '../../src/index';

async function main(): Promise<void> {
  const consumerKey = process.env.CONSUMER_KEY;
  const consumerSecret = process.env.CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    console.error('Set CONSUMER_KEY and CONSUMER_SECRET in your environment.');
    process.exit(1);
    return;
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
