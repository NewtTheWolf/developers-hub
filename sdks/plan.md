# SDK Generation Strategy for the TurboSMTP API

## Context

We have a finalized OpenAPI 3.1 spec (canonical in `turbo-smtp-openapi/`, synced into `developers-hub/api-reference/turbo-smtp.yaml`). We want client libraries in **five languages** — Node.js/TypeScript, Python, C#, Go, PHP — for external developers.

Goals and constraints:
- **Ease of use is the priority** — curated, idiomatic surface, not raw generated plumbing.
- **Features need not map 1:1 to endpoints** — composed convenience (auto-pagination, retries, orchestrated helpers, hidden dual-auth).
- **Consistency across all five languages** — one architecture. The existing C#/PHP/Python SDKs are rebuilt from scratch alongside the rest and then deprecated ([ADR-0006](docs/adr/0006-legacy-official-sdk-consolidation.md)).
- **Incremental, priority-driven rollout** — ship the most valuable features first, add the rest over time, and be free to never implement low-value ones.
- **Don't over-engineer**; keep the ability to **expand the API and re-derive SDKs** cheaply.

**Fixed decisions:**
1. **Tooling = OpenAPI Generator (free/OSS).** No paid generators — cost is a hard no.
2. **Development home = `developers-hub/sdks/`.** This repo is the single source for docs **and** SDK source **and** all developer material — one repo to commit to, one regeneration PR, one CI run that sees all five languages at once. There is no separate SDK *development* repo. **Publishing** goes through five CI-generated **read-only mirror repos** (`turbosmtp-node`, `-python`, `-dotnet`, `-go`, `-php`): mirrors are build output, not homes. The registries force this — public Packagist cannot read a `composer.json` from a subdirectory (subdirectory packages are paid Private Packagist only), and a Go module in a subdirectory bakes the repo path into its import path and requires prefixed version tags. Full record, including the rejected alternatives: **[ADR-0003](docs/adr/0003-sdk-repository-topology.md)**; implementation tracked as `TASKS.md` 4.7.
3. **Packaging = one unified package per language** (not separate feature packages). Feature domains are **namespaces within it** (`turbo.mail`, `turbo.validation`, …), shipped incrementally by priority. Internal organization is idiomatic per language. Re-derived from each ecosystem's own official guidance — all five answer "how do I offer modular access" with an *intra-package* mechanism, and none recommends splitting a single API client by domain — and ratified 2026-08-14 as **[ADR-0007](docs/adr/0007-sdk-packaging-granularity.md)**, which holds the evidence, one carve-out (webhook signature verification is not an API domain) and four flip triggers that would reopen it. Per-language divergence is permitted in principle and warranted nowhere today.
4. **Versioning = independent per language.** Each package versions on its own cadence (AWS/Google/Stripe model); there is no lockstep family version, so no language's release ever waits on another's readiness. Release tags in this repo are `<lang>/vX.Y.Z` (e.g. `node/v1.2.0`); the split workflow translates each to an **unprefixed** `vX.Y.Z` on its mirror, which is what pkg.go.dev and Packagist require. See [ADR-0003](docs/adr/0003-sdk-repository-topology.md).
5. **This repo is the SDK program's decision record** (decided 2026-08-11, **[ADR-0005](docs/adr/0005-sdk-program-authority.md)**). `plan.md` + `client-contract.md` + `docs/adr/` govern SDK strategy, contract and process. The parallel RFC track in the private `turboSMTP/developer-ecosystem` repo — whose SDK-strategy RFC sat open and unreviewed from 2026-07-04 — is **superseded for SDK matters** and will be deprecated; four ideas worth keeping (maintainer-gated ownership, Rust as a sixth language, adopt-vs-build for community clients, and the stale-official-SDK lesson) are recorded there as candidates, not adopted. **Out of scope:** `turboSMTP-js` and the `@turbosmtp` npm scope, which keep `TASKS.md` 2.5 blocked.
6. **The three legacy official SDKs are superseded, not modernized** (decided 2026-08-11, **[ADR-0006](docs/adr/0006-legacy-official-sdk-consolidation.md)**) — confirming point 3 of the goals above. `turboSMTP-csharp`, `turboSMTP-php` and `turboSMTP-python` satisfy no contract, sit outside this pipeline, were generated from a **SwaggerHub** spec rather than the canonical one, and were **never published to any registry**. Each is deprecated as this effort's replacement for that language publishes. Consequence with teeth: GitHub repo names are case-insensitive-unique, so the legacy `turboSMTP-python`/`turboSMTP-php` **occupy two of the mirror names** in point 2 and must be renamed before those mirrors can exist — archiving does not free a name.

## Approach: Generated Core + Curated Facade (free stack)

A **three-layer architecture per language**, kept deliberately thin, anchored by a **language-agnostic contract** for consistency.

### Layer 1 — Generated Core (transport + models + per-operation methods)
Produced by **OpenAPI Generator** from the spec; regenerated when the spec changes. Handles HTTP, (de)serialization, auth headers, models/types, multipart, pagination primitives. **Committed** to `sdks/packages/<lang>/`. Generation is **partitioned by domain** (see below).

### Layer 2 — Curated Convenience Facade (thin, hand/AI-authored)
The unified `TurboClient` developers touch — where **features diverge from endpoints 1:1**:
- Single-credential init; domain **namespaces** `.mail` / `.validation` / `.analytics` / `.suppressions` / `.subaccounts`.
- **Hide the dual-auth rules**: one credential object; the SDK routes `consumerKey`/`consumerSecret` vs `Authorization` per operation (e.g. `/mail/send` requires the former and rejects the latter — the developer never learns this).
- **Region/multi-server** as a constructor option (mirrors the old C# `SetRegion()`), including the EU override on `/mail/send`.
- **Composed helpers** orchestrating multiple endpoints, e.g. `validation.validateList(file)` = upload → validate → poll → fetch; bulk-suppression convenience wrappers.
- **Auto-pagination iterators** over the `{count, results}` + `page`/`limit` pattern.
- **Retries/backoff** and typed errors.

The facade is **strictly bounded by the contract** — no ad-hoc surface — and composed helpers are the only non-trivial logic. That is what keeps it from over-engineering.

### Layer 3 — Tests, examples, docs
Contract-conformance tests + a few idiomatic examples per language (AI-assisted), run in CI against a spec-derived mock server (and gated live smoke tests). Feeds the existing `sdks/*.md` guides.

### Keystone: the language-agnostic SDK contract
Before any language code, formalize **`sdks/client-contract.md`**: canonical namespaces, method names, parameter/return shapes, error taxonomy, composed-helper inventory, auth/region behavior — **and a priority tier per domain**. Every SDK must satisfy it. This is the cheapest guarantee of cross-language consistency, the reference for the shared test matrix, and the safeguard against OpenAPI Generator's five naming conventions drifting apart.

## Packaging & incremental rollout

**One unified package per language; domains are namespaces; ship by priority.** A developer always does a single install and gets a single `TurboClient`; capabilities grow version over version. Unused domains cost effectively nothing (JS tree-shaking, Go/Python selective import). This delivers the modular *experience* (feature grouping, priority rollout) without an N-package × 5-language release matrix — and it fits every language idiomatically, unlike bolt-on "extension" packages (which only work cleanly in C# and are impossible in Go).

Priority tiers (encoded in the contract; refine as we go):
- **P0 — Mail sending** (`/mail/send`). Ship first, end-to-end, as the reference SDK.
- **P1 — Email validation** (`/emailvalidation/*`), incl. the composed `validateList` helper.
- **P2 — Analytics, Suppressions, Subaccounts, Account/consumer-key & auth** (account status lives here).
- **P3 / maybe-never — Billing / credit purchase** (`/billing/*`), Alerts, Meta. Implement only if justified.

**Generation is partitioned by domain** (the upstream spec is multi-file; the generation script filters the bundle by tag — `scripts/generate.mjs --domain`). This makes adding a later tier a clean additive change and keeps a future package split cheap **on the code side** — the distribution side is gated by [ADR-0007](docs/adr/0007-sdk-packaging-granularity.md)'s flip triggers.

## Tooling: OpenAPI Generator, with a spec-preprocessing pipeline

The real risk with the free stack: **OpenAPI Generator's OpenAPI 3.1 support is still incomplete in 2026**, and our spec is 3.1-native (`type: [string,"null"]`, `unevaluatedProperties`, strict `additionalProperties`) and multi-file. Mitigate with a deterministic preprocessing step (canonical spec stays 3.1 for docs/Swagger UI):

1. **Bundle** the multi-file spec — `npx @redocly/cli bundle` (redocly already used for lint) → `sdks/build/turbo-smtp.bundled.yaml`.
2. **Spike 3.1 directly** on the latest OpenAPI Generator. If a language generator breaks on 3.1-only constructs, add a **3.1→3.0.3 down-convert** step (generator input only) and re-run. Add this shim only if the spike proves it necessary.
3. Generate per language + per domain with a pinned generator version (`sdks/openapitools.json`) and per-language config (`sdks/config/<lang>.yaml`).

**Free per-language fallback** if OpenAPI Generator can't produce usable core for one language: Microsoft **Kiota** (also free/OSS, stronger for C#/Go). Contingency, not the backbone.

## Repository layout (development: all inside `developers-hub`)

This repo shifts from docs-only to **docs + SDK source**; language toolchains and publish CI are added, scoped to `sdks/` so the Pages pipeline is unaffected. Existing `sdks/*.md` guides stay; source is isolated under `packages/`:

```
sdks/
  plan.md                     # this document
  client-contract.md          # keystone contract, incl. priority tiers
  index.md, nodejs.md, ...    # EXISTING guides — updated once packages are real
  openapitools.json           # pinned generator version
  config/<lang>.yaml          # per-language + per-domain generator config
  templates/<lang>/           # custom Mustache templates (only if needed for DX)
  build/                      # bundled/preprocessed spec (git-ignored)
  packages/
    node/  python/  csharp/  go/  php/   # Layer 1 (generated, domain-partitioned) + Layer 2 (facade) + Layer 3 (tests)
  scripts/                    # bundle + generate + downconvert-if-needed
```

Publishing fans out from here to five read-only mirrors (decision #2). Nothing is ever
committed to a mirror; each is a `git subtree split` of one package directory:

```
sdks/packages/{node,python,csharp,go,php}
      │  .github/workflows/split-mirrors.yml — one workflow, five targets
      ├──→ turbosmtp-node    (read-only) → npm       @turbosmtp/sdk
      ├──→ turbosmtp-python  (read-only) → PyPI      turbosmtp
      ├──→ turbosmtp-dotnet  (read-only) → NuGet     TurboSMTP
      ├──→ turbosmtp-go      (read-only) → pkg.go.dev
      └──→ turbosmtp-php     (read-only) → Packagist turbosmtp/turbosmtp-client
```

Note that the mirror **repository** name and the **package** name are independent: the PHP
mirror is `turbosmtp-php`, but its Packagist package keeps the contracted name
`turbosmtp/turbosmtp-client` (`client-contract.md` §6).

Because the mirror is canonical for consumers, Go's `go.mod` and PHP's `composer.json`
declare the **mirror's** identity rather than their in-repo location — `module
github.com/turbosmtp/turbosmtp-go` and `"name": "turbosmtp/turbosmtp-client"`. Go does not
require the main module's path to match its directory, so local builds and tests are
unaffected.

**Go module paths are case-sensitive**, so the declared path is lower-case per
`client-contract.md` §6. GitHub URLs are case-insensitive, but Go is not: if `go.mod`
declares `github.com/turbosmtp/…` and a user runs `go get github.com/turboSMTP/…`, the
build fails with *"module declares its path as X but was required as Y"*. Upper-case
letters also get `!`-escaped in proxy and module-cache paths (`turbo!s!m!t!p`). Any
published guide showing a mixed-case `go get` must be corrected before Go ships — see
`TASKS.md` 3.7.

- **Spec source for generation:** the in-repo `api-reference/turbo-smtp.yaml` (keeps `developers-hub` self-contained in CI). It continues to sync from `turbo-smtp-openapi/` per the existing CLAUDE.md step.
- **Regeneration:** a new `.github/workflows/generate-sdks.yml` runs bundle → generate on spec change and opens a PR with the regenerated Layer 1. Layer 2 facade is untouched by regen; only genuinely new domains/endpoints need facade additions.
- **Publishing:** per-language, triggered by a `<lang>/vX.Y.Z` tag. npm / PyPI / NuGet publish directly from this repo; `.github/workflows/split-mirrors.yml` pushes each package subtree to its read-only mirror and translates the tag to unprefixed `vX.Y.Z` — which is how pkg.go.dev and Packagist consume Go and PHP, and what gives every language a clean, discoverable public repo. Mirrors have Issues disabled and a read-only README banner, so all issues land here. (GitHub cannot disable pull requests — unsolicited ones are closed with a pointer back.)

## Execution phases (priority-driven, interactive)

1. **Save this plan** to `sdks/plan.md`. ✅
2. **Contract first** — author `sdks/client-contract.md` including priority tiers. Review before code.
3. **Preprocessing spike** — add `sdks/scripts` + `openapitools.json`; bundle the spec; confirm OpenAPI Generator handles our 3.1 constructs, adding the down-convert shim only if needed.
4. **P0 reference SDK — Node/TS, Mail only** — generate Layer 1 for the Mail domain into `packages/node/`; hand/AI-author Layer 2 `turbo.mail` to satisfy the contract; Layer 3 tests + examples; publish `@turbosmtp/sdk`. This proves the whole pipeline on the highest-value feature.
5. **P0 across the other four** — same pipeline, Mail domain, each conforming to the contract; reuse CI.
6. **Add domains by priority, interactively** — P1 validation next (incl. `validateList`), then P2, pausing between tiers so we decide what's worth shipping (P3 may be skipped). Each addition is an additive, domain-partitioned regen + facade extension across all five.
7. **Docs** — rewrite `sdks/*.md` guides against the real published packages as each tier lands (fixing today's aspirational install snippets).

## Verification

- **Contract conformance:** a shared test matrix (same scenarios per language) asserting each SDK exposes the contracted surface and behavior for the domains shipped so far.
- **Mock server** generated from the OpenAPI spec (e.g. Prism) in CI — no live credentials for the bulk of tests.
- **Live smoke tests** for a few real flows (send first; validate-email once P1 lands) against a sandbox using the stored `CONSUMER_KEY`/`CONSUMER_SECRET`, gated to avoid spamming.
- **Spec-drift guard:** CI re-runs bundle → generate and fails if committed Layer 1 is stale, so SDKs never silently lag the spec.
- **DX check:** each language's README quickstart must compile/run as-is (examples are tests).

## Risks & mitigations
- **OpenAPI Generator 3.1 gaps** → bundle + spike first; 3.1→3.0.3 down-convert shim only if needed; Kiota as free per-language fallback.
- **Thicker hand-written facade than paid tools would need** → bound the facade strictly by `client-contract.md`; composed helpers are the only non-trivial code; shared conformance matrix keeps all five aligned.
- **Namespace drift across languages / tiers** → the contract doc + shared test matrix are the single source of consistency.
- **Repo scope creep** (docs repo now carries build/publish CI) → isolate language toolchains under `sdks/packages/` and `sdks/`-scoped workflows.
- **Priority reversals** (a deferred domain becomes urgent) → domain-partitioned generation makes any tier an additive change; no reordering cost.
- **Composed helpers depend on endpoint chains** (e.g. validate-list polling) → live only in Layer 2, contract-specified, reviewed and tested deliberately.

## Sources
- [openapi-generator releases / 3.1 issue #9083](https://github.com/OpenAPITools/openapi-generator/issues/9083)
- [Microsoft Kiota](https://github.com/microsoft/kiota)
