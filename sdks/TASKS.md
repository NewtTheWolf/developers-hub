# TurboSMTP SDKs — Roadmap & Tasks

Scoped task list for the SDK effort. Strategy and rationale live in [`plan.md`](./plan.md); this file
is the executable checklist. It **refines and replaces Phase 3** ("SDK Modernization") of the
repo-level [`../TASKS.md`](../TASKS.md) — reconcile that file's 3.1–3.20 into this when adopted.

## Statuses
`DONE` `REVIEW` `WIP` `PENDING` `PAUSED` `BLOCKED`

## Fixed decisions (see `plan.md`)
- Tooling: **OpenAPI Generator** (free/OSS) + curated facade. Kiota is a free per-language fallback.
- Home: everything under `developers-hub/sdks/`.
- Packaging: **one unified package per language**; domains are namespaces (`mail`, `validation`, …).
- Rollout: priority-driven — **P0 Mail → P1 Validation → P2 → P3(maybe never)** — with a scope decision between tiers.

---

## Phase 0 — Planning & Contract
> Pure planning. No code until the contract is reviewed.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 0.1 | Author SDK strategy plan (`sdks/plan.md`) | DONE | 0.5 | Architecture, tooling, layout, rollout |
| 0.2 | Author language-agnostic client contract (`sdks/client-contract.md`) | DONE | 1 | Namespaces, method/param/return shapes, error taxonomy, auth/region, priority tiers. **Review gate passed — code unblocked.** Depends on 0.1 |
| 0.3 | Confirm P0/P1 domain coverage & namespace names | DONE | | Folded into 0.2 §6: namespaces `mail`/`validation`/`analytics`/`suppressions`/`subaccounts`/`account`; P3 (billing/alerts/meta) marked maybe-never; orphaned ops excluded |

---

## Phase 1 — Generation Pipeline (spike)
> Prove OpenAPI Generator handles our 3.1 multi-file spec before committing to it.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 1.1 | Pin generator version (`sdks/openapitools.json`) | DONE | | npm wrapper `@openapitools/openapi-generator-cli`; generator pinned to **7.24.0** (latest) |
| 1.2 | Bundle multi-file spec → `sdks/build/turbo-smtp.bundled.yaml` | DONE | | `npx @redocly/cli bundle` on `api-reference/turbo-smtp.yaml`. Output self-contained (0 external `$ref`s), OAS 3.1.0, lint-valid (2 warnings). `sdks/build/` git-ignored. Note: `unevaluatedProperties:false` present → 3.1 risk to verify in 1.3 |
| 1.3 | Spike generation on the 3.1 spec across all 5 languages | PENDING | 1 | Identify which languages break on 3.1-only constructs (`type:[x,"null"]`, `unevaluatedProperties`). Depends on 1.1–1.2 |
| 1.4 | Add 3.1→3.0.3 down-convert shim **(only if 1.3 requires)** | PENDING | | Generator input only; canonical spec stays 3.1. Conditional on 1.3 |
| 1.5 | Per-language + per-domain generator config (`sdks/config/<lang>.yaml`) | PENDING | | Domain-partitioned (filter by tag/operation) |
| 1.6 | Generation script (`sdks/scripts/`) — bundle → (downconvert?) → generate | PENDING | | Reproducible locally and in CI. Depends on 1.2–1.5 |

---

## Phase 2 — P0 Mail: Node/TS reference SDK
> Prove the full three-layer pipeline end-to-end on the highest-value feature.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 2.1 | Generate Layer 1 (Mail domain) → `sdks/packages/node/` | PENDING | | Transport + models. Depends on 1.6, 0.2 |
| 2.2 | Author Layer 2 facade — `client.mail.send` per contract | PENDING | 1 | Arrays for to/cc/bcc, `text`/`html`, `replyTo`, byte attachments, `messageId` as string, region/EU host, dual-auth hidden. Depends on 2.1, 0.2 |
| 2.3 | Layer 3 tests — P0 conformance scenarios | PENDING | | The 8 scenarios in contract §3.3. Depends on 2.2 |
| 2.4 | Examples + README quickstart (must compile/run) | PENDING | | Depends on 2.2 |
| 2.5 | Publish `@turbosmtp/sdk` to npm | PENDING | | Depends on 2.3–2.4 |

---

## Phase 3 — P0 Mail: remaining four languages
> Same pipeline and contract as the Node reference. Each: generate → facade → tests → publish.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| **Python** |
| 3.1 | Generate Layer 1 (Mail) → `packages/python/` | PENDING | | Depends on 1.6, 0.2 |
| 3.2 | Author Layer 2 facade (`client.mail.send`) | PENDING | | Depends on 3.1; mirror 2.2 |
| 3.3 | Tests (shared conformance matrix) + publish to PyPI (`turbosmtp`) | PENDING | | Depends on 3.2 |
| **C#** |
| 3.4 | Generate Layer 1 (Mail) → `packages/csharp/` | PENDING | | Kiota fallback candidate if openapi-generator underperforms. Depends on 1.6, 0.2 |
| 3.5 | Author Layer 2 facade (`client.Mail.SendAsync`) | PENDING | | Depends on 3.4 |
| 3.6 | Tests + publish to NuGet (`TurboSMTP`) | PENDING | | Depends on 3.5 |
| **Go** |
| 3.7 | Generate Layer 1 (Mail) → `packages/go/` | PENDING | | Depends on 1.6, 0.2 |
| 3.8 | Author Layer 2 facade (`client.Mail.Send`) | PENDING | | Depends on 3.7 |
| 3.9 | Tests + publish to pkg.go.dev | PENDING | | Depends on 3.8 |
| **PHP** |
| 3.10 | Generate Layer 1 (Mail) → `packages/php/` | PENDING | | Depends on 1.6, 0.2 |
| 3.11 | Author Layer 2 facade (`$client->mail->send`) | PENDING | | Depends on 3.10 |
| 3.12 | Tests + publish to Packagist (`turbosmtp/turbosmtp-client`) | PENDING | | Depends on 3.11 |

---

## Phase 4 — Shared infrastructure & CI
> Cross-cutting; can proceed alongside Phase 2–3.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 4.1 | Define shared conformance test matrix (spec-derived scenarios) | PENDING | | Single source for per-language tests; starts with contract §3.3 |
| 4.2 | Mock server harness (Prism) from the OpenAPI spec | PENDING | | Credential-free tests in CI |
| 4.3 | Gated live smoke tests (send) using stored `CONSUMER_KEY`/`CONSUMER_SECRET` | PENDING | | Rate-limited; opt-in in CI |
| 4.4 | Regeneration workflow `.github/workflows/generate-sdks.yml` | PENDING | | On spec change: bundle → generate → open PR with regenerated Layer 1. Depends on 1.6 |
| 4.5 | Spec-drift guard in CI (fail if committed Layer 1 is stale) | PENDING | | Depends on 4.4 |
| 4.6 | Per-language publish CI (npm/PyPI/NuGet/pkg.go.dev/Packagist on tag) | PENDING | | Depends on Phase 2–3 |

---

## Phase 5 — P1 Email Validation (scope gate before starting)
> Decide at the gate whether to proceed. Adds the `validation` namespace across all five.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 5.1 | Detail `validation` in the contract (methods, `validateList` composed helper) | PENDING | | Depends on P0 shipped |
| 5.2 | Add validation domain generation (all languages, domain-partitioned) | PENDING | | Additive regen. Depends on 5.1 |
| 5.3 | Author `client.validation` facade incl. `validateList` (upload→validate→poll→fetch) | PENDING | 1 | Composed helper lives only in Layer 2 |
| 5.4 | Tests (extend conformance matrix) + minor-version bump/publish all packages | PENDING | | Depends on 5.2–5.3 |

---

## Phase 6 — P2 Domains (later)
> Analytics, Suppressions, Subaccounts, Account. Each an additive namespace; schedule per demand.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 6.1 | `analytics` namespace (get + auto-pagination, getById, exportCsv) — all languages | PENDING | | Account status via P2 |
| 6.2 | `suppressions` namespace (list/iterate, filter, import, bulkDelete, exportCsv) | PENDING | | |
| 6.3 | `subaccounts` namespace (CRUD, status/limit, logo, agency) | PENDING | | |
| 6.4 | `account` namespace (authorize, consumer-key CRUD — API-Key-authed ops) | PENDING | | Introduces the API-Key auth path |

---

## Phase 7 — P3 Domains (maybe never)
> Implement only if justified.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 7.1 | `billing` namespace (buy validation credits) | PENDING | | Low priority; may be dropped |
| 7.2 | `alerts` namespace | PENDING | | Low priority |
| 7.3 | `meta` namespace (countries/states) | PENDING | | Low priority |

---

## Phase 8 — Documentation
> Update the developer-facing guides as each tier ships.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 8.1 | Rewrite `sdks/nodejs.md` against the real published package | PENDING | | After 2.5; fix aspirational install snippets |
| 8.2 | Rewrite `sdks/python.md`, `csharp.md`, `go.md`, `php.md` against real packages | PENDING | | After Phase 3 |
| 8.3 | Update `sdks/index.md` (registry) with real package names/versions per tier | PENDING | | Rolling, per tier |
