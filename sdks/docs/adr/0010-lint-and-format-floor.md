# ADR-0010: Lint and Format Floor — Biome, Repository-Scoped, Pinned Exactly

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-21 |
| **Applies to** | `sdks/` JavaScript and TypeScript; extends [ADR-0004](0004-build-toolchain-version-policy.md) |

---

## Context

`sdks/` had no lint or format tooling of any kind. The Node package and the webhook package were
written by hand to a consistent style, which held only because one person wrote both in one sitting.
Four more languages follow, and Node is the reference the others read.

Two things needed deciding: what enforces style, and whether [ADR-0004](0004-build-toolchain-version-policy.md)'s
version policy reaches it. The second question is not academic — the first implementation floated
`@biomejs/biome@2` in CI, which resolved to 2.5.9 while `biome.json`'s `$schema` named 2.5.4, with no
lockfile binding either. That is the shape ADR-0004 rule 1 forbids, in a job that gates merges.

ADR-0004 scopes itself to *"compilers and build tooling, not runtime dependencies"*. A formatter is
arguably neither, so the policy's applicability had to be settled rather than assumed.

---

## Decision

### 1. Biome is the lint and format floor for `sdks/`

One binary covering both formatting and linting, zero configuration for either, and no plugin
resolution. The alternative in this ecosystem is ESLint plus Prettier plus a TypeScript parser plus
a config package, which is four dependency trees and a per-package `node_modules` in a repository
whose packages deliberately ship **zero runtime dependencies**.

Biome is a floor, not a ceiling. A language that lands later brings its own idiomatic tool — `ruff`
for Python, `dotnet format`, `gofmt`, `php-cs-fixer`. This ADR governs the JavaScript and TypeScript
surface only, and does not make Biome a cross-language standard.

### 2. Configuration lives at the repository root, scoped to `sdks/`

`biome.json` sits at the root and its `files.includes` begins with `sdks/**`. Root because the tool
must cover files that belong to no package — `sdks/scripts/`, and any future sibling. Scoped because
the rest of the repository is documentation and a generated spec bundle, already covered by
`validate-openapi.yml`, and reformatting it would produce a diff nobody asked for.

### 3. Generated Layer 1 is excluded, along with build output

`!sdks/packages/*/src/generated/**`, `!sdks/build/**`, `!**/dist/**`. Generated code is the
generator's output and is regenerated wholesale; formatting it would produce a diff that the next
`generate.mjs` run reverts, and linting it would report defects nobody can fix in place. This matches
`CLAUDE.md`'s existing rule that Layer 1 is never hand-edited.

### 4. ADR-0004 extends to lint and format tooling, and Biome is pinned exactly

Rule 3's reproducibility argument is what carries: the output of a merge gate must be a function of
its recorded inputs, and a formatter's version is such an input whether or not the tool is a
compiler. ADR-0004 is read as covering **any tool whose version changes what CI reports**, which is
the property its two motivating incidents shared.

Biome is therefore pinned to the exact version in CI — currently `@biomejs/biome@2.5.4`, matching
`biome.json`'s `$schema` — rather than floated. It is not a `devDependency` of either package: it
lints files outside both, so neither package's lockfile is the right home and neither package is a
legitimate owner of a repository-wide gate. If a root package with a lockfile is introduced, the pin
moves there and rule 3's lockfile mechanism applies in full.

Until then this is a **documented exception to rule 3**, not compliance with it: an exact `npx`
version is reproducible in practice but nothing enforces that CI and a developer's local run agree.
Two places name the version, and they must be changed together.

---

## Rationale

### Why the floating major was worse here than for a compiler

ADR-0004 was written after `^5.4.0` silently resolved TypeScript to 5.9.3. A compiler drifting
produces a build that fails for the person who caused it. A **formatter** drifting produces failures
for people who caused nothing: Biome minors add rules to `recommended`, and `recommended: true` is
set here, so a minor lands new rules on the next run and an unrelated documentation pull request goes
red on files it never touched. The blast radius is wider than the incident that motivated the policy,
which is why the policy has to reach it.

### Why `recommended: true` rather than an enumerated rule set

Enumerating rules ties every upgrade to a config review and produces a list nobody revisits. Taking
the recommended set means upgrades are deliberate — the pin forces a human to move the version, and
the diff from doing so is the review. This is only safe *because* of the pin; the two decisions
depend on each other.

### Why not ESLint plus Prettier

Familiarity is the argument for it, and it is real. Against it: four dependency trees, a
`node_modules` in a repository that ships none at runtime, a parser that must track TypeScript
versions, and a well-known formatter/linter conflict that needs a fifth package to disable. For a
surface of roughly thirty files the cost is not repaid.

---

## Consequences

### Positive

- Style stops depending on who wrote the file, before four more languages copy Node's conventions.
- One binary and one config file, with no `node_modules` at the repository root.
- CI reports the same result on every run until someone deliberately changes a version.
- ADR-0004's scope question is settled once, rather than re-argued when the next non-compiler tool
  arrives.

### Negative / Constraints

- **Rule 3 is not satisfied, only approximated.** No lockfile binds Biome. This is stated above as an
  exception with a named exit; it should not be quietly forgotten.
- **The version is named in two places** — `biome.json`'s `$schema` and the CI invocation — and
  nothing enforces that they agree. They already disagreed once, which is how this ADR started.
- **`recommended: true` means an upgrade can introduce work**, deliberately. The pin makes that a
  choice rather than a surprise, but the work is real.
- **Biome covers JavaScript and TypeScript only.** Four languages will each need this decision made
  again, and this record is not the answer for them.

---

## References

- [ADR-0004](0004-build-toolchain-version-policy.md) — the version policy this extends, and rules 1-3
  in particular.
- PR #5, thread on `.github/workflows/sdks-ci.yml` — where the floating major and the scope question
  were raised.
- `biome.json` — the configuration this record explains.
- `CLAUDE.md`, SDK Development — the existing rule that generated Layer 1 is never hand-edited.
