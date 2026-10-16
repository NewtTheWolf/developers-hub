# TurboSMTP Developers Hub

The source for TurboSMTP's developer documentation and SDK packages — the specification the API
reference is built from, the topic guides, the client libraries, and the AI integration designs.

## Start using TurboSMTP

- **[Getting started](api-integrations/docs/getting-started.md)**: authentication and your first send.
- **[Interactive reference](https://turbosmtp.github.io/turbosmtp-swagger-ui/)**: a live "Try It"
  playground for every endpoint.
- **[Integration guides](api-integrations/README.md)**: the topic guide for each area of the API.
- **Client libraries**: [`@turbosmtp/mail`](sdk-integrations/packages/node-mail/README.md) and
  [`@turbosmtp/webhook`](sdk-integrations/webhooks/node-webhook/README.md), both Node.js and
  TypeScript.

---

**This repository serves no website and publishes nothing directly.** The API reference is built
from here and served from a separate read-only mirror, and each SDK package subtree is mirrored to
its own repository on release. Nothing here is a live artifact; everything here is what the live
artifacts are built from.

---

## What is here

| Tree | Holds |
|---|---|
| [`api-integrations/`](api-integrations/README.md) | The two halves the API reference is assembled from, and the hand-authored topic guides |
| `sdk-integrations/` | The SDK packages, the contract they satisfy, and the generation pipeline |
| `ai-integrations/` | The MCP Server and Agent Skills design documents |
| `.github/` | Workflows, composite actions, and the issue and pull-request templates |

Each area documents itself. [`api-integrations/README.md`](api-integrations/README.md) covers the
specification and the guides; every SDK package carries its own `README.md`, which is also what the
registry renders.

## What is not hand-authored

These trees are produced rather than written. An edit made in one of them is overwritten without
warning — change the source instead.

| Tree | Comes from |
|---|---|
| `api-integrations/upstream/` | Synced from the canonical specification repository |
| `api-integrations/swagger-ui/` | Vendored; it must stay byte-identical to what upstream ships |
| `src/generated/` in any SDK package | Generated from the specification |
| `sdk-integrations/build/` | Generated on demand, and never committed |

## Working on the SDK packages

Each package under `sdk-integrations/` carries its own `package.json` and is built and tested from
its own directory — this is not a workspace, and there is no root manifest. Continuous integration
gates every pull request.

[`sdk-integrations/semantic-layer.md`](sdk-integrations/semantic-layer.md) is the language-agnostic
contract every SDK must satisfy. Read it before changing a package's public surface.

## Reporting a problem

- A discrepancy between the specification and a live endpoint, a broken example, or an SDK error —
  open a [bug report](.github/ISSUE_TEMPLATE/bug_report.md).
- A client library, guide or integration you need — open a
  [feature request](.github/ISSUE_TEMPLATE/feature_request.md).

---

[TurboSMTP](https://serversmtp.com)
