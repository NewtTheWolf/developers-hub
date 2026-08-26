# ADR-0009: Webhook Receiver Package — `@turbosmtp/webhook`, Mirrored Like Any Other Unit

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-20 |
| **Applies to** | All SDKs (decisions 2 and 3); Node SDK (decisions 1 and 4); [ADR-0007](0007-sdk-packaging-granularity.md) carve-out 2; [ADR-0003](0003-sdk-repository-topology.md) mirror topology |

---

## Context

[ADR-0007](0007-sdk-packaging-granularity.md) carve-out 2 granted standing permission for a separate
webhook package per language. `sdks/packages/node-webhook/` is the first time that permission has
been exercised, and exercising it showed that three of the carve-out's four factual premises do not
hold for TurboSMTP:

> *"It has no HTTP surface, needs a crypto dependency, and is consumed by the receiving service rather
> than by the sender. […] It is absent from both the served spec and contract §6 today, so this
> carve-out grants permission and creates no work."*
> — ADR-0007, carve-out 2

- **"needs a crypto dependency"** — it does not. The package has zero runtime dependencies. Node's
  builtin `node:crypto` is used for exactly one call, `timingSafeEqual`, to compare Basic-auth
  credentials without a timing side channel. Nothing is installed.
- **"webhook signature verification"** — TurboSMTP does not sign webhooks. Authentication is HTTP
  Basic credentials embedded in the callback URL configured in the dashboard
  (`https://user:pass@host/hook`), which the receiver reads from the `Authorization` header. There is
  no signature, so there is nothing to verify. The behaviour is live-verified and documented in
  `sdks/packages/node-webhook/README.md`; it appears in no published TurboSMTP specification.
- **"creates no work"** — it created three items, all of which had to be resolved before the package
  could be installed by anyone: it has no mirror repository, `split-mirrors.yml` has no arm that
  routes its tags, and its npm name is already taken.

The premise that did hold is the one that matters: no HTTP surface, and consumed by the *receiving*
service rather than by the sender. That asymmetry is real and is why the split is still correct.

Because ADR-0007 is immutable, the correction cannot be made in place.

A second question surfaced with it. [ADR-0003](0003-sdk-repository-topology.md) mirrors all five
publishable units rather than only the two that force it, and ADR-0007 lists the resulting count as a
benefit of its own decision:

> *"**`MIRROR_TOKEN` scope stays narrow.** One publishable unit per language keeps ADR-0003's mirror
> count at five and the token's blast radius at what it is today."*
> — ADR-0007, Consequences

A sixth publishable unit contradicts that sentence as written, whether or not it is mirrored. So the
mirror question has to be answered deliberately rather than inherited.

---

## Decision

Decisions 1 and 4 are about the Node package in front of us. Decisions 2 and 3 are not: the first is
mirroring policy and the second is release machinery, and both bind all five SDKs the moment a
second language takes the carve-out.

### 1. The carve-out stands, on corrected grounds

`@turbosmtp/webhook` ships separately from `@turbosmtp/sdk`. The justification is **consumption
asymmetry**, not a dependency: a webhook receiver runs in the process that *accepts* HTTP from
TurboSMTP, which is frequently not the process that sends mail — a queue worker, a serverless
function, a separate analytics service. Bundling a full API client with credentials, region routing
and the whole `mail` surface into a service whose only job is to parse an inbound POST is the wrong
shape regardless of install weight.

The carve-out should be read as covering **webhook receivers**, not "webhook signature verification".
The narrower phrasing would exclude TurboSMTP's own webhooks, which are unsigned.

### 2. Mirror it, like every other publishable unit

The package is mirrored to `turbosmtp-node-webhook` on the same terms as the other five. ADR-0003's
reasoning applies unchanged:

> *"Mirroring only the two forced languages would leave Node, Python and C# without a discoverable
> public repository, and would make the release process differ per language for no benefit."*
> — ADR-0003

That argument is about discoverability and release uniformity. Neither depends on whether the unit is
a language SDK or a carve-out, and an npm-only unit would be the single publishable thing in the
program with no public repository behind its registry page.

ADR-0007's "count stays at five" is therefore **superseded in its arithmetic, not in its intent**. The
intent was that `MIRROR_TOKEN`'s blast radius must not grow with the *number of domains* — the
rejected option B/C figure was "roughly a dozen extra mirrors". One mirror for one carve-out is not
that; the guard against domain-per-package proliferation remains fully in force.

### 3. `split-mirrors.yml` resolves a package slug, not a language

The workflow derives `prefix=sdks/packages/$lang` from the tag prefix. A `node-webhook/v*` tag
resolves today only because the directory name happens to equal the tag prefix — the variable is
named `lang` and a reader would reasonably assume it holds one. The variable is renamed to `pkg` and
the `case` maps package slug to mirror. Adding the sixth arm without the rename would encode the
coincidence as if it were the design.

### 4. First published version is `0.2.0`

`@turbosmtp/webhook@0.1.0` was published by this organisation on 2026-08-05 and is part of the legacy
set being deprecated under [ADR-0006](0006-legacy-official-sdk-consolidation.md). npm never permits
republishing a version number, and ownership does not change that: `npm publish` returns
`403 You cannot publish over the previously published versions`. Deprecating flags a version, and
unpublishing — which is in any case closed after 72 hours — reserves the number permanently rather
than freeing it. `0.2.0` rather than `0.1.1` because this package shares nothing with its predecessor
but the name; a patch bump would imply continuity that does not exist.

---

## Rationale

### Why not fold the receiver into `@turbosmtp/sdk`

It would satisfy ADR-0007's headline rule and cost one mirror less. Rejected because the receiver has
no HTTP client, no credentials and no region — nothing it needs is in the client, and nothing in the
client is safe to require of a service that only parses inbound requests. Subpath exports
(ADR-0007 refinement 1) do not solve it either: the concern is not bundle size but that the two
halves are deployed to different processes with different secrets.

### Why not npm-only, without a mirror

It is the cheaper option and was seriously considered. Rejected on consistency: the release path would
diverge for exactly one unit, and the mirror is where `split-mirrors.yml`, tag translation and the
public-repository guarantee already live. Divergence here costs more in the long run than one entry
in `MIRROR_TOKEN`'s scope, and the four other languages will each face this question when their own
receivers land.

### Why this is not a flip of ADR-0007's triggers

None of the four triggers fired. Operation count did not grow, no billing or base-URL boundary
appeared, no consumer complained about install weight, and `turboSMTP-js` was not sanctioned. This
record corrects a carve-out's stated premises and settles a question it left open; the
one-unified-package rule for API domains is untouched.

---

## Consequences

### Positive

- The carve-out's justification now matches the provider: unsigned webhooks, no crypto dependency,
  receiver-side consumption.
- The package becomes installable. Before this record it had a name it could not publish under and no
  repository to resolve from.
- The four remaining languages inherit a decided position rather than re-deriving it, including the
  version-number trap.
- `split-mirrors.yml` says what it means, which makes the next non-language mirror a one-line change
  instead of a second coincidence.

### Negative / Constraints

- **`MIRROR_TOKEN`'s scope grows by one repository.** ADR-0003 already flags that credential as broad.
  The mitigation is unchanged: the guard is against per-domain proliferation, and this record does not
  weaken it.
- **A sixth mirror must be created before the first release tag.** `turbosmtp-node-webhook` does not
  exist yet; a `node-webhook/v0.2.0` tag pushed before it does will fail in the push step.
- **ADR-0007 now has a sentence that reads as false in isolation.** Mitigated by this record's
  reference from the index; ADR-0007 itself stays immutable. `sdks/index.md` carried the same claim
  in customer-facing form ("no need to install separate libraries per feature"); it is mutable, so
  it is corrected to speak of API domains rather than features.
- **Per-language divergence is possible.** Nothing here obliges Python, Go, PHP or C# to ship a
  receiver package. Where a language's idiom differs, this record is the precedent to argue against,
  not a mandate.

---

## References

- [ADR-0003](0003-sdk-repository-topology.md) — mirror topology; the "why mirror all five" reasoning.
- [ADR-0006](0006-legacy-official-sdk-consolidation.md) — deprecation of the legacy published packages.
- [ADR-0007](0007-sdk-packaging-granularity.md) — carve-out 2 and the mirror-count consequence.
- `client-contract.md` §7 — the discrepancy register. Webhooks are outside the contract's scope: it
  covers the API client surface, and the receiver has no operation in the served spec.
- `sdks/packages/node-webhook/README.md` — the receiver surface and Basic-auth flow.
- [npm: unpublishing packages from the registry](https://docs.npmjs.com/unpublishing-packages-from-the-registry)
  — the 72-hour window and the permanent reservation of published version numbers.
