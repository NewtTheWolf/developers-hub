# TurboSMTP MCP Server

Connect any MCP-compatible AI agent — Claude, Cursor, OpenCode, and others — to TurboSMTP with zero custom integration code.

---

## What is MCP?

The **Model Context Protocol (MCP)**, open-sourced by Anthropic, is a universal interface that allows AI agents to securely interact with external tools and data sources. It eliminates the need to write bespoke integration code for every AI platform.

Architecture:

| Role | Description |
|---|---|
| **MCP Host** | The AI application (e.g., Claude Desktop, Cursor) |
| **MCP Client** | Protocol handler inside the host |
| **MCP Server** | The TurboSMTP program exposing capabilities to the AI |
| **Transport** | JSON-RPC 2.0 via stdio (local) or HTTP+SSE (remote) |

---

## Installation

> The TurboSMTP MCP Server is currently in development. Installation instructions will be published here upon release.

```bash
# Planned — Node.js / TypeScript implementation
npx @turbosmtp/mcp-server
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TURBOSMTP_API_KEY` | Yes | Your TurboSMTP API key |
| `TURBOSMTP_READ_ONLY` | No | Set to `true` to disable all mutating tools |

---

## Available Tools

The MCP Server exposes the following tools to AI agents:

### `send_transactional_email`
Dispatch a transactional email message.

| Parameter | Type | Required |
|---|---|---|
| `to` | string[] | Yes |
| `from` | string | Yes |
| `subject` | string | Yes |
| `html_body` | string | Yes |
| `idempotency_key` | string | Yes |

### `fetch_delivery_metrics`
Retrieve delivery performance data for analysis.

| Parameter | Type | Required |
|---|---|---|
| `start_date` | string (ISO-8601) | Yes |
| `end_date` | string (ISO-8601) | Yes |
| `status` | enum: `delivered`, `bounced`, `dropped` | No |

### `validate_contact_list`
Sanitize an array of email addresses through the TurboSMTP Validator.

| Parameter | Type | Required |
|---|---|---|
| `email_addresses` | string[] | Yes |

### `audit_domain_authentication`
Verify SPF, DKIM, and DMARC configuration for a domain.

| Parameter | Type | Required |
|---|---|---|
| `domain_name` | string | Yes |

---

## Security

### Read-Only Mode
Set `TURBOSMTP_READ_ONLY=true` to disable `send_transactional_email` while preserving analytical tools. Recommended for monitoring and diagnostic agents.

### Idempotency
Every call to `send_transactional_email` requires a unique `idempotency_key`. If the TurboSMTP API receives a duplicate key, it returns the cached response instead of dispatching a duplicate message — preventing accidental spam from AI retry loops.

---

## Example Agent Workflow

With the MCP server running, an AI agent can execute natural language commands like:

> "Analyze my bounce logs from yesterday. Extract all emails that triggered a 5xx hard bounce, validate them through the TurboSMTP validator, and report back with the sanitized list."

The agent translates this into sequential `fetch_delivery_metrics` → `validate_contact_list` API calls with no custom code required.

---

## Related

- [Agent Skills](agent-skills.md) — Domain expertise packages for AI agents
- [Email Validation](../docs/validation.md)
- [Transactional Email](../docs/transactional.md)
