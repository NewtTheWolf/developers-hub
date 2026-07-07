# TurboSMTP Developers Hub

Welcome to the official TurboSMTP developer portal. This repository is the single source of truth for integrating with TurboSMTP's transactional email, email validation, and AI-native tooling.

---

## Navigate the Hub

| Section | Description |
|---|---|
| [Getting Started](docs/getting-started.md) | Authentication, API Keys, Consumer Keys, base URLs, and your first send |
| [Transactional Email](docs/transactional.md) | Send email via `/mail/send` — attachments, embedded images, custom headers |
| [Analytics](docs/analytics.md) | Per-message delivery events, status lifecycle, and CSV export |
| [Suppressions](docs/suppressions.md) | Query, import, export, and delete suppressed addresses |
| [Email Validation](docs/validation.md) | Real-time single-address validation and bulk list workflows |
| [Webhooks](docs/webhooks.md) | Real-time delivery and engagement event payloads |
| [Account Management](docs/account.md) | Consumer keys, passwords, usage alerts, credits, reference data |
| [Subaccounts](docs/subaccounts.md) | Multi-tenant client management for agency plans |
| [SDKs](sdks/index.md) | Official client libraries for all supported languages |
| [API Reference](api-reference/README.md) | OpenAPI 3.1 spec overview + [live interactive Swagger UI](https://turbosmtp.github.io/developers-hub/) |
| [AI Integrations](ai-integrations/mcp-server.md) | MCP Server and Agent Skills for AI-native workflows |

---

## Quick Start

```bash
# Send your first email using curl
curl -X POST https://api.turbo-smtp.com/api/v2/mail/send \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "you@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from TurboSMTP",
    "content": "It works!",
    "html_content": "<h1>It works!</h1>"
  }'
```

See [Getting Started](docs/getting-started.md) for full authentication details.

---

## SDKs

| Language | Status | Install |
|---|---|---|
| [C#](sdks/csharp.md) | Planned | `dotnet add package TurboSMTP` |
| [PHP](sdks/php.md) | Planned | `composer require turbosmtp/turbosmtp-client` |
| [Node.js / TypeScript](sdks/nodejs.md) | Planned | `npm install @turbosmtp/sdk` |
| [Python](sdks/python.md) | Planned | `pip install turbosmtp` |
| [Go](sdks/go.md) | Planned | `go get github.com/turboSMTP/turbosmtp-go` |

---

## AI Integrations

TurboSMTP is an AI-native platform. Integrate directly into your AI workflows:

- **[MCP Server](ai-integrations/mcp-server.md)** — Connect any MCP-compatible AI agent (Claude, Cursor, etc.) to TurboSMTP with zero custom integration code.
- **[Agent Skills](ai-integrations/agent-skills.md)** — Open-source SKILL.md packages that embed TurboSMTP deliverability expertise into your AI agents.

---

## Contributing

We welcome contributions to documentation, SDKs, and AI integrations. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Resources

- [API Reference](api-reference/README.md) — narrative overview of the API surface
- [Interactive API Reference (Swagger UI)](https://turbosmtp.github.io/developers-hub/) — live "Try It" playground for every endpoint
- [TurboSMTP Website](https://turbo-smtp.com)
