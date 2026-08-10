# TurboSMTP SDKs — Roadmap & Tasks

Scoped task list for the SDK effort. Strategy and rationale live in [`plan.md`](./plan.md); this file
is the executable checklist. It **refines and replaces Phase 3** ("SDK Modernization") of the
repo-level [`../TASKS.md`](../TASKS.md) — reconcile that file's 3.1–3.20 into this when adopted.

## Statuses
`DONE` `REVIEW` `WIP` `PENDING` `PAUSED` `BLOCKED`

## Fixed decisions (see `plan.md`)
- Tooling: **OpenAPI Generator** (free/OSS) + curated facade. Kiota is a free per-language fallback.
- Development home: everything under `developers-hub/sdks/` — one repo anyone commits to.
- Publish topology (decided 2026-08-05, **[ADR-0003](docs/adr/0003-sdk-repository-topology.md)**): five CI-generated **read-only mirror repos** (`turbosmtp-node`/`-python`/`-dotnet`/`-go`/`-php`). Forced by public Packagist (no subdirectory `composer.json` outside the paid tier) and Go (subdirectory modules bake the repo path into the import path + need prefixed tags). Rejected full polyrepo: it costs 6 PRs / 5 CI runs per spec change and no single run would see all five facades. Recorded as **[ADR-0003](docs/adr/0003-sdk-repository-topology.md)**; implemented by 4.7.
- Versioning: **independent per language** — no lockstep family version. Tags are `<lang>/vX.Y.Z` here, translated to unprefixed `vX.Y.Z` on each mirror.
- Build toolchains (**[ADR-0004](docs/adr/0004-build-toolchain-version-policy.md)**): pin patch-only (`~`, never `^`) at the exact validated version; each package declares a minimum supported *consumer* toolchain, and every compiler bump is gated on the consumer-floor check (build → pack the real artifact → install into a scratch consumer → exercise every documented consumption path at the floor). Applies to all five languages — read before setting up 3.1/3.4/3.7/3.10.
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
| 1.3 | Spike generation on the 3.1 spec across all 5 languages | DONE | 1 | **All 5 pass with generator 7.24.0 (Java 17).** `type:[x,"null"]`→ TS `string\|null`, Go `NullableString`, Python `Optional`; `unevaluatedProperties` generated cleanly everywhere. C#/Go both fine → **Kiota fallback not needed**. Flavors spiked: `typescript-fetch`/`python`/`csharp`/`go`/`php`. Caveat: default `skipFormModel` drops multipart upload models (revisit in 1.5 for P1 upload / P2 import). "3.1 beta" banner only |
| 1.4 | Add 3.1→3.0.3 down-convert shim **(only if 1.3 requires)** | DONE | | **Not required** — 1.3 proved native 3.1 support across all 5 generators. No shim added; canonical spec stays 3.1. Revisit only if a future spec construct breaks a generator |
| 1.5 | Per-language + per-domain generator config (`sdks/config/<lang>.yaml`) | DONE | | 5 configs + `config/README.md`. Flavors: `typescript-fetch`/`python`(pydantic v2)/`csharp`(httpclient,net8.0)/`go`/`php`. Layer 1 → internal namespace (`turbosmtp._generated`, `TurboSMTP.Generated`, etc.); facade owns packaging. All 5 validated (options honored). Domain filter kept **out** of configs (domain-agnostic, reused per tier) → applied per-run by 1.6 script via spec pre-filter. `skipFormModel` left default (OK for P0; flip for P1/P2 multipart) |
| 1.6 | Generation script (`sdks/scripts/`) — bundle → (downconvert?) → generate | DONE | | `scripts/generate.mjs` (Node ESM, cross-platform). Pipeline: bundle → filter-in by tag + `--remove-unused-components` → generate per lang. Params `--domain`/`--lang`/`--out-root`/`--tags`. Verified end-to-end: mail domain, all 5 langs → clean mail-scoped Layer 1, zero cross-domain leakage. No down-convert. Note: node emits full package layout (package.json/tsconfig) → skip project files at 2.1 scaffolding |

---

## Phase 2 — P0 Mail: Node/TS reference SDK
> Prove the full three-layer pipeline end-to-end on the highest-value feature.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 2.1 | Generate Layer 1 (Mail domain) → `sdks/packages/node/` | DONE | | Ran `generate.mjs --lang=node` → Layer 1 in `packages/node/src/generated/`: `MailApi.sendEmail` (`POST /mail/send`), models `MailMessage`/`Attachment`/`Send{Sucess,BadRequest,Unauthorized}ResponseBody`, `runtime.ts`. Type-checks clean (tsc strict, es2018+dom). `/mail/send` is **JSON** (attachments = array of base64 `Attachment` objects) → `skipFormModel` gotcha N/A for P0. All 3 auth headers wired (facade hides dual-auth). Generator emitted a nested package layout (`package.json`/`tsconfig*`) in `src/generated/` — ignore; facade owns packaging at 2.2. Facade must map contract shape: `to`/`cc`/`bcc` arrays→comma-strings, `text`→`content`, `html`→`html_content`. **Send-body schema renamed upstream `Email`→`MailMessage`** (was bundling as the collision artifact `Email2`; fixed in `turbo-smtp-openapi` Mail.yaml — wire contract unchanged, proven by normalized bundle diff) |
| 2.2 | Author Layer 2 facade — `client.mail.send` per contract | DONE | 1 | Facade in `packages/node/src/` (`client.ts`/`mail.ts`/`errors.ts`/`index.ts`): `TurboSMTPClient({consumerKey,consumerSecret,region,fetchApi})` → `client.mail.send(SendMessage)` → `SendResult{messageId,raw}`. §4.2 mapping (arrays→CSV, text→content, html→html_content, replyTo→`custom_headers["reply-to"]`, bytes→base64 via dep-free encoder, attachment field renames). Auth hidden: creds sent as default `headers`, `apiKey` left unset so **`Authorization` never sent**. Region→send host. Typed error hierarchy (§3.4) mapped from L1 `ResponseError`/`FetchError`. **`messageId` reads exact `mid` digits from raw response text** — L1 types `mid` as JS `number`, so `JSON.parse` rounds >2^53; regex-extract preserves 64-bit precision (Phase 3 SDKs must mirror this). Packaging: hand-written root `package.json`/`tsconfig.json`; pruned generator's nested project files from `src/generated/` + added `.openapi-generator-ignore` so regen won't re-emit them (Layer 1 = source-only). Full package type-checks (tsc strict); all 8 §3.3 scenarios pass a fetch-injection smoke run. Depends on 2.1, 0.2 |
| 2.3 | Layer 3 tests — P0 conformance scenarios | DONE | | `packages/node/test/` — `node:test` suite (zero deps; Node ≥18). All **8 §3.3 scenarios** + 4 extras (replyTo-precedence, attachment-without-contentId, missing-creds config error, transport→NetworkError) + **5 packaging tests** (`test/packaging.test.mjs`, added 2026-08-05) → **17/17 green**. The packaging tests assert **both** published artifacts against an explicit `CONTRACTED_EXPORTS` list and then against each other — comparing only the two would pass if a symbol vanished from both. They exist because the scenario suite drives only the CJS build while the ESM build's only other exercise (`examples/js`) needs live credentials and never runs in CI; without them the ESM artifact would ship unexercised by anything automated. Mutation-verified: injecting a stray export into `dist/esm` fails exactly the surface and divergence tests. Drives the facade through the injected `fetchApi` seam (credential-free, offline; asserts serialized wire body + host + typed error mapping). Scripts: `pretest`=build, `test`=`node --test test/*.test.mjs` (Node-native glob, cross-platform). Prism mock (4.2) will layer on the same scenarios. Depends on 2.2 |
| 2.4 | Examples + README quickstart (must compile/run) | DONE | | Package `README.md` (npm-shipped) + `examples/` with **6 scenarios × 2 languages** (`examples/ts/` type-checked, `examples/js/` runnable) covering all 8 §3.3 flows. TS compile-verified via new `typecheck:examples` script (isolated `examples/tsconfig.json` + `ts/_env.d.ts` process shim → **no `@types/node` pulled into the SDK build**; bytes via web-standard `TextEncoder`/`atob`). JS `.mjs` **live-verified against the real API** (test creds, self-send): all 6 green — minimal/html/multi-recipient+replyTo/attachments/eu-region return real `messageId`s; error-handling maps real 401 "Wrong credentials"/400 "missing recipients (to)" to typed errors. `npm test` still 12/12; `npm pack` excludes `examples/` and ships README (44 kB, 0 examples entries). **Zero new runtime deps.** Import duality (relative in-repo `../../src`/`../../dist` vs `@turbosmtp/sdk` in prose) is a pre-publish accommodation. Portal `nodejs.md`/`index.md` rewrite deferred to 8.1 (out of scope). Depends on 2.2 |
| 2.5 | Publish `@turbosmtp/sdk` to npm | BLOCKED | | 🚩 **BLOCKED 2026-08-06 — the `@turbosmtp` npm scope is already in use by a parallel SDK effort inside this org.** Discovered while checking scope availability. Evidence: `@turbosmtp/mail` 0.1.0 and `@turbosmtp/webhook` 0.1.0, both published **2026-08-05 14:52Z**, maintainers `newtthewolf <dominik@spitzli.dev>` and `debba <andrea@debbaweb.it>`. Source repo **`github.com/turboSMTP/turboSMTP-js`** — public, inside the turboSMTP org, created 2026-07-18, last pushed 2026-08-05, self-described *"Official TypeScript/JavaScript SDK for TurboSMTP … Zero-dependency, dual ESM/CJS"*, structured as a monorepo with release-please. **This is not a squatter.** Consequences: (i) npm scopes belong to exactly one user/org, and we are not maintainers, so `@turbosmtp/sdk` cannot be published without being added; (ii) it contradicts three ratified decisions — `plan.md` #3 (**one unified package per language**, vs their per-domain `@turbosmtp/mail` + `@turbosmtp/webhook`), `client-contract.md` §6 (npm name `@turbosmtp/sdk`), and ADR-0003 (monorepo + mirrors, vs their separate repo); (iii) even with scope access, publishing would ship a *second* "official" Node SDK. **This is an organizational question, not a technical one** — resolve before any further Node publish work: is `turboSMTP-js` sanctioned and by whom; does the five-language effort supersede, absorb, or coexist with it; and who controls the npm scope (an npm org, or one of those personal accounts)? Note the maintainers independently chose zero-dependency + dual ESM/CJS, i.e. the same technical conclusions. Also: no npmjs.com account exists for this user yet. **Everything below remains valid and unaffected** — as does all non-npm work (Layer 1/2/3, mirrors, the other four languages). — **All 5 `package.json` blockers resolved (decided 2026-08-05).** Remaining before publish: (a) create the `turbosmtp-node` mirror + `MIRROR_TOKEN` and prove 4.7 against it; (b) confirm the version number — still **`0.1.0`**, deliberately pre-1.0 while 4 of 5 languages are unbuilt and the contract is proven against only one; (c) the `npm publish` run itself (npm org access + 2FA; outward-facing, user-executed); (d) **add a Node entry to `https://serversmtp.com/email-sdks-for-developers`** — verified live 2026-08-05 but it showcases only C# and PHP, so on publish it becomes the advertised `homepage` of a package it doesn't mention. Marketing-site edit, outside this repo. Decisions: (1) **superseded 2026-08-05 by the mirrored-publishing topology (ADR-0003)** — `repository.url` now points at the mirror `git+https://github.com/turboSMTP/turbosmtp-node.git` with **no `directory`** (the mirror has the package at its root); `bugs.url` deliberately stays on `developers-hub/issues` because mirrors are read-only, so issues must land where they can be acted on; (2) `publishConfig.access:"public"` added — the hard blocker for scoped packages; (3) **dual ESM+CJS** via `exports` map (`types`/`import`/`require` + `./package.json`), plus `module`, `sideEffects:false`; (4) `files` negation replaced with an explicit allowlist `["dist","src/*.ts","src/generated/src"]` — also drops 9 generator-emitted `src/generated/docs/*.md` + `.openapi-generator*` metadata from the tarball (83→74 files, 60.7 kB); (5) `license:MIT` confirmed. **Build is now two-step:** `build:cjs`=`tsc`→`dist/cjs` (js+d.ts+maps), `build:esm`=esbuild bundle→`dist/esm/index.mjs`, behind `clean`. Both tsconfigs use **`module`/`moduleResolution: node16`, not the deprecated node10 (`"node"`)** — node10 hard-errors in TS 7; `"type":"commonjs"` means emit is unchanged. Don't revert to `"node"`. Compiler pinned **`typescript: ~7.0.2` — tilde, not caret**, per **[ADR-0004](docs/adr/0004-build-toolchain-version-policy.md)**: TS does not follow semver (5.5/5.6/5.7 each shipped documented breaks), so minors must be a deliberate upgrade; `package-lock.json` covers reproducibility, the range only governs `npm update`. Consumer-compat verified after the bump: the published `.d.ts` type-checks under **TS 5.4** via both the `exports` map (`moduleResolution: node16`) and the `main`/`types` fallback (node10), so older consumers are unaffected by building on 7. **Why bundle the ESM build:** generated Layer 1 uses extensionless relative imports (`'../runtime'`) which Node's ESM resolver rejects; adding `.js` extensions would mean hand-editing Layer 1, so esbuild (**devDep only — zero runtime deps preserved**) sidesteps it. Phase 3 SDKs need no equivalent. Coverage split so both artifacts are exercised: `test/` → CJS build, `examples/js/*.mjs` → ESM build. Verified: 12/12 tests green, `typecheck:examples` clean, both artifacts export an identical 11-symbol surface, `npm pack` excludes `examples/`+tests. Depends on 2.3–2.4. |

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
| 3.7 | Generate Layer 1 (Mail) → `packages/go/` | PENDING | | **`go.mod` must declare `module github.com/turboSMTP/turbosmtp-go`** — the *mirror's* path, not the in-repo location. Go doesn't require the main module's path to match its directory, so local builds/tests are unaffected; the mirror is canonical for consumers. **Lower-case org is mandatory, not cosmetic:** Go module paths are case-sensitive (GitHub URLs are not), so a user running `go get github.com/turboSMTP/…` against a lower-case `go.mod` fails with *"module declares its path as X but was required as Y"*; upper-case also `!`-escapes in proxy paths. Four published lines currently show the mixed-case form and **must be corrected before 3.9 publishes** (8.2/8.3 own the edits): `README.md:54`, `sdks/index.md:15`, `sdks/go.md:12`, `sdks/go.md:26`. Depends on 1.6, 0.2, 4.7 |
| 3.8 | Author Layer 2 facade (`client.Mail.Send`) | PENDING | | Depends on 3.7 |
| 3.9 | Tests + publish to pkg.go.dev | PENDING | | Depends on 3.8 |
| **PHP** |
| 3.10 | Generate Layer 1 (Mail) → `packages/php/` | PENDING | | **`composer.json` must declare `"name": "turbosmtp/turbosmtp-client"`** (the contracted name — `client-contract.md` §6; the mirror *repo* is `turbosmtp-php`, repo name and package name are independent). Packagist reads it from the mirror root. This is the language that forced the mirrored-publishing topology (ADR-0003): public packagist.org cannot index a subdirectory `composer.json` (paid Private Packagist only). Depends on 1.6, 0.2, 4.7 |
| 3.11 | Author Layer 2 facade (`$client->mail->send`) | PENDING | | Depends on 3.10 |
| 3.12 | Tests + publish to Packagist (`turbosmtp/turbosmtp-client`) | PENDING | | Depends on 3.11 |

---

## Phase 4 — Shared infrastructure & CI
> Cross-cutting; can proceed alongside Phase 2–3.

| # | Task | Status | Weeks Effort | Notes |
|---|---|---|---|---|
| 4.1 | Define shared conformance test matrix (spec-derived scenarios) | PENDING | | Single source for per-language tests; starts with contract §3.3. **Must also carry a packaging category — "the packaged artifact loads and exposes the contracted surface"** — which is behavioural but not spec-derived, so §3.3 alone won't produce it. Node's `test/packaging.test.mjs` is the reference instance (assert each shipped artifact against an explicit contracted-export list, then against the others; a bare artifact-vs-artifact comparison passes when a symbol is dropped from both). Generalises wherever a language ships more than one consumable form or a non-trivial entry-point map. Also see ADR-0004's consumer-floor check — the natural home for automating it is here plus 4.6 |
| 4.2 | Mock server harness (Prism) from the OpenAPI spec | PENDING | | Credential-free tests in CI |
| 4.3 | Gated live smoke tests (send) using stored `CONSUMER_KEY`/`CONSUMER_SECRET` | PENDING | | Rate-limited; opt-in in CI |
| 4.4 | Regeneration workflow `.github/workflows/generate-sdks.yml` | PENDING | | On spec change: bundle → generate → open PR with regenerated Layer 1. **Shape settled by ADR-0003 (2026-08-05): stays single-repo, ONE PR covering all five languages** — no cross-repo PRs, no cross-repo spec distribution, and facade edits land atomically alongside the regen. Depends on 1.6 |
| 4.5 | Spec-drift guard in CI (fail if committed Layer 1 is stale) | PENDING | | Depends on 4.4 |
| 4.6 | Per-language publish CI (npm/PyPI/NuGet/pkg.go.dev/Packagist on tag) | PENDING | | Triggered per-language by a `<lang>/vX.Y.Z` tag. npm/PyPI/NuGet publish **directly from this repo**; Go and PHP are published *by* the mirror push in 4.7 (registries read the mirror's root tag). Node's build is two-step (`build:cjs` + esbuild `build:esm`), so CI must `npm ci` inside `sdks/packages/node/` — plain `tsc` is no longer sufficient. Needs per-registry tokens. Depends on Phase 2–3, 4.7 |
| 4.7 | Mirror-split workflow `.github/workflows/split-mirrors.yml` | DONE | | **Authored 2026-08-05; proven end-to-end 2026-08-06** against `turboSMTP/turbosmtp-node` via throwaway tag `node/v0.0.1-test` (run 31106023389). Verified: 46/46 files **byte-identical by blob hash**, mirror tag translated to unprefixed `v0.0.1-test`, mirror root contains package files only (no cross-language leakage), default branch `main` created by the first push. Mirror-side test tag deleted. ⚠️ **`node/v0.0.1-test` still exists in `developers-hub`, local and origin** (as of 2026-08-10) — clean up with `git push origin :refs/tags/node/v0.0.1-test && git tag -d node/v0.0.1-test`. **Two defects the dry run caught** (run 31105171893, fixed before success): (1) `gh secret set` run without a TTY stores an **empty** value silently — added a fail-fast guard that reports token length, never the value; (2) `actions/checkout` persists `GITHUB_TOKEN` in `.git/config`, so an empty `MIRROR_TOKEN` **silently fell back** to it and failed as an opaque `denied to github-actions[bot]` 403 rather than an auth error — fixed with `persist-credentials: false`. That fallback would have been far harder to diagnose once mirrors become the publication channel for Go/PHP. On a `<lang>/v*` tag: `git subtree split` that package dir → force-push to its `turbosmtp-*` mirror → push the **tag translated to unprefixed `vX.Y.Z`** (Go resolves root-module tags; Packagist reads a root `composer.json`) — that translation is the whole point. Dependency-free plain `git subtree split`, no splitsh-lite (histories are small); single job keyed off the tag prefix, so adding a language is one `case` arm + one `on.push.tags` entry. `fetch-depth: 0` is mandatory — a shallow clone silently mirrors truncated history. **Prerequisites before first use:** create each `turbosmtp-*` repo **as its language ships** (not all five upfront — empty repos for unbuilt languages read as abandoned) with **Issues disabled** and a read-only README banner pointing here. **GitHub cannot disable pull requests** (no API/UI toggle exists — only `has_issues`/`has_wiki`/`has_projects`/`has_discussions`); close unsolicited PRs manually, or add an auto-close workflow if volume ever justifies it. Note a workflow could only live in the mirror by being committed under `sdks/packages/<lang>/.github/`, since the force-push overwrites everything else — and that would require `workflow` scope on `MIRROR_TOKEN`; add secret `MIRROR_TOKEN` in `developers-hub`. **Provisioned 2026-08-06 as a fine-grained PAT** scoped to the mirror(s) with `Contents: Read and write` only — proportionate while Node is the sole mirror and npm publishes from this repo, so the token cannot poison the npm package. **Upgrade to an org-owned GitHub App before 3.7/3.10 ship:** for Go and PHP the mirror *is* the publication channel (pkg.go.dev and Packagist read it directly), so write access becomes the ability to publish malicious SDK versions — and a fine-grained PAT is additionally tied to one person and silently expires within a year, which would break releases. **Prove on Node first** — mirroring is optional there and mandatory for Go/PHP, so the risk ordering is deliberate. |

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
| 8.1 | Rewrite `sdks/nodejs.md` against the real published package | PENDING | | After 2.5; fix aspirational install snippets. **Also revisit `package.json`'s `homepage`** — currently `serversmtp.com/email-sdks-for-developers` (live, correct *kind* of target) because nothing under `developers-hub` is a better option today. **Blocker found 2026-08-05:** `deploy-swagger-ui.yml` publishes `path: api-reference` **only**, so `sdks/*.md` and `docs/` are GitHub-rendered markdown, not a website — despite `CLAUDE.md` describing the repo as a Pages-published portal. A per-SDK homepage like `…/developers-hub/sdks/nodejs` needs **both** this rewrite *and* a Pages scope change (broaden the path + decide markdown rendering; there is no `_config.yml`). Until both land, leave `homepage` pointing at the marketing page rather than at a stale guide. |
| 8.2 | Rewrite `sdks/python.md`, `csharp.md`, `go.md`, `php.md` against real packages | PENDING | | After Phase 3 |
| 8.3 | Update `sdks/index.md` (registry) with real package names/versions per tier | PENDING | | Rolling, per tier |
