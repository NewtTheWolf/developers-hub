# ADR-0006: Legacy Official SDK Consolidation — Deprecate `turboSMTP-{csharp,php,python}`

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-11 |
| **Applies to** | The three pre-existing official SDK repositories, and the C#/PHP/Python rollout in `TASKS.md` Phase 3 |

---

## Context

Three repositories in the `turboSMTP` organisation are labelled official SDKs and predate this
effort. A registry reconnaissance on 2026-08-11 established their actual state.

| Repository | Last push | State |
|---|---|---|
| `turboSMTP-csharp` | 2026-01-11 | Most complete. Real facade (`TurboSMTPClient.cs`, `TurboSMTPClientConfiguration.cs`, `Domain`/`Model`/`Services`), 18 KB `USAGE.md`. README claims v2.0.0 while `Directory.Build.props` declares 1.0.0 |
| `turboSMTP-php` | 2025-05-30 | Facade plus phpunit tests. `SDK/composer.json` declares `turbosmtp/sdk` |
| `turboSMTP-python` | 2024-11-28 | Generator output only — the facade directory contains a single 0-byte `remove.txt`. Abandoned before any hand-written layer existed |

Three findings matter more than the individual states.

**None of them was ever published to any registry.** Verified 2026-08-11: NuGet returns zero
hits for `turbosmtp`, `turbo smtp` and `serversmtp`; the Packagist vendor `turbosmtp` is
unclaimed; PyPI's `turbosmtp` is an unrelated 2015 Python-2-only package by a third party
(`0x1001`, Damian Nowok) whose own description says it is *not* the serversmtp.com client.
Consistently, `serversmtp.com/email-sdks-for-developers` showcases C# and PHP but links to the
GitHub repositories and shows **no install command for either**.

**They were built with this project's own toolchain, from a different spec.** Both
`Generate.bat` files invoke `@openapitools/openapi-generator-cli` (pinned 7.3.0; this effort
pins 7.24.0) against `api.swaggerhub.com/apis/turbo-smtp/public/2.0.0-oas3` — a SwaggerHub-hosted
spec, not the canonical `turbo-smtp-openapi` source that feeds `api-reference/turbo-smtp.yaml`.
Two independent spec sources for one API is a drift generator.

**PHP had already reached this project's Packagist conclusion, and stopped.** Its
`composer.json` sits in the `SDK/` subdirectory — precisely the layout
[ADR-0003](0003-sdk-repository-topology.md) proved public Packagist cannot index. The repo
could not have published as structured.

[ADR-0005](0005-sdk-program-authority.md) makes this repository the authoritative record, which
makes the question actionable: three repositories carry the official label, satisfy no contract,
conform to no process, and are unreachable through any package manager.

---

## Decision

**The three legacy repositories are superseded** by the contract-conformant SDKs built in
`sdks/packages/`, and are deprecated **per language, when this effort's replacement for that
language publishes.** No repository is deprecated before there is something to replace it with —
C# and PHP are the only SDKs the marketing site advertises, and retiring them early would
advertise a gap.

**The SwaggerHub spec source is retired.** The canonical spec is `turbo-smtp-openapi` →
`api-reference/turbo-smtp.yaml` → `sdks/build/turbo-smtp.bundled.yaml`, per `CLAUDE.md`.

### The repository-name constraint

GitHub repository names are **case-insensitive-unique per owner**. Verified 2026-08-11:

```
GET repos/turboSMTP/turbosmtp-php     -> turboSMTP/turboSMTP-php      (legacy, live)
GET repos/turboSMTP/turbosmtp-python  -> turboSMTP/turboSMTP-python   (legacy, live)
GET repos/turboSMTP/turbosmtp-dotnet  -> 404  (free)
GET repos/turboSMTP/turbosmtp-go      -> 404  (free)
```

Two of ADR-0003's five mirror repositories — `turbosmtp-python` and `turbosmtp-php` — therefore
**cannot be created while the legacy repositories hold those names.** C# is unaffected only
because its mirror is named `turbosmtp-dotnet`; Go and Node are unaffected.

**Archiving does not free a name.** An archived repository still occupies it. Only renaming or
deleting does.

### Per-language sequence

For **Python and PHP**, where the name is contested:

1. **Rename** the legacy repository to `turboSMTP-<lang>-legacy`. This frees the mirror name;
   GitHub leaves a redirect from the old path.
2. **Create the mirror** at the freed name — Issues disabled, read-only README banner pointing
   here (the ADR-0003 / `TASKS.md` 4.7 prerequisites).
3. **Ship and publish** the replacement SDK.
4. **Deprecate the renamed legacy repository:** superseded banner at the top of its README
   pointing at the new package and at `developers-hub`, then archive it.

For **C#**, steps 1 and 2 are independent — the mirror name is already free, so the legacy
repository is renamed only if desired, and step 4 applies once `TurboSMTP` publishes to NuGet.

Deliberate side effect: once a mirror occupies the old name, the marketing site's existing
`turboSMTP-php` and `turboSMTP-csharp` links resolve to the new SDK rather than to a redirect or
a 404. The marketing-site edit is still required, but link rot is not the failure mode if it
lags.

---

## Rationale

### Why supersede rather than modernize in place

PR #5's reuse-before-build preference (see [ADR-0005](0005-sdk-program-authority.md)) argues for
modernizing what exists. Applied to these three repositories it does not pay:

- **Python has nothing to modernize** — the facade is a 0-byte placeholder, so "modernize" means
  "write from scratch", which is what Phase 3 already does.
- **Neither the contract nor the process transfers.** These SDKs satisfy no
  `client-contract.md` surface, share no conformance matrix, and sit outside the regeneration
  and drift-guard pipeline. Reaching contract conformance from their current shape is not less
  work than generating Layer 1 and writing the facade.
- **PHP's layout cannot publish** as structured, and fixing that means the mirror mechanism this
  project already built.
- **Their spec source is wrong**, so any modernization starts by re-pointing generation at the
  canonical spec — the first step of the existing pipeline.

The C# repository is the closest call: it has a genuine facade, real usage documentation, and a
recognisable client shape. Its content is a useful reference when writing the C# facade (3.5) —
particularly its `SendServerURL`/`ServerURL` region split, which matches the contract's region
handling. Superseding the repository does not mean ignoring what is in it.

### Why per-language rather than all at once

C# and PHP are the only SDKs `serversmtp.com/email-sdks-for-developers` advertises. Deprecating
them before replacements exist would leave the marketing page pointing at repositories banner-ed
as dead, with nothing to install — worse for a developer evaluating TurboSMTP than the current
state, where the code at least exists and works.

### Why archive rather than delete

Archiving preserves history, issues and any external references. Deletion would break inbound
links with no redirect and destroy the C# repository's reference value. The rename in step 1 is
the minimum needed to free a name; deletion is never required.

---

## Consequences

### Positive

- Unblocks the `turbosmtp-python` and `turbosmtp-php` mirror names, without which ADR-0003's
  topology cannot be completed for those two languages.
- One official SDK per language, contract-conformant, on a single regeneration pipeline and
  drift guard.
- One spec source, removing a standing drift risk between SwaggerHub and the canonical repo.
- Ends the "looks official and rots" state that PR #5 correctly identified.

### Negative / Constraints

- **Ordering is now load-bearing for Python and PHP.** The legacy rename is a hard prerequisite
  of mirror creation, which is a prerequisite of publishing. Skipping it fails at repository
  creation, not at review. Recorded on `TASKS.md` 3.1, 3.10 and 4.7.
- **Renaming is externally visible** and breaks any clone remote or hard-coded reference that
  does not follow GitHub's redirect. Low impact given near-zero traction (`turboSMTP-csharp` has
  one star; the others none), but it is not invisible.
- **The marketing site must be edited per language**, outside this repository, coordinated with
  each publish. Tracked in `TASKS.md`.
- **`sdks/index.md` currently advertises install commands that do not work** — C#
  `dotnet add package TurboSMTP` and PHP `composer require turbosmtp/turbosmtp-client`, both
  marked "Stable". Neither package exists. Corrected as part of this change; the full rewrite
  stays with 8.2/8.3.
- **A leaked credential must be rotated regardless of this decision.** Both `Generate.bat` files
  commit a SwaggerHub API key in public repositories. Retiring the spec source does not revoke
  the key; rotation is a separate security action, tracked in `TASKS.md`.
- **The PyPI name is not resolved by this ADR.** `turbosmtp` is held by the abandoned 2015
  third-party package, so `client-contract.md` §6 cannot be satisfied as written. Requires a
  review-gated contract amendment — either a PEP 541 abandoned-project claim or the free
  adjacent slot `turbo-smtp`. Deliberately left open.

---

## References

- [ADR-0005](0005-sdk-program-authority.md) — SDK program authority; makes this consolidation actionable
- [ADR-0003](0003-sdk-repository-topology.md) — mirror repositories and published names; the name collision applies to its Python and PHP rows
- `sdks/client-contract.md` §6 — canonical package names per registry
- `sdks/TASKS.md` — 3.1/3.10 rename prerequisite, 9.1 the rename itself, 3.3b PyPI name, 4.7 mirror prerequisites, deprecation execution tasks
- `CLAUDE.md` — canonical spec flow (`turbo-smtp-openapi` → `api-reference/` → `sdks/build/`)
- `turboSMTP/turboSMTP-csharp`, `turboSMTP/turboSMTP-php`, `turboSMTP/turboSMTP-python` — the superseded repositories
- [PEP 541 — Package Index Name Retention](https://peps.python.org/pep-0541/) (the mechanism for claiming an abandoned PyPI name)
