# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**TurboSMTP Developers Hub** — the public-facing documentation portal for the TurboSMTP API.

Content is authored in Markdown and published via GitHub Pages. This is a docs-as-code repository: there is no build step required locally; CI validates and deploys automatically on push to `main`.

## Repository Structure

- **`docs/`** — Topic guides (getting-started, transactional, validation, webhooks)
- **`api-reference/`** — single pre-bundled OpenAPI 3.1 spec (`turbo-smtp.yaml`, no `Domains/` split) + self-contained Swagger UI bundle (deployed to GitHub Pages) + narrative `README.md` overview
- **`sdks/`** — SDK effort: strategy/contract/tasks docs, generator config, and (incrementally) generated + facade source per language. See **SDK Development** below
- **`ai-integrations/`** — MCP Server and Agent Skills documentation
- **`.github/`** — GitHub Actions workflows and PR/issue templates
  - `workflows/validate-openapi.yml` — Lints OpenAPI spec on push
  - `workflows/deploy-swagger-ui.yml` — Deploys to GitHub Pages

## Relationship to `turbo-smtp-openapi/`

The canonical **OpenAPI v2 specification** lives in the sibling repository `../turbo-smtp-openapi/`.

The spec is published here at `api-reference/turbo-smtp.yaml`, synced from the sibling repo via the "API Documentation Sync" step below. Rules:
- Do not hand-edit the spec in `api-reference/` — it is a synced copy; make spec changes upstream in `turbo-smtp-openapi/` and re-sync
- Treat the sibling repo as the source of truth
- If spec examples are needed elsewhere in the docs, link to the synced spec or the sibling repo

## API Documentation Sync

The `api-reference/` folder contains a Swagger UI deployment that mirrors `../turbo-smtp-openapi/turbo-api-2/`.

`turbo-api-2/` now serves a **single pre-bundled** `turbo-smtp.yaml` (produced upstream by `redocly bundle` from the multi-file source in `openapi-definitions/`) — there is no `Domains/` folder in the served copies. Serving one file with only internal `$ref`s makes Swagger UI load with a single request instead of fetching ~10 files, which is the main render-speed win.

Whenever the served spec or Swagger UI assets are updated in `turbo-api-2/`, sync the changes to `api-reference/`:

1. Verify the bundled spec is valid: `npx @redocly/cli lint ../turbo-smtp-openapi/turbo-api-2/turbo-smtp.yaml`
2. Copy updated files: `Copy-Item -Path "../turbo-smtp-openapi/turbo-api-2/*" -Destination "./api-reference/" -Recurse -Force` (ensure `api-reference/` has no stale `Domains/` folder)
3. Commit and push: `git add api-reference/; git commit -m "sync: update API docs from turbo-api-2"`

> `api-reference/turbo-smtp.yaml` is a generated bundle — never hand-edit it. Edit the multi-file source in `../turbo-smtp-openapi/openapi-definitions/` and re-bundle.

## SDK Development (`sdks/`)

The SDK effort lives entirely under `sdks/`. Authoritative docs (read first):
- `sdks/plan.md` — strategy, 3-layer architecture, tooling, rollout tiers
- `sdks/client-contract.md` — RATIFIED language-agnostic contract; the facade
  surface every SDK must satisfy (review-gated; amend before changing any SDK)
- `sdks/TASKS.md` — executable checklist and per-task outcomes

Tooling & generation:
- Generator: OpenAPI Generator, pinned in `sdks/openapitools.json` (currently
  7.24.0) via the npm wrapper `@openapitools/openapi-generator-cli`. Requires a
  JVM (Java 17 verified).
- Input is the **bundled** 3.1 spec `sdks/build/turbo-smtp.bundled.yaml`, produced
  by `npx @redocly/cli bundle api-reference/turbo-smtp.yaml`. Fed to the generator
  **as 3.1 — no down-convert needed** (all 5 languages handle it natively).
- `sdks/build/` is git-ignored (regenerated artifacts). Never hand-edit generated
  Layer 1 code — change the spec upstream and regenerate.
- Gotcha: the generator's default `skipFormModel=true` drops multipart upload
  request models — verify multipart when configuring the validation/suppressions/
  subaccount domains.

## Documentation Standards

- All content is Markdown. Follow the existing folder structure under `docs/`.
- Code examples must be tested and use realistic values (no placeholder tokens in final form).
- API examples must align with the OpenAPI spec in `../turbo-smtp-openapi/`.
- Adhere to the PR template in `.github/pull_request_template.md`.

## Workflow Rules

- **Never commit or push** unless the user explicitly asks for it.
- **Branch naming:** Use `fix/<description>` for bug corrections, `feat/<description>` for new content additions.
- **PR process:** All changes go through a pull request against `main`. Use the GitHub PR template.
