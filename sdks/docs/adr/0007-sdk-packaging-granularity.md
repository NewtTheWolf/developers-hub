# ADR-0007: SDK Packaging Granularity — One Unified Package Per Language

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Applies to** | All five SDKs; `plan.md` fixed decision #3; `client-contract.md` §2 and §6 |

---

## Context

`plan.md` fixed decision #3 states that each language ships **one unified package**, with feature
domains as namespaces within it (`mail`, `validation`, `analytics`, `suppressions`, `subaccounts`,
`account` — `client-contract.md` §6). That was decided before any package existed, on architectural
instinct rather than evidence, and it is now load-bearing in three places:

- `client-contract.md` §6 pins exactly one registry name per language;
- [ADR-0003](0003-sdk-repository-topology.md) makes every *publishable unit* cost a mirror
  repository, because Go resolves module paths from a repo root and public Packagist reads
  `composer.json` from a repo root;
- `sdks/packages/node/` is built and shaped that way (`@turbosmtp/sdk`, `client.mail.send`).

Three things made re-deriving it from evidence necessary rather than academic.

**A parallel effort inside the organisation chose the opposite shape.** `turboSMTP-js` published
per-domain `@turbosmtp/mail` and `@turbosmtp/webhook` (both 2026-08-05) on the npm scope this program
needs — `TASKS.md` 2.5, BLOCKED. Decision #3 cannot be defended as self-evident when a sibling effort
read the same problem differently. (Note that effort's own governing RFC, `developer-ecosystem` PR #5,
proposed **one** runtime-agnostic TS package while **two** shipped, so it is not evidence of a settled
position on the other side either.)

**The Python-first reorder (2026-08-14, `TASKS.md` Phase 3) turned it into a code prerequisite.** Under
a domain split, PyPA's rule that every distribution sharing a namespace package must omit `__init__.py`
or use a pkgutil-style one means the top-level `turbosmtp` package cannot carry a real `__init__.py` —
so `from turbosmtp import TurboSMTPClient` becomes impossible and the facade is forced down to
`turbosmtp.core` or out into a separate `turbosmtp-core` distribution. That import statement is the
first line task 3.2 writes.

**Nothing in the record justified the decision.** This ADR ratifies a primary-source review performed
**2026-08-11**, gathered from each technology's own official guidance **first**, deliberately without
reference to competitor behaviour, with registry-verified competitor shapes used only as corroboration.
That evidence is inlined below rather than held in a companion document. Four options were considered: **A** one package per language (status quo), **B** domain
packages plus a shared core, **C** core + domains + umbrella (SendGrid's Node shape), **D** one package
with modular entry points.

---

## Decision

**Option A stands — one unified package per language, domains as namespaces — now on evidence rather
than assumption.** Three refinements are adopted with it, each existing to keep the decision
falsifiable rather than permanent.

### 1. Modular consumption, not modular release

If install weight ever justifies modularity, it is served **within** the package, not by splitting the
release. In **Node only**, add per-namespace subpath exports (`@turbosmtp/sdk/validation`): one extra
esbuild entry point plus an `exports` key. **Do not build this before P1 exists.**

Two constraints bind if it is ever built. Each subpath needs its own `types` condition per
`import`/`require` branch, and

> *"the presence of `exports` prevents any subpaths not explicitly listed or matched by a pattern in
> `exports` from being resolved."*
> — [TypeScript modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)

Consumers on legacy `moduleResolution: node` cannot resolve subpath types at all — which matters
because `TASKS.md` 2.5 deliberately verified the node10 fallback at TS 5.4. **The root export must
therefore always remain the complete surface**; subpaths are additive, never the only door. `sideEffects: false` is already set, so bundlers can drop unused domains today.

### 2. One carve-out — webhook signature verification is not an API domain

It has no HTTP surface, needs a crypto dependency, and is consumed by the *receiving* service rather
than by the sender. If ever built, a separate small package per language is legitimate where idiomatic
(`@sendgrid/eventwebhook` is precedent). It is absent from both the served spec and contract §6 today,
so this carve-out grants permission and creates no work.

### 3. Flip triggers, recorded up front

Revisit this ADR if any of the following becomes true:

1. Operation count grows roughly **5×** with genuinely independent lifecycles per domain;
2. A domain acquires a distinct **product / base-URL / billing boundary** — the Mailchimp case.
   `account` introducing a second credential per §3.2 is watch-worthy but same-host, and does not
   trip this;
3. Consumers **measurably** complain about install weight;
4. The organisation **sanctions `turboSMTP-js`** as the Node SDK — in which case **Node alone**
   diverges to domain packages and the other four stay unified.

### Per-language divergence

Permitted in principle — the question does not have to be answered identically in all five languages.
On this evidence it is **not warranted anywhere** except the Node scenario in trigger 4.

### Layer 1 hiding is asymmetric, and that is accepted (finding E4)

Enforceable hiding of the generated core exists only in **Node** (`exports` encapsulation) and **Go**
(`internal/`). Python (`turbosmtp._generated`) and PHP (`@internal`) are convention-only, and **C#
cannot hide it at all** — the generator emits `public` types in `TurboSMTP.Generated`. This asymmetry
is documented in `client-contract.md` §2 rather than fought with custom templates.

---

## Rationale

### Every ecosystem's own guidance points to an intra-package mechanism

Verbatim where the exact wording is load-bearing; full links in [References](#references).

| Ecosystem | What its own guidance says |
|---|---|
| **Go** | The only ecosystem with an explicit rule, and it says **one module at the repo root** — *"Designing your repository so that it hosts a single module at its root directory will help keep maintenance simpler"* ([managing module source](https://go.dev/doc/modules/managing-source)). Multiple modules require directory-prefixed version tags — the exact cost ADR-0003 already refused. **Module graph pruning** (≥1.17) removes the weight argument: a consumer importing only `mail` does not download unimported packages' dependencies. Modules are the unit of *versioning*, not of organisation |
| **Node** | *"When writing a new package, it is recommended to use the `exports` field"*, and — the mechanism behind finding E4 below — *"When the `exports` field is defined, all subpaths of the package are encapsulated and no longer available to importers"*, with deep imports throwing `ERR_PACKAGE_PATH_NOT_EXPORTED` ([modules: packages](https://nodejs.org/api/packages.html)). The sanctioned answer to exposing several parts is one package with `./validation` subpaths — a within-package mechanism |
| **Python** | PyPA scopes namespace packages to *"a large collection of loosely-related packages"* — six domains regenerated from one spec are the opposite. And the blocker is mechanical, not stylistic: *"It is extremely important that every distribution that uses the namespace package omits the `__init__.py` or uses a pkgutil-style `__init__.py`. If any distribution does not, it will cause the namespace logic to fail."* That is the sentence that would cost us `from turbosmtp import TurboSMTPClient` (see Context). Python's idiomatic modular knob is **extras**, which gate optional *dependencies*, not optional domains |
| **C#** | Microsoft's NuGet guidance takes no position on splitting. The nearest official rule is Azure's: *"YOU SHOULD place small related components that evolve together in a single NuGet package"*, alongside *"DO name the package based on the name of the main namespace"* — i.e. package `TurboSMTP` ↔ namespace `TurboSMTP`, exactly `client-contract.md` §6 ([Azure SDK .NET guidelines](https://azure.github.io/azure-sdk/dotnet_introduction.html)). Our domains evolve together **by construction** — one spec, one regeneration PR |
| **PHP** | Composer is one package ⇄ one VCS repository root ([Libraries](https://getcomposer.org/doc/02-libraries.md)) — already the force behind ADR-0003. PHP's actionable guidance is about *transport*, not granularity |

**None of the five recommends splitting a single API client by domain.** The one split rule that
exists at all (Azure's) is conditioned on components that evolve *separately* — ours cannot.

### Two costs are sharp because of decisions already made here

Generic drawbacks of B/C (discoverability, "which package do I need") are ordinary. These two are not:

1. **ADR-0003 makes every publishable unit cost a repository.** In Go and PHP a domain package is not
   a folder — it is a mirror repo plus a tag pattern. Six domains × five languages ≈ **30 release
   units and roughly a dozen extra mirrors**, each needing `MIRROR_TOKEN` write access. ADR-0003
   already flags that credential as broad; this would widen it materially, and for Go and PHP the
   mirror *is* the publication channel.
2. **A shared `core` becomes a compatibility straightjacket.** Auth routing, region, the §3.4 error
   taxonomy, the §3.5 pagination iterator and retries are needed by every domain. Any change to the
   error hierarchy becomes a major bump fanning out across all domain packages, leaving consumers to
   resolve `mail 1.2 + validation 2.0 + core 1.5`. Diamond-dependency pain lands hardest in PHP and
   Python — and would land there before it ever bit Node.

### What option B would genuinely buy, stated fairly

- **Independent per-domain versioning** — low value against a stable 60-operation spec regenerated as
  one unit;
- **Smaller installs** — the whole P0 Node package is **60.7 kB packed with zero runtime
  dependencies**; validation and analytics might triple that and still be noise. Irrelevant outside JS;
- **Per-domain gating of credit-based features** like validation — a billing concern, not a packaging
  one;
- **Reconciliation with the published `@turbosmtp/mail` / `@turbosmtp/webhook`** — an organisational
  argument, not a technical one, and explicitly out of scope per
  [ADR-0005](0005-sdk-program-authority.md). Trigger 4 is where it would land if that changes.

### Competitor evidence corroborates but does not decide

Registry-verified **2026-08-11** — versions recorded because they are a snapshot, not a claim about the
future. Mailgun ships **14 namespaces on one client** (`mailgun.js` 13.3.0: `mg.messages`, `mg.validate`,
`mg.suppressions`, `mg.subaccounts`, `mg.metrics`, …), one Go module (`mailgun-go/v5`), and exactly one
Packagist package. Postmark (5.1.0), Resend (6.19.0) and Brevo (`@getbrevo/brevo` 6.0.3) ship one package
per language; Stripe (22.5.0, ~50 resource namespaces) and Twilio (6.1.0) the same across every product.
SendGrid splits its Node packages by **concern, not domain** (`mail`, `client`, `helpers`,
`eventwebhook`, `inbound-mail-parser`), with `@sendgrid/mail` depending on the others so consumers still
install one name — and everything outside mail has **no typed surface at all**:
`client.request({method:'GET', url:'/v3/api_keys'})`. Its NuGet `SendGrid` (234 M downloads) and Composer
`sendgrid/sendgrid` are single packages. Mailchimp's split is a **product** boundary — two base URLs, two
auth models. AWS, Azure and Google split per service, and AWS's [published
rationale](https://aws.amazon.com/blogs/developer/modular-packages-in-aws-sdk-for-javascript/) is
browser bundle weight across 300+ services (v2 → v3: ~395 kB/17 s → ~48 kB/3 s) — yet AWS still does
**not** split Python.

The dividing line is **service count × browser delivery**, not domain count, and AWS's Python
exception shows the choice is ecosystem-driven rather than architectural. TurboSMTP is 39 paths /
60 operations / 6 namespaces: Postmark territory, not AWS.

### Why the reversal cost stays low

Layer 1 generation is already domain-partitioned (`scripts/generate.mjs --domain`), so the *code* half
of any future flip stays cheap. The expensive half is distribution — mirrors, tags, registry names —
which is exactly what trigger 3 and the refinements above gate.

---

## Consequences

### Positive

- **`plan.md` #3 is now evidence-grounded** and cites primary ecosystem guidance rather than instinct,
  which is what makes it defensible against the sibling effort's opposite choice.
- **Python 3.2 is unblocked to write the obvious thing** — a real `__init__.py` exporting
  `TurboSMTPClient` from the `turbosmtp` package, with Layer 1 in `turbosmtp._generated`.
- **`MIRROR_TOKEN` scope stays narrow.** One publishable unit per language keeps ADR-0003's mirror
  count at five and the token's blast radius at what it is today.
- **The decision is falsifiable.** Four triggers, written before any pressure to flip, prevent the
  same instinct-versus-evidence gap from recurring.
- **Three ecosystem findings are routed to the tasks that own them** regardless of granularity: **E1**
  generate Go's Layer 1 into `internal/generated` (`TASKS.md` 3.7); **E2** decide PHP's Guzzle-vs-PSR-18
  transport, or accept an injected PSR-18 `ClientInterface` as the seam mirroring Node's `fetchApi`
  (3.10); **E3** reserve the `TurboSMTP.*` NuGet ID prefix (3.6).

### Negative / Constraints

- **This ADR does not resolve the `@turbosmtp` npm conflict** — it records that our shape differs from
  the published packages and defers the organisational question to ADR-0005's boundary. `TASKS.md` 2.5
  stays BLOCKED, and trigger 4 is the only path by which Node diverges.
- **C# ships its generated core publicly**, and no decision here changes that. Consumers can reach
  `TurboSMTP.Generated` and may bind to it; only documentation discourages it.
- **The Node subpath-exports option carries a resolution trap if ever exercised.** Legacy
  `moduleResolution: node` consumers cannot resolve subpath types, so the root export is permanently
  obliged to expose the complete surface — a constraint on every future release, not just the one that
  adds subpaths.
- **Trigger 2 needs watching, not just recording.** `account` introduces a second credential path per
  §3.2 (P2, `TASKS.md` 6.4). It is same-host and does not trip the trigger today, but it is the
  nearest thing in the roadmap to a product boundary.
- **The evidence lives in this ADR, not in a companion document.** The 2026-08-11 analysis was folded
  in here and its working file discarded — deliberately. The primary-source quotations are the substance
  of this decision and re-gathering them would be the expensive part of any revisit, so they are
  preserved; but a parallel analysis document restating the same conclusions would drift from the ADR
  and blur which one governs, the failure mode [ADR-0005](0005-sdk-program-authority.md) exists to
  prevent. The cost is a longer Rationale than an ADR would otherwise carry; the benefit is a single
  authority.

---

## References

- [ADR-0003](0003-sdk-repository-topology.md) — mirrored publishing; the reason a publishable unit
  costs a repository in Go and PHP
- [ADR-0005](0005-sdk-program-authority.md) — the `turboSMTP-js` / `@turbosmtp` scope boundary that
  keeps the npm conflict organisational rather than architectural
- `sdks/plan.md` #3 — the fixed decision this ADR grounds
- `sdks/client-contract.md` §2 (finding E4, Layer 1 hiding asymmetry) and §6 (namespaces are a
  *surface* guarantee, independent of distribution granularity)
- `sdks/TASKS.md` — 3.0a (this ratification), 2.5 (npm scope), 3.6 (E3), 3.7 (E1), 3.10 (E2)
**Ecosystem guidance** (the primary sources quoted in the Rationale):
[Go — managing module source](https://go.dev/doc/modules/managing-source) ·
[Go Modules Reference](https://go.dev/ref/mod) ·
[Node.js — modules: packages](https://nodejs.org/api/packages.html) ·
[TypeScript — modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html) ·
[PyPA — packaging namespace packages](https://packaging.python.org/en/latest/guides/packaging-namespace-packages/) ·
[PyPA — writing pyproject.toml](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) ·
[Microsoft — NuGet and .NET libraries](https://learn.microsoft.com/en-us/dotnet/standard/library-guidance/nuget) ·
[Azure SDK .NET guidelines](https://azure.github.io/azure-sdk/dotnet_introduction.html) ·
[Composer — libraries](https://getcomposer.org/doc/02-libraries.md) ·
[HTTPlug — for library developers](https://docs.php-http.org/en/latest/httplug/library-developers.html) ·
[openapi-generator — php options](https://openapi-generator.tech/docs/generators/php/)

**Registry evidence** (how to reproduce the 2026-08-11 competitor snapshot):
[@sendgrid npm scope](https://registry.npmjs.org/-/v1/search?text=%40sendgrid) ·
[@sendgrid/client README](https://github.com/sendgrid/sendgrid-nodejs/blob/main/packages/client/README.md) ·
[mailgun.js](https://github.com/mailgun/mailgun.js) ·
[mailgun-go/v5](https://pkg.go.dev/github.com/mailgun/mailgun-go/v5) ·
[Packagist vendor listing](https://packagist.org/packages/list.json?vendor=mailgun) ·
[NuGet search API](https://azuresearch-usnc.nuget.org/query?q=sendgrid) ·
[AWS — modular packages in the JS SDK](https://aws.amazon.com/blogs/developer/modular-packages-in-aws-sdk-for-javascript/) ·
[AWS SDK for Python (boto3)](https://aws.amazon.com/sdk-for-python/)
