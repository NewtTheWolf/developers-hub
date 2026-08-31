# @turbosmtp/webhook

Parse and authenticate [TurboSMTP](https://serversmtp.com) event webhooks in Node.js.

Delivery and engagement events (delivered, bounced, opened, clicked, spam, …) are POSTed to a
callback URL you configure in the TurboSMTP dashboard. This package turns those requests into
typed events and checks that they really came from TurboSMTP.

Zero runtime dependencies. Node 22 or newer.

## Install

```bash
npm install @turbosmtp/webhook
```

## Authentication

**TurboSMTP does not sign webhook requests.** Authentication is HTTP Basic credentials embedded
in the callback URL you register in the dashboard:

```
https://hooks:a-long-random-secret@your-host.example.com/turbosmtp
```

TurboSMTP sends those credentials as an `Authorization: Basic …` header on every delivery.
`verifyBasicAuth` compares them against your copy in constant time.

Pick a long random secret and treat it like an API key: it is the only thing separating your
endpoint from anyone who guesses the URL. Serve the endpoint over HTTPS.

## Usage

```js
import { createServer } from 'node:http';
import { parseWebhookEvents, verifyBasicAuth } from '@turbosmtp/webhook';

const SECRET = process.env.TURBOSMTP_WEBHOOK_SECRET; // "hooks:a-long-random-secret"

createServer((req, res) => {
  if (!verifyBasicAuth(req.headers.authorization, SECRET)) {
    res.writeHead(401).end();
    return;
  }

  // Decode as one stream: concatenating Buffers as strings corrupts any multi-byte
  // character that lands on a chunk boundary.
  req.setEncoding('utf8');
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      for (const event of parseWebhookEvents(body)) {
        console.log(event.status, event.email, event.mid, event.timestamp.toISOString());
      }
      res.writeHead(200).end();
    } catch (error) {
      console.error('Rejected a malformed TurboSMTP webhook:', error);
      res.writeHead(400).end();
    }
  });
}).listen(3000);
```

Acknowledge with a `2xx` promptly and do the real work asynchronously. Events arrive chunked
across several requests during a burst.

## API

### `parseWebhookEvents(body): TurboSMTPEvent[]`

Accepts the request body as a raw JSON string, an already-parsed object, or an array of objects,
and always returns an array. Prefer the raw JSON body so the parser can preserve a 64-bit `mid`
before JavaScript rounds it. An already-parsed object remains supported when `mid` is a string or
a safe integer.

Throws a `SyntaxError` if a string body is not valid JSON, and an `Error` if an event is not an
object, is missing `mid`, `email`, `status` or a timestamp, or carries an unsafe numeric `mid` whose
original value can no longer be recovered.

### `verifyBasicAuth(authorizationHeader, secret): boolean`

Compares the `Authorization` header against the `user:pass` pair configured on the callback URL,
in constant time. Returns `false` for an absent, malformed or non-Basic header rather than
throwing, so it reads as a plain authorization gate.

### `TurboSMTPEvent`

| Field | Type | Notes |
|---|---|---|
| `mid` | `string` | Message id. A 64-bit snowflake, kept as a string. |
| `email` | `string` | Recipient the event refers to. |
| `status` | `EventStatus` | `DELIVERED`, `BOUNCED`, `OPENED`, … Uppercase. |
| `timestamp` | `Date` | Converted from the epoch seconds sent by TurboSMTP. |
| `subject` | `string?` | Subject of the original message. |
| `url` | `string?` | Clicked URL, on `CLICKED` events. |
| `ip` | `string?` | Originating IP. |
| `userAgent` | `string?` | Client user agent, on engagement events. |
| `referenceId` | `string?` | The `referenceId` you passed at send time. |
| `raw` | `Record<string, unknown>` | The event object exactly as received. |

`EventStatus` is a union of the known delivery and engagement statuses, widened to accept any
string so a status added later does not break parsing.

## What this package handles for you

Live payloads differ from the published documentation in ways that break naive parsers:

- The event object is **flat**, not nested under an envelope.
- `status` arrives **uppercase**.
- The timestamp key is **`Timestamp`**, capitalised. A lowercase `timestamp` is accepted as a
  fallback.
- `mid` is a **64-bit snowflake**. `JSON.parse` silently rounds it above 2^53, so a long integer
  literal is quoted before the raw body is parsed. The scan is string-aware: a digit run inside a
  subject or a URL is left exactly as it arrived. If middleware has already parsed and rounded a
  numeric `mid`, the parser rejects it rather than returning a corrupted identifier; retain the raw
  body or configure the upstream parser to preserve `mid` as a string.
- Bursts arrive **chunked** across multiple requests.

## Related

- [`@turbosmtp/sdk`](../node) — send email through the TurboSMTP API.

## License

MIT
