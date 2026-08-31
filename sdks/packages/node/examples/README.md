# Examples

Runnable examples for `@turbosmtp/sdk`, one copy in each language:

- **`ts/`** — TypeScript. Type-checked in isolation with `npm run typecheck:examples`.
- **`js/`** — JavaScript (ESM). Run directly with `node` against the live API.

Each example maps to a conformance scenario in
[`client-contract.md`](../../../client-contract.md) §3.3:

| File | Scenario |
|---|---|
| `minimal-send` | §3.3.1 — plain-text send |
| `html-email` | §3.3.2 — HTML body |
| `multiple-recipients` | §3.3.3 / §3.3.4 — to/cc/bcc arrays + Reply-To |
| `attachments` | §3.3.5 — file attachment + embedded image |
| `eu-region` | §3.3.6 — EU-region routing |
| `error-handling` | §3.3.7 / §3.3.8 — 401 and 400 handled by type |

> **In-repo import paths.** These files import the SDK by relative path so they run
> before the package is published — `js/` from the built ESM bundle
> `../../dist/esm/index.mjs`, `ts/` from the source `../../src/index`. In your own
> project you'd instead write `import { TurboSMTPClient } from '@turbosmtp/sdk';`.
>
> The `js/` examples deliberately target the ESM build while the test suite targets
> the CJS build (`dist/cjs/index.js`), so both published artifacts get exercised.

---

## Prerequisites

- Node.js `>= 22`.
- Your TurboSMTP **Consumer Key** and **Consumer Secret**.
- A `from` address on a domain **authorized for your account** (otherwise the API
  returns `400`).

Set your credentials as environment variables (the examples also read optional
`EXAMPLE_FROM` / `EXAMPLE_TO`, comma-separated for multiple recipients):

**PowerShell (Windows):**

```powershell
$env:CONSUMER_KEY = "your-consumer-key"
$env:CONSUMER_SECRET = "your-consumer-secret"
$env:EXAMPLE_FROM = "you@yourdomain.com"
$env:EXAMPLE_TO = "recipient@example.com"
```

**bash / zsh:**

```bash
export CONSUMER_KEY="your-consumer-key"
export CONSUMER_SECRET="your-consumer-secret"
export EXAMPLE_FROM="you@yourdomain.com"
export EXAMPLE_TO="recipient@example.com"
```

---

## Run the JavaScript examples (live)

Build the package once so `dist/` exists, then run any example:

```bash
npm run build
node examples/js/minimal-send.mjs
node examples/js/html-email.mjs
node examples/js/multiple-recipients.mjs
node examples/js/attachments.mjs
node examples/js/eu-region.mjs
node examples/js/error-handling.mjs
```

The happy-path examples print a `messageId` (a string — see the note in the main
[README](../README.md#the-result)) and **send real email**. `error-handling` triggers a
401 and a 400 on purpose and prints the typed errors — it does not send mail.

> **These are live sends.** They use your real account and count against your sending
> quota. Send to an address you control.

---

## Type-check the TypeScript examples

```bash
npm run typecheck:examples
```

This runs `tsc --noEmit` over `ts/` against the real facade types — no credentials or
network required. It's a compile-time guarantee that every example matches the current API.
