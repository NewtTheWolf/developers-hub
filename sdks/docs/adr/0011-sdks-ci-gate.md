# ADR-0011: CI for `sdks/` — What the Merge Gate Covers, and What It Deliberately Does Not

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-21 |
| **Applies to** | `sdks/`; relates to `TASKS.md` 4.4, 4.5, 4.6 and [ADR-0004](0004-build-toolchain-version-policy.md) rule 4 |

---

## Context

`sdks/` had no CI. `validate-openapi.yml` lints the specification and `deploy-swagger-ui.yml`
publishes `api-reference/` only, so every line of SDK code merged unverified — the packages built and
tested on a developer's machine and nowhere else.

Three CI tasks are already planned and still `PENDING`: **4.4** a regeneration workflow, **4.5** a
spec-drift guard, **4.6** per-language publish on tag. A fourth, **4.7**, is done. Adding a gate
before those exist risks either duplicating them or foreclosing their shape, so the boundary between
this workflow and those three needs stating rather than discovering later.

A second question surfaced with it. Both packages declared `engines: { "node": ">=18" }` while the
matrix ran Node 22 only, and [ADR-0004](0004-build-toolchain-version-policy.md) rule 4 requires each
package to declare a minimum supported *consumer* toolchain version and to check against it. Review
then asked whether `>=18` was a floor worth promising at all: Node 18 reached end of life on
2025-04-30 and Node 20 on 2026-04-30, so the declaration covered two runtimes without security
patches.

---

## Decision

### 1. `sdks-ci.yml` gates correctness of what is committed, nothing else

Four jobs, on `pull_request` and on `push` to `main`, path-filtered to `sdks/**`, `biome.json` and
the workflow itself:

- **lint** — Biome at the pinned version over `sdks` ([ADR-0010](0010-lint-and-format-floor.md));
- **test** — per package, a matrix over the supported Node versions: `npm ci --ignore-scripts`,
  `typecheck`, `test`;
- **examples** — the shipped examples must still type-check against the facade they demonstrate;
- **live** — `workflow_dispatch` only, never automatic, because it sends real email.

Installs use `--ignore-scripts` deliberately: `prepare` builds on install and `pretest` builds again,
so skipping install scripts keeps it to one build rather than two.

### 2. The gate stops at the boundary of 4.4, 4.5 and 4.6

This workflow verifies **committed** code. It does not regenerate Layer 1 (4.4), does not compare
committed Layer 1 against the current spec (4.5), and does not publish (4.6). Those three are
event-driven — a spec change, a drift check, a release tag — while this one is a merge gate, and
merging them would make every pull request depend on the generator toolchain and a JVM.

4.5 is the one that will feel closest, because a stale Layer 1 is a correctness problem and this job
is the correctness job. It stays separate anyway: drift is a property of the *repository against the
spec*, not of the change under review, so it fails pull requests that did not cause it. It belongs on
a schedule or on spec change.

### 3. The test matrix covers the declared Node floor, not just the development version

ADR-0004 rule 4 asks each package to declare a minimum consumer toolchain and to check against it.
`engines` is a promise to consumers, and the floor is where it breaks — a global that does not
exist yet, a syntax level the parser rejects — so testing only the development version verifies the
version nobody is promised anything about.

The floor is **`>=22`**, and the matrix runs the **declared floor and the active LTS**: Node 22 and
Node 24. Testing every version in between buys little; testing the two ends is what makes `engines`
a checked claim rather than an assertion.

`>=18` was the first draft, written from the package's apparent requirements rather than from a
run, and it was raised for a reason the run could not have produced: a passing matrix on an
end-of-life runtime would still be the wrong promise. Node 18 and 20 are both past end of life, so
`>=18` offered support for runtimes that receive no security patches. 22 is the maintenance LTS
line and 24 the active one; the floor follows the supported lines rather than what happens to
execute.

This choice is free only because neither package has been published: `TASKS.md` 2.5 and 2.9 are
both blocked, so no existing consumer can be excluded by raising the floor now. The same change
after a first release is breaking and may require a major version. Each language therefore settles
its support floor against maintained runtime lines before its first publication, while it still gets
that choice once without a compatibility cost. Python, Go, PHP and C# apply the rule to their own
runtime support policies rather than copying Node's number.

**Two limits of this decision, stated so the record is not read as more than it is.** First, it
verifies the *source tree*: `npm ci`, `typecheck` and `test` inside the package directory. ADR-0004
is explicit that this is the insufficient form of rule 4, which wants the real tarball installed into
a scratch project outside the repository and resolved the way a consumer resolves it. That recipe
has been run once by hand (`TASKS.md` 2.5 records the published `.d.ts` type-checking under TS 5.4
through both the `exports` map and the `main`/`types` fallback); automating it is still owed by 4.1
and 4.6, and this matrix is the weaker cousin that runs on every pull request meanwhile. Second, the
consumer floor of a TypeScript package has two axes, Node *and* TypeScript, and ADR-0004's
motivating incident was on the TypeScript one. This matrix covers the Node axis only; the declared
TypeScript floor of 5.4 remains hand-checked.

### 4. Fork pull requests get no secrets, and that is load-bearing

GitHub does not expose secrets to `pull_request` runs from a fork. The **live** job is gated on
`workflow_dispatch` in addition, so this is belt and braces rather than the only barrier — but it
means the live job can never be made to run from a contributor's branch, which is the property that
lets the credentials exist at all.

---

## Rationale

### Why a gate before 4.4, 4.5 and 4.6 rather than with them

Those three depend on the generator, a JVM, registry credentials and a release process. Waiting for
them means Node and the webhook package ship unverified while four more languages copy their
conventions. The cheap 80% — does it lint, type-check, build, and pass its tests — needs none of
that, and it is the part that catches the defects a reviewer would otherwise catch by hand.

### Why the examples get their own job

They are the first thing a developer reads and the easiest thing to let rot: nothing imports them, so
a facade change that breaks them is invisible until someone copies one. Type-checking them turns the
README's promise into something CI enforces.

### Why the live job is dispatch-only rather than scheduled

It sends real email to a real mailbox and consumes real quota. A schedule makes that recurring cost
invisible; a dispatch makes it a decision, taken by someone verifying a release candidate. The
suite fails rather than skips when it is dispatched without credentials, so an empty pass cannot be
mistaken for a verified one.

---

## Consequences

### Positive

- SDK code stops merging unverified, before four more languages inherit the reference package's
  conventions.
- `engines` becomes a checked claim rather than a declaration, satisfying ADR-0004 rule 4.
- The support floor is settled before first publication, while changing it excludes no existing
  consumer; the remaining languages inherit that timing rule.
- The boundary against 4.4/4.5/4.6 is stated now, so those three can be designed without negotiating
  with an existing gate.
- Path filters keep documentation-only changes out of the SDK jobs entirely.

### Negative / Constraints

- **The matrix doubles the test jobs.** Both are short; if this becomes a real cost, dropping the
  floor from pull requests and keeping it on `main` is the obvious lever.
- **Future floor raises are consumer-visible changes.** The initial choice is free because the
  packages are unpublished; after that, Node 22 leaves maintenance on 2027-04-30, the floor moves
  with the supported lines, and each move is a release note and potential major release, not a
  silent edit.
- **The TypeScript floor is declared and not gated.** Stated above; the artifact-based check that
  would cover it is 4.1/4.6's.
- **No coverage measurement, no mutation testing, no cross-language conformance run.** The last of
  those is 4.1, which does not exist yet; this gate will need extending when it does.
- **Fork pull requests from first-time contributors need maintainer approval before any job runs**,
  so the gate reports nothing until someone clicks. That is GitHub's behaviour, not this workflow's,
  and it is why PR #5 shows no checks.

---

## References

- [ADR-0004](0004-build-toolchain-version-policy.md) — rule 4, the declared consumer floor.
- [ADR-0010](0010-lint-and-format-floor.md) — the lint job's tool and pin.
- `TASKS.md` 4.4, 4.5, 4.6 — the planned workflows this one stops short of, and 4.3 for the live job.
- `.github/workflows/sdks-ci.yml` — the workflow this record explains.
