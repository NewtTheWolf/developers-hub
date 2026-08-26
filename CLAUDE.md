# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**TurboSMTP Developers Hub** — the public-facing documentation portal for the TurboSMTP API.

Content is authored in Markdown and published via GitHub Pages. This is a docs-as-code repository: the documentation needs no local build step, and CI validates and deploys it automatically on push to `main`. The SDK packages under `sdks/` are the exception; they build, lint and test like any code (see **SDK Development**).

## Repository Structure

- **`docs/`** — Topic guides (getting-started, transactional, validation, webhooks)
- **`api-reference/`** — single pre-bundled OpenAPI 3.1 spec (`turbo-smtp.yaml`, no `Domains/` split) + self-contained Swagger UI bundle (deployed to GitHub Pages) + narrative `README.md` overview
- **`sdks/`** — SDK effort: strategy/contract/tasks docs, generator config, and (incrementally) generated + facade source per language. See **SDK Development** below
- **`ai-integrations/`** — MCP Server and Agent Skills documentation
- **`.github/`** — GitHub Actions workflows and PR/issue templates
  - `workflows/validate-openapi.yml` — Lints OpenAPI spec on push
  - `workflows/deploy-swagger-ui.yml` — Deploys to GitHub Pages
  - `workflows/sdks-ci.yml` — Lint, typecheck, build and test `sdks/` on pull requests and `main` (ADR-0011)
  - `workflows/split-mirrors.yml` — On a `<package>/vX.Y.Z` tag, pushes that package's subtree to its read-only mirror (ADR-0003, ADR-0009)

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
- `sdks/pipeline.md` — operational flow (mermaid): canonical spec → sync → generate →
  facade → tests → tag → registries + mirrors; includes what is automated vs manual
- `sdks/docs/adr/` — Architecture Decision Records; ADR-0003 fixes the repo/publish
  topology, ADR-0004 the build-toolchain version policy

Tooling & generation:
- Generator: OpenAPI Generator, pinned in `sdks/openapitools.json` (currently
  7.24.0) via the npm wrapper `@openapitools/openapi-generator-cli`. Requires a
  JVM (Java 17 verified).
- Input is the **bundled** 3.1 spec `sdks/build/turbo-smtp.bundled.yaml`, produced
  by `redocly bundle` at the exact version pinned in `sdks/scripts/generate.mjs`
  (currently `@redocly/cli@2.47.0`). Fed to the generator **as 3.1 — no down-convert
  needed** (all 5 languages handle it natively).
- `sdks/build/` is git-ignored (regenerated artifacts). Never hand-edit generated
  Layer 1 code — change the spec upstream and regenerate.
- Gotcha: the generator's default `skipFormModel=true` drops multipart upload
  request models — verify multipart when configuring the validation/suppressions/
  subaccount domains.

Lint and format (ADR-0010):
- Biome is the formatter and linter for `sdks/**`, configured in the root `biome.json`
  and **pinned to the exact version its `$schema` names** (currently 2.5.4). Generated
  Layer 1 and `dist/` are excluded. `sdks-ci.yml` runs `biome ci sdks` as a merge gate,
  so run `npx --yes @biomejs/biome@2.5.4 check --write sdks` before opening a pull request
  or it goes red on formatting.
- Per package: `npm run typecheck`, `npm test` (builds first), and `npm run
  typecheck:examples` in `sdks/packages/node` — the same steps CI runs.
- Both packages declare `engines: { "node": ">=22" }`; CI tests the floor and the active
  LTS (ADR-0011).

## Documentation Standards

- All content is Markdown. Follow the existing folder structure under `docs/`.
- Code examples must be tested and use realistic values (no placeholder tokens in final form).
- API examples must align with the OpenAPI spec in `../turbo-smtp-openapi/`.
- Adhere to the PR template in `.github/pull_request_template.md`.

## Workflow Rules

- **Never commit or push** unless the user explicitly asks for it.
- **Branch naming:** Use `fix/<description>` for bug corrections, `feat/<description>` for new content additions.
- **PR process:** All changes go through a pull request against `main`. Use the GitHub PR template.
