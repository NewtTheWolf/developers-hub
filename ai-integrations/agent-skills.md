# TurboSMTP Agent Skills

Open-source SKILL.md packages that embed TurboSMTP deliverability expertise directly into AI agents — without bloating the context window.

---

## What are Agent Skills?

The **Agent Skills** open standard provides a lightweight, structured format for extending AI agent capabilities. Each skill is a directory containing:

- `SKILL.md` — YAML frontmatter (name, description, allowed tools) + Markdown instructions
- `scripts/` — Optional executable scripts
- `references/` — Optional reference documents
- `assets/` — Optional templates or data files

### Progressive Disclosure

AI agents load skills in three tiers:

| Tier | What is loaded | Token cost |
|---|---|---|
| Tier 1 | `name` + `description` from YAML frontmatter only | ~50–100 tokens per skill |
| Tier 2 | Full `SKILL.md` body — loaded when a prompt matches | Full skill content |
| Tier 3 | Files from `assets/` — loaded on demand by the skill | Per asset |

This ensures agents have access to deep domain expertise while keeping the context window optimized.

---

## Available Skills

### `deliverability-diagnostics`

```yaml
name: turbosmtp-deliverability
description: Analyze and remediate domain health and SMTP bounce codes.
```

Directs the AI to:
- Differentiate between 4xx deferrals (temporary) and 5xx hard bounces (permanent)
- Diagnose missing DMARC records, misaligned SPF, and failed DKIM signatures
- Use the [`audit_domain_authentication`](mcp-server.md) MCP tool to retrieve live DNS data
- Output specific DNS record values required to resolve deliverability failures

**Outcome:** The agent fetches metrics via MCP, identifies the root cause of inbox placement failures, and produces the exact DNS records needed to fix them.

---

### `list-hygiene`

```yaml
name: turbosmtp-list-hygiene
description: Sanitize contact databases and process email validations.
```

Directs the AI to:
- Ingest raw email lists (CSV or array input)
- Iteratively call the [`validate_contact_list`](mcp-server.md) MCP tool
- Apply strict rules by validation status:
  - `valid` → retain
  - `catch_all` → flag for manual review
  - `invalid` / `disposable` → remove
  - `spamtrap` / `abuse` → **remove immediately, never send**
- Output a mathematically sanitized list with a summary report

**Outcome:** The agent produces a clean mailing list protecting sender reputation, with zero manual intervention required.

---

## Installation

> The TurboSMTP Agent Skills library will be published as an open-source repository. Installation instructions will be available upon release.

```bash
# Planned
git clone https://github.com/turboSMTP/ai-agent-skills
```

---

## Using Skills with Claude Code

```bash
# Add a skill to your Claude Code project
# (instructions to be published upon release)
```

---

## Contributing a Skill

Have domain expertise to share? The Agent Skills library is open-source. See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on submitting a new skill.

---

## Related

- [MCP Server](mcp-server.md) — The execution layer that skills operate on top of
- [Email Validation](../docs/validation.md)
