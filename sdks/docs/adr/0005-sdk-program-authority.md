# ADR-0005: SDK Program Authority — `developers-hub/sdks/` Is the Decision Record

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-11 |
| **Applies to** | The whole SDK program — strategy, contract, process and rollout |

---

## Context

Until now the SDK program had **two parallel, unreconciled decision records**, and the one
holding formal authority was not the one doing the work.

**This repository (`developers-hub/sdks/`)** carries the executed strategy: `plan.md`, the
ratified `client-contract.md`, ADR-0001 through ADR-0004, a published-ready Node SDK with a
green conformance suite, and a mirror-split release pipeline proven end-to-end against
`turboSMTP/turbosmtp-node`.

**`turboSMTP/developer-ecosystem`** (private, no code) is the organisation's steering repo. It
governs by RFC-per-decision on the rule *merge = decided*. Its charter, RFC-0001 *"Program
vision & RFC roadmap"*, was accepted 2026-07-01 and its decision roadmap explicitly reserves a
row for **"SDK strategy: languages, modernize vs. new, OpenAPI-generated"**. That row's RFC
exists only as **PR #5 `docs(rfc): SDK strategy`, opened 2026-07-04 and still open with zero
review comments as of 2026-08-11**. PRs #2, #3 and #4 are likewise open since early July;
nothing has merged since #1. By that repo's own rule, SDK strategy was therefore *undecided* —
and had been for five weeks while implementation continued here.

This was discovered on 2026-08-11 during a registry reconnaissance run after task 2.5 (npm
publish) blocked on the `@turbosmtp` scope being held by a separate effort. The recon
established that the two tracks disagree on substance, not just on paperwork: PR #5 proposes
maintainer-gated ownership and **reuse-before-build** (modernize the three existing official
SDKs, adopt community clients, build new only as a last resort), whereas this effort builds
five new contract-conformant SDKs from the canonical OpenAPI spec.

Leaving both records live has a concrete cost. Every Phase 3 language decision would be gated
on a review queue in another repository that has produced no merges in five weeks, and any
outcome there could invalidate work already shipped here.

---

## Decision

**`developers-hub/sdks/` is the authoritative record for the TurboSMTP SDK program.** Its
contents remain valid and govern strategy, the client contract, and process:

| Artefact | Role |
|---|---|
| `sdks/plan.md` | Strategy, architecture, tooling, rollout tiers, fixed decisions |
| `sdks/client-contract.md` | The ratified, **review-gated** language-agnostic facade surface |
| `sdks/docs/adr/` | This series — the immutable decision record |
| `sdks/TASKS.md` | Executable checklist and per-task outcomes |
| `sdks/pipeline.md` | Operational flow, automated vs. manual |

**The `developer-ecosystem` RFC track is superseded for SDK matters.** That repository will be
deprecated; content worth keeping migrates here. SDK decisions are recorded as ADRs in this
series, not as RFCs elsewhere. No SDK work is gated on a merge in another repository.

### What migrates from the RFC track

Deliberately brief — the RFC track's detail is not tracked here. Four ideas from PR #5 are
worth carrying forward, recorded as **candidate inputs, not adopted decisions**:

1. **Maintainer-gated ownership** — no SDK ships without a named owner. This effort currently
   has no maintainer model; the gap is real and worth closing on its own merits.
2. **Rust as a candidate sixth language**, beyond the five in `plan.md`.
3. **Adopt-vs-build for community clients** — where a community client is stronger than ours,
   consider making it official rather than competing with it. The concrete PHP candidates are
   `magexon/turbosmtp-php` and `emiliort/turbosmtp-mailer`.
4. **"An official SDK that rots is worse than none."** PR #5's own framing of the three stale
   official SDKs as *"the very failure mode we want to avoid, already happening in our own
   org."* [ADR-0006](0006-legacy-official-sdk-consolidation.md) acts on exactly this.

Adopting any of these requires its own ADR, and (2) additionally requires a `client-contract.md`
amendment through the existing review gate.

### Explicitly out of scope

**`turboSMTP-js` and the `@turbosmtp` npm scope are not covered by this ADR.** They are a
separate, unresolved organisational question. Task 2.5 stays **BLOCKED** on scope access — this
ADR narrows that block from an unknown to a recorded scope boundary, and does not resolve it.
Note that PR #5's own proposal calls for *one* runtime-agnostic TypeScript package, while the
published `@turbosmtp/mail` + `@turbosmtp/webhook` are two — so the npm packages diverge from
the RFC that would have governed them.

---

## Rationale

### Why this repository rather than the RFC track

The authority claim matches where the work, the evidence and the constraints actually live.
This repo holds a ratified contract, four ADRs grounded in verified failure modes (Packagist's
subdirectory limitation, Go's case-sensitive module paths, TypeScript's non-semver releases), a
tested SDK and a proven release pipeline. The RFC track holds one merged charter and four
stalled pull requests. Recording decisions where they are researched and executed keeps context
and consequence in one place, which is the whole premise of an ADR series.

### Why not run both records

Two live records with no precedence rule is the situation that produced the 2.5 collision: work
shipped on both sides, under two different sets of assumptions, discovered only at a publish
step. One record with an explicit supersession is the cheapest way to prevent a repeat.

### Why the RFC track's substance is preserved rather than discarded

Its analysis was sound — the stale-SDK diagnosis is correct and is the direct basis for
ADR-0006, and its maintainer-gating concern identifies a genuine gap here. This ADR supersedes
the RFC track's *authority*, not its reasoning.

---

## Consequences

### Positive

- One decision record. Phase 3 language selection is decided here, on evidence in this repo.
- No cross-repo governance dependency; no SDK task waits on another repository's review queue.
- The ADR series stays the single place a future contributor reads to understand why the SDKs
  are shaped as they are.
- The RFC track's useful conclusions survive as recorded candidate inputs rather than being
  lost when that repository is deprecated.

### Negative / Constraints

- **This is a unilateral supersession from this repository's side.** Closing PR #5, migrating
  content and deprecating `developer-ecosystem` are actions in that repository, not this one,
  and are not performed by this ADR. Until they happen, a reader of that repo sees a live SDK
  strategy RFC that no longer governs.
- **The maintainer-gating gap is now explicit and unaddressed.** Asserting authority means
  owning the concern PR #5 raised: five SDKs with no named owners is the same
  looks-official-and-rots risk that ADR-0006 deprecates three repos for. Needs its own ADR.
- **`turboSMTP-js` remains unreconciled**, and with it task 2.5. This ADR bounds the problem
  without solving it.
- Two candidate inputs (Rust; adopt-vs-build) are now recorded but undecided, which is a small
  amount of deliberate open state.

---

## References

- `sdks/plan.md` — fixed decisions and rollout tiers
- `sdks/client-contract.md` — the ratified contract; §6 canonical package names
- [ADR-0006](0006-legacy-official-sdk-consolidation.md) — legacy official SDK consolidation, which this ADR's authority makes actionable
- [ADR-0003](0003-sdk-repository-topology.md) — repository topology and mirrored publishing
- `sdks/TASKS.md` 2.5 — the npm scope block that prompted the reconnaissance
- `turboSMTP/developer-ecosystem` — RFC-0001 (accepted 2026-07-01); PR #5 *SDK strategy* (open, unreviewed, 2026-07-04)

