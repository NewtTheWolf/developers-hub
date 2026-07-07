# SDK Registry

Official and community-maintained client libraries for the TurboSMTP API.

---

## Official SDKs

| Language | Status | Install | Guide |
|---|---|---|---|
| C# | Stable | `dotnet add package TurboSMTP` | [csharp.md](csharp.md) |
| PHP | Stable | `composer require turbosmtp/turbosmtp-client` | [php.md](php.md) |
| Node.js / TypeScript | Planned | `npm install @turbosmtp/sdk` | [nodejs.md](nodejs.md) |
| Python | Planned | `pip install turbosmtp` | [python.md](python.md) |
| Go | Planned | `go get github.com/turboSMTP/turbosmtp-go` | [go.md](go.md) |

---

## SDK Design Philosophy

All official TurboSMTP SDKs expose a **unified client surface** — one package covers transactional email, email validation, and analytics. There is no need to install separate libraries per feature.

New SDKs (Node.js, Python, Go) target minimal instantiation:

```typescript
// Node.js example
import { TurboClient } from '@turbosmtp/sdk';

const turbo = new TurboClient(process.env.TURBO_API_KEY);

await turbo.mail.send({ from: '...', to: ['...'], subject: '...', html: '...' });
const result = await turbo.validation.verify('user@example.com');
```

All SDKs are generated from the [OpenAPI 3.1 specification](../api-reference/README.md) using `openapi-generator-cli v7.18.0` with custom fluent interface templates.

---

## Community SDKs

Have you built a TurboSMTP client for a language not listed here? Open a [Feature Request](../.github/ISSUE_TEMPLATE/feature_request.md) to register it.

---

## All SDKs require the OpenAPI 3.1 spec as the source of truth

If you find a discrepancy between an SDK's behavior and the spec, please open a [Bug Report](../.github/ISSUE_TEMPLATE/bug_report.md).
