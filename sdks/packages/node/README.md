# @turbosmtp/sdk

> **Source, issues and pull requests live in
> [turboSMTP/developers-hub](https://github.com/turboSMTP/developers-hub/tree/main/sdks/packages/node).**
> The [`turbosmtp-node`](https://github.com/turboSMTP/turbosmtp-node) repository is a read-only mirror
> published automatically on release — changes pushed there are overwritten. Please file issues at
> [developers-hub/issues](https://github.com/turboSMTP/developers-hub/issues).

The official [TurboSMTP](https://serversmtp.com) SDK for **Node.js and TypeScript** — a small,
dependency-free client for sending transactional email through the TurboSMTP API.

- **Zero runtime dependencies** — uses the built-in `fetch`.
- **Typed end to end** — first-class TypeScript types for every request and response.
- **Idiomatic** — recipient arrays, `text`/`html` bodies, byte attachments (base64 handled for you),
  a typed error hierarchy, and a single options object for configuration.

> **Status:** `0.1.0` — P0 covers the `mail` namespace (`client.mail.send`). Email Validation and the
> other domains land in later releases.

---

## On this page

- [Requirements](#requirements)
- [Installation](#installation)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Sending email](#sending-email)
- [The result](#the-result)
- [Error handling](#error-handling)
- [Custom transport & testing](#custom-transport--testing)
- [Examples](#examples)
- [Next steps](#next-steps)

---

## Requirements

- **Node.js `>= 22`** — the SDK uses the global `fetch`, `Response`, and `Uint8Array`, so no polyfill
  or HTTP dependency is needed.
- Works with both **TypeScript** and plain **JavaScript** (CommonJS or ESM consumers).

---

## Installation

```bash
npm install @turbosmtp/sdk
```

You'll need your **Consumer Key** and **Consumer Secret** from the TurboSMTP dashboard. Keep them out
of source control — the examples below read them from environment variables.

---

## Quickstart

Send a plain-text email in a few lines.

```typescript
import { TurboSMTPClient } from '@turbosmtp/sdk';

const client = new TurboSMTPClient({
  consumerKey: process.env.CONSUMER_KEY!,
  consumerSecret: process.env.CONSUMER_SECRET!,
});

const { messageId } = await client.mail.send({
  from: 'you@yourdomain.com',
  to: ['recipient@example.com'],
  subject: 'Hello from TurboSMTP',
  text: 'Sent with the TurboSMTP Node.js SDK.',
});

console.log(`Queued as ${messageId}`);
```

The same code in JavaScript (ESM):

```javascript
import { TurboSMTPClient } from '@turbosmtp/sdk';

const client = new TurboSMTPClient({
  consumerKey: process.env.CONSUMER_KEY,
  consumerSecret: process.env.CONSUMER_SECRET,
});

const { messageId } = await client.mail.send({
  from: 'you@yourdomain.com',
  to: ['recipient@example.com'],
  subject: 'Hello from TurboSMTP',
  text: 'Sent with the TurboSMTP Node.js SDK.',
});

console.log(`Queued as ${messageId}`);
```

> **Note:** `from` must be an address on a domain authorized for your TurboSMTP account, otherwise the
> API rejects the send with a `400`.

---

## Configuration

The client takes a single options object:

| Option | Type | Required | Description |
|---|---|---|---|
| `consumerKey` | `string` | **Yes** | Your Consumer Key. Sent as the `consumerKey` header on every request. |
| `consumerSecret` | `string` | **Yes** | Your Consumer Secret. Sent as the `consumerSecret` header on every request. |
| `region` | `'global' \| 'eu'` | No | Sending region. Defaults to `'global'`. Use `'eu'` to route through EU infrastructure. |
| `fetchApi` | `typeof fetch` | No | Custom `fetch` implementation (test seam / custom transport). Defaults to the global `fetch`. |
| `headers` | `Record<string, string>` | No | Extra default headers merged into every request (escape hatch). |

Authentication is handled for you — the SDK attaches both consumer headers on every request and never
sends an `Authorization` header. The `region` selects the send host:

| Region | Host |
|---|---|
| `global` (default) | `https://api.turbo-smtp.com/api/v2` |
| `eu` | `https://api.eu.turbo-smtp.com/api/v2` |

```typescript
const euClient = new TurboSMTPClient({
  consumerKey: process.env.CONSUMER_KEY!,
  consumerSecret: process.env.CONSUMER_SECRET!,
  region: 'eu',
});
```

> **Missing credentials fail fast.** If `consumerKey` or `consumerSecret` is absent, the constructor
> throws a `TurboSMTPError` immediately — no request is made.

---

## Sending email

`client.mail.send(message)` accepts a `SendMessage`:

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | `Address` | **Yes** | Sender address (must be authorized for your account). |
| `to` | `AddressInput` | **Yes** | Recipient addresses. |
| `cc` | `AddressInput` | No | CC recipients. |
| `bcc` | `AddressInput` | No | BCC recipients. |
| `subject` | `string` | No | Subject line. |
| `text` | `string` | No | Plain-text body. |
| `html` | `string` | No | HTML body. |
| `replyTo` | `AddressInput` | No | Reply-To address (sent as a custom `reply-to` header). |
| `headers` | `Record<string, string>` | No | Additional custom headers. An explicit `replyTo` wins over a `reply-to` key here. |
| `attachments` | `Attachment[]` | No | File attachments (see below). |
| `referenceId` | `string` | No | Your identifier, echoed back in the Event Webhook. |
| `campaignId` | `string` | No | Campaign identifier. |
| `mimeRaw` | `string` | No | Raw MIME that replaces `text` + `html`. |

### Addresses

Every address field takes a plain string, an `{ address, name }` object, or an array of either:

```typescript
await client.mail.send({
  from: { address: 'billing@yourdomain.com', name: 'Acme Billing' },
  to: ['first@example.com', { address: 'second@example.com', name: 'Doe, Jane' }],
  subject: 'Invoice #1042',
  text: 'Attached.',
});
```

A plain string is sent exactly as you wrote it, so `'Acme <billing@yourdomain.com>'` works too. A
display name is quoted for you when it needs to be — the `Doe, Jane` above would otherwise split
into two bogus recipients at the comma.

### HTML body

```typescript
await client.mail.send({
  from: 'you@yourdomain.com',
  to: ['recipient@example.com'],
  subject: 'Your receipt',
  html: '<h1>Thanks!</h1><p>Your order is confirmed.</p>',
});
```

### Multiple recipients and Reply-To

`to`, `cc`, and `bcc` are always arrays — the SDK joins them for the wire.

```typescript
await client.mail.send({
  from: 'newsletter@yourdomain.com',
  to: ['a@example.com', 'b@example.com'],
  cc: ['manager@example.com'],
  bcc: ['archive@yourdomain.com'],
  replyTo: 'support@yourdomain.com',
  subject: 'March newsletter',
  html: '<p>Read the latest updates.</p>',
});
```

### Attachments

`Attachment.content` is **raw bytes** (`Uint8Array` or `ArrayBuffer`) — the SDK base64-encodes it for
you. Set `contentId` to embed an image in HTML via `cid:`.

Write the reference as the plain `cid:<id>` you would expect. TurboSMTP keys inline parts by
`<content_id@sender-domain>`, so the SDK appends your sender's domain to the reference before
sending; a bare reference would arrive as an ordinary attachment instead of rendering inline.

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | `Uint8Array \| ArrayBuffer` | **Yes** | Raw file bytes. |
| `filename` | `string` | **Yes** | Name shown to the recipient. |
| `contentType` | `string` | **Yes** | MIME type, e.g. `application/pdf`. |
| `contentId` | `string` | No | CID for embedding in HTML (`<img src="cid:...">`). |

```typescript
import { readFile } from 'node:fs/promises';

const pdf = await readFile('invoice.pdf');
const logo = await readFile('logo.png');

await client.mail.send({
  from: 'billing@yourdomain.com',
  to: ['customer@example.com'],
  subject: 'Invoice #1042',
  html: '<img src="cid:logo"><p>Your invoice is attached.</p>',
  attachments: [
    { content: pdf, filename: 'invoice.pdf', contentType: 'application/pdf' },
    { content: logo, filename: 'logo.png', contentType: 'image/png', contentId: 'logo' },
  ],
});
```

---

## Running the tests

```bash
npm test          # offline; mocked transport, no credentials needed
npm run test:live # sends real email, requires credentials
```

The live suite is skipped unless all four variables are set:

```bash
TURBOSMTP_CONSUMER_KEY=... TURBOSMTP_CONSUMER_SECRET=... \
TURBOSMTP_TEST_FROM=noreply@yourdomain.com \
TURBOSMTP_TEST_TO=you@yourdomain.com \
npm run test:live
```

It exists because a mocked suite can only prove what the SDK *serializes*, never what the API
*accepts* — the recipient-comma rule was found exactly that way.

---

## The result

A successful send resolves to a `SendResult`:

| Field | Type | Description |
|---|---|---|
| `messageId` | `string` | The message id (`mid`). |
| `raw` | `object` | The raw success body (`{ message, mid }`), if you need it. |

> **`messageId` is a string on purpose.** TurboSMTP message ids are 64-bit and exceed JavaScript's
> safe integer range, so parsing them as a `number` silently corrupts the value. The SDK returns the
> exact digits as a string — store and compare it as a string (or `BigInt`), never as a `number`.

---

## Error handling

Every failure throws a subclass of `TurboSMTPError`. Catch the base class to handle everything, or a
specific subclass to branch on the failure kind. Each error carries `status` (the HTTP status, or
`null` for transport failures), `message`, and `raw` (the parsed response body when available).

| Error | HTTP | Extra properties |
|---|---|---|
| `TurboSMTPError` | — | base class; `status`, `raw` |
| `AuthenticationError` | 401 | `errorCode?`, `details?` |
| `BadRequestError` | 400 | `errors?: string[]` |
| `ValidationError` | 400 | subclass of `BadRequestError` |
| `ForbiddenError` | 403 | — |
| `NotFoundError` | 404 | — |
| `RateLimitError` | 429 | `retryAfter?` (seconds) |
| `ApiError` | other / 5xx | — |
| `NetworkError` | transport | `status` is `null` |

```typescript
import {
  TurboSMTPClient,
  AuthenticationError,
  BadRequestError,
  NetworkError,
} from '@turbosmtp/sdk';

try {
  await client.mail.send({ from: 'you@yourdomain.com', to: ['recipient@example.com'], text: 'Hi' });
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error('Check your credentials:', err.message, err.details);
  } else if (err instanceof BadRequestError) {
    console.error('The request was rejected:', err.errors);
  } else if (err instanceof NetworkError) {
    console.error('Could not reach TurboSMTP:', err.message);
  } else {
    throw err;
  }
}
```

---

## Custom transport & testing

The `fetchApi` option lets you inject any `fetch`-compatible function — useful for a custom transport,
or for testing without hitting the network. Pass a fake that returns a canned `Response` and assert on
the request it received:

```typescript
const client = new TurboSMTPClient({
  consumerKey: 'test',
  consumerSecret: 'test',
  fetchApi: async (url, init) => {
    // inspect `url` / `init`, then return a scripted response
    return new Response('{"message":"OK","mid":123}', { status: 200 });
  },
});
```

This is the same seam the SDK's own conformance tests use. See
[ADR-0001](../../docs/adr/0001-nodejs-dependency-injection-strategy.md) for the design rationale.

---

## Examples

Runnable programs for every scenario live in [`examples/`](./examples) — one copy in TypeScript
(`examples/ts/`) and one in JavaScript (`examples/js/`), covering minimal sends, HTML, multiple
recipients, attachments, EU-region routing, and error handling. See
[`examples/README.md`](./examples/README.md) for how to run them.

---

## Next steps

- **Developer Hub & guides:** <https://serversmtp.com/email-sdks-for-developers>
- **Transactional email guide** — deliverability, headers, and webhooks.
- **API reference** — the full TurboSMTP API surface.

## License

MIT © TurboSMTP
