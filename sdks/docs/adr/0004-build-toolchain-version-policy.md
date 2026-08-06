# ADR-0004: Build Toolchain Version Policy

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-05 |
| **Applies to** | All SDK packages (`sdks/packages/*`) — compilers and build tooling, not runtime dependencies |

---

## Context

The SDKs ship **zero runtime dependencies** by design, so a consumer's dependency tree is unaffected
by our choices. Build toolchains are different: the compiler that produces a package is invisible to
consumers *until it isn't*. It determines the shape of the published type declarations, the language
level of emitted code, and the metadata in the distributable — all of which are then read by the
**consumer's** toolchain, which is frequently older than ours.

This surfaced concretely while preparing the first Node release. Two distinct problems appeared in
sequence:

1. The Node package pinned `typescript: ^5.4.0`, which resolved to 5.9.3. That version accepted a
   compiler option (`moduleResolution: node10`) that is removed in TypeScript 7. CI was green while
   the editor — running a newer compiler — was correctly reporting a future build failure. **A
   permissive range hid a breaking change rather than surfacing it.**
2. Fixing it meant choosing a new range, which exposed the underlying question: TypeScript does not
   follow semantic versioning. Its minor releases carry documented breaking changes, so a caret range
   grants permission for the build to break unattended.

Both problems generalise. Every language in the suite has a build toolchain with the same
characteristics, and without a stated policy each of the five will resolve this independently and
inconsistently, at four different times, by whoever happens to set that package up.

---

## Decision

**1. Pin build toolchains to a patch-only range.** Use `~` or the ecosystem's equivalent. Never a
range that permits minor upgrades (`^` and equivalents). Toolchain minors are treated as potentially
breaking regardless of what the version number implies.

**2. The floor is the exact version validated, not the start of the line.** If 7.0.2 is what was
tested, the range is `~7.0.2` — not `~7.0.0`. Earlier patches in the same line are untested and
usually exist because the `.0` release had defects.

**3. Lockfiles handle reproducibility; ranges express upgrade policy.** Where the ecosystem has a
lockfile it is committed, and it — not the range — guarantees that CI and developers build
identically. The declared range therefore governs only what a deliberate update command is permitted
to do.

**4. Each package declares a minimum supported *consumer* toolchain version.** This is distinct from
the version used to build, and it is the version the check below runs against.

**5. Toolchain upgrades are deliberate and gated.** A compiler bump is never incidental to another
change, and must pass the consumer-floor check before it ships.

### The consumer-floor check

The reusable part of this decision. Verifying against the source tree is insufficient, because it
tests neither the distributable nor the resolution path a consumer actually takes.

1. Build the package with the new toolchain.
2. Produce the **real distributable artifact** — the packed archive, wheel, assembly, or module zip
   that would be published, not the working directory.
3. Install that artifact into a scratch consumer project outside the repository.
4. Exercise **every documented consumption path** against the declared minimum consumer toolchain —
   each import or module system the package claims to support, and each type-resolution mode.
5. Confirm the public surface is unchanged: the exported symbol set before and after must match.

A failure at step 4 is the failure mode this policy exists to prevent: it does not break our build,
so it reaches users as a bug report rather than a red pipeline.

---

## Rationale

### Why patch-only rather than permissive ranges

| Concern | Detail |
|---|---|
| **Toolchains are not bound by semver** | TypeScript states plainly that it does not follow semantic versioning; 5.5, 5.6 and 5.7 each shipped documented breaking changes. A caret range on such a tool grants standing permission for an unattended break. |
| **The failure is delayed and misattributed** | A permissive range breaks on some future unrelated `install`, in whichever pull request happens to refresh the tree — far from the change that caused it. |
| **Silence is the actual hazard** | The Node instance was not a build failure; it was a *green* build masking a removed option. Permissive ranges resolve upward silently, so the problem appears only when the gap becomes fatal. |
| **The cost of the alternative is trivial** | A patch-only range costs one deliberate edit per minor upgrade. That edit is exactly the review moment this policy wants. |

### Why the build compiler and the consumer compiler must be tested separately

They are different programs solving different halves of the problem. Ours emits declarations and
compiled output; the consumer's *parses* them, usually at an older version, and often through a
resolution algorithm we did not use. Passing our own type-check proves only that we can read our own
source — it says nothing about whether a user two minor versions behind can read our published
artifact.

### Why not simply track the latest toolchain

Tempting, and wrong for a published library. The artifacts are consumed by a long tail of users on
older toolchains; tracking latest optimises for our convenience and exports the risk to them. It also
makes every build non-reproducible against its own history.

---

## Consequences

### Positive

- Compiler upgrades become visible, reviewed events rather than ambient drift.
- Consumers are insulated from build-side toolchain churn, and the insulation is *verified* rather
  than assumed.
- One recipe is reused across all five languages instead of five independent judgement calls.
- The policy is version-agnostic, so it does not need revising when a toolchain releases.

### Negative / Constraints

- **Patch-only ranges do not upgrade themselves.** Without periodic deliberate maintenance the
  toolchains drift and eventually fall out of support. Automated dependency alerts can surface a new
  minor, but merging it remains a decision, not a rubber stamp.
- **A declared consumer floor is an ongoing commitment.** It must be chosen per language, honoured,
  and raised deliberately — raising it is a breaking change for some users.
- **The consumer-floor check is manual today.** It requires a scratch project and several
  invocations per release.

### Future evolution path

Fold the consumer-floor check into the shared conformance matrix (`TASKS.md` 4.1) and per-language
publish CI (4.6), so it executes automatically on every release rather than depending on someone
remembering to run it. That is the point at which this policy becomes self-enforcing; until then it
is a convention held by review.

---

## References

- `sdks/TASKS.md` 2.5 — the Node instance that produced this policy, including the executed
  verification and its results
- `sdks/TASKS.md` 4.1 / 4.6 — conformance matrix and publish CI, where the check should eventually live
- `sdks/plan.md` — zero-runtime-dependency constraint that makes build tooling the only version
  surface consumers can be exposed to
- [TypeScript: breaking changes by release](https://github.com/microsoft/TypeScript/wiki/Breaking-Changes) — the concrete precedent for treating toolchain minors as breaking
