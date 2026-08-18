/**
 * Error handling (§3.3.7 auth failure, §3.3.8 validation error).
 *
 * Every failure throws a subclass of TurboSMTPError. This example triggers a
 * 401 (bad credentials) and a 400 (invalid payload) on purpose and handles each
 * by type. Neither case sends mail.
 *
 * In your own project: import from '@turbosmtp/sdk'.
 * Run: node examples/js/error-handling.mjs  (build first; set creds).
 */
import {
  AuthenticationError,
  BadRequestError,
  NetworkError,
  TurboSMTPClient,
  TurboSMTPError,
} from '../../dist/esm/index.mjs';

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
if (!consumerKey || !consumerSecret) {
  console.error('Set CONSUMER_KEY and CONSUMER_SECRET in your environment.');
  process.exit(1);
}

const from = process.env.EXAMPLE_FROM ?? 'you@yourdomain.com';
const to = (process.env.EXAMPLE_TO ?? 'recipient@example.com').split(',');

// 1) Authentication failure (401) — deliberately wrong credentials.
const badClient = new TurboSMTPClient({ consumerKey: 'wrong', consumerSecret: 'wrong' });
try {
  await badClient.mail.send({ from, to, subject: 'Nope', text: 'x' });
  console.error('Expected an AuthenticationError, but the send succeeded.');
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.log(`AuthenticationError (status ${err.status}): ${err.message}`);
    if (err.details) console.log(`  details: ${err.details}`);
  } else {
    throw err;
  }
}

// 2) Validation error (400) — real credentials, but an empty recipient list.
const client = new TurboSMTPClient({ consumerKey, consumerSecret });
try {
  await client.mail.send({ from, to: [], subject: 'Missing recipient', text: 'x' });
  console.error('Expected a BadRequestError, but the send succeeded.');
} catch (err) {
  if (err instanceof BadRequestError) {
    console.log(`BadRequestError (status ${err.status}): ${err.errors?.join('; ') ?? err.message}`);
  } else if (err instanceof NetworkError) {
    console.log(`NetworkError: ${err.message}`);
  } else if (err instanceof TurboSMTPError) {
    console.log(`TurboSMTPError (status ${err.status}): ${err.message}`);
  } else {
    throw err;
  }
}
