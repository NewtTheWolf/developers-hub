/**
 * Attachments (§3.3.5) — a file attachment plus an embedded image.
 *
 * `Attachment.content` is raw bytes (Uint8Array | ArrayBuffer); the SDK
 * base64-encodes it. Set `contentId` and reference it from HTML as `cid:<id>`;
 * the SDK appends the sender domain, which is what TurboSMTP matches inline
 * parts on — a bare reference would arrive as a plain attachment instead.
 * This example builds bytes in-memory (TextEncoder / atob) so it has no file
 * dependency — in a real app you'd read bytes from disk, e.g.
 *     import { readFile } from 'node:fs/promises';
 *     const pdf = await readFile('invoice.pdf');
 *
 * In your own project: import { TurboSMTPClient } from '@turbosmtp/sdk';
 * Run: see examples/README.md (set CONSUMER_KEY / CONSUMER_SECRET first).
 */
import { TurboSMTPClient } from '../../src/index';

// A 1x1 transparent PNG, decoded from base64 to raw bytes.
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function main(): Promise<void> {
  const consumerKey = process.env.CONSUMER_KEY;
  const consumerSecret = process.env.CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    console.error('Set CONSUMER_KEY and CONSUMER_SECRET in your environment.');
    process.exit(1);
    return;
  }

  const from = process.env.EXAMPLE_FROM ?? 'billing@yourdomain.com';
  const to = (process.env.EXAMPLE_TO ?? 'recipient@example.com').split(',');

  const receipt = new TextEncoder().encode('Thank you for your order!\nTotal: $42.00\n');
  const logo = Uint8Array.from(atob(PNG_1X1), (c) => c.charCodeAt(0));

  const client = new TurboSMTPClient({ consumerKey, consumerSecret });

  const { messageId } = await client.mail.send({
    from,
    to,
    subject: 'Invoice #1042',
    html: '<img src="cid:logo" alt="logo"><p>Your receipt is attached.</p>',
    attachments: [
      { content: receipt, filename: 'receipt.txt', contentType: 'text/plain' },
      { content: logo, filename: 'logo.png', contentType: 'image/png', contentId: 'logo' },
    ],
  });

  console.log(`Queued as ${messageId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
