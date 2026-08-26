# SDK Registry

Official and community-maintained client libraries for the TurboSMTP API.

---

## Official SDKs

> **Status, 2026-08-11.** No TurboSMTP SDK is published to a package registry yet. The table below
> reports actual availability — earlier revisions of this page listed install commands for packages
> that do not exist. Planned package names are fixed in
> [`client-contract.md`](client-contract.md) §6 but are not installable until each SDK ships.

| Language | Status | Install | Guide |
|---|---|---|---|
| Node.js / TypeScript | Built, publish pending | *not yet published* — planned as `@turbosmtp/sdk` | [nodejs.md](nodejs.md) |
| Node.js webhook receiver | Built, publish pending | *not yet published* — planned as `@turbosmtp/webhook` | [packages/node-webhook](packages/node-webhook/README.md) |
| Python | Planned | *not yet published* | [python.md](python.md) |
| C# | Planned | *not yet published* — planned as `TurboSMTP` (NuGet) | [csharp.md](csharp.md) |
| Go | Planned | *not yet published* — planned as `github.com/turbosmtp/turbosmtp-go` | [go.md](go.md) |
| PHP | Planned | *not yet published* — planned as `turbosmtp/turbosmtp-client` | [php.md](php.md) |

The Go module path is **lower-case**. Go module paths are case-sensitive while GitHub URLs are not,
so `go get github.com/turboSMTP/…` against a lower-case `go.mod` fails with *"module declares its
path as X but was required as Y"*.

### Superseded SDKs

Three repositories previously carried the official label. None was ever published to a package
registry, and all three are superseded by the SDKs described above — see
[ADR-0006](docs/adr/0006-legacy-official-sdk-consolidation.md). They are deprecated per language as
each replacement ships, so they remain readable until then.

| Repository | Language | Note |
|---|---|---|
| [turboSMTP-csharp](https://github.com/turboSMTP/turboSMTP-csharp) | C# | Most complete of the three; source-only, never on NuGet |
| [turboSMTP-php](https://github.com/turboSMTP/turboSMTP-php) | PHP | Source-only, never on Packagist |
| [turboSMTP-python](https://github.com/turboSMTP/turboSMTP-python) | Python | Generator output only, no client layer |

---

## SDK Design Philosophy

All official TurboSMTP SDKs expose a **unified client surface** — one package per language for the
API itself, with each API domain as a namespace (`mail`, `validation`, …). There is no need to
install a separate library per API domain. Webhook receiving ships separately where a language
warrants it ([ADR-0007](docs/adr/0007-sdk-packaging-granularity.md) carve-out 2,
[ADR-0009](docs/adr/0009-webhook-receiver-package.md)), because the receiver runs in the process
that accepts callbacks rather than the one that sends mail. The surface every SDK must satisfy is
fixed in [`client-contract.md`](client-contract.md).

Minimal instantiation, as shipped in the Node.js SDK:

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
```

Authentication is a `consumerKey`/`consumerSecret` pair, not a single API key, and the SDK attaches
both headers for you. Namespaces ship in priority order — `mail` first, `validation` next — so
`client.validation` is not yet available in any SDK.

SDKs are built in three layers: a transport client generated from the
[OpenAPI 3.1 specification](../api-reference/README.md) by `openapi-generator-cli` (pinned in
[`openapitools.json`](openapitools.json)), a **hand-written facade** that provides the contracted
surface, and the conformance tests. No custom generator templates are used — ergonomics live in the
facade, not in the generated layer. See [`plan.md`](plan.md).

---

## Community SDKs

Have you built a TurboSMTP client for a language not listed here? Open a [Feature Request](../.github/ISSUE_TEMPLATE/feature_request.md) to register it.

---

## All SDKs require the OpenAPI 3.1 spec as the source of truth

If you find a discrepancy between an SDK's behavior and the spec, please open a [Bug Report](../.github/ISSUE_TEMPLATE/bug_report.md).
