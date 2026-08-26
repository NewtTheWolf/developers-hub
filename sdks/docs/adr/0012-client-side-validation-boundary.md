# ADR-0012: Client-Side Validation Boundary — Guard What the SDK Transforms, Forward What It Does Not

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-21 |
| **Applies to** | All five SDKs; `client-contract.md` §3.4 and §4.1 |

---

## Context

Reviewing PR #5 raised a question the SDK program has never answered: should a facade enforce a
field's presence itself, or stay thin and let the server be the authority?

The trigger was concrete. `from` and `to` are typed as required, but the Node package ships CJS and
ESM to JavaScript consumers who get no type check, and the facade dereferences both while mapping
them onto the wire model. An omitted field faulted as
`TypeError: Cannot read properties of undefined (reading 'address')` — a message naming an internal
property, thrown from outside the `try` block, and outside the single typed hierarchy
`client-contract.md` §3.4 promises.

The narrow fix is a guard. The general question is where guards stop, and without a stated rule each
of the five SDKs will answer it independently: one adds presence checks to every field, another adds
none, and the contract's promise of one hierarchy erodes in different directions per language.

The rule below was proposed by @sergio-matteoda on that thread:

> *"An SDK MUST NOT validate a field it passes to the wire unchanged — the server is the authority
> and its response is the correct error. An SDK MUST guard a field it dereferences or transforms
> before sending, because a fault there is the SDK's own and never reaches the server. Presence and
> format constraints belong in the OpenAPI spec, not in facade code. Where the server's error for an
> invalid field is unclear, the fix is the server's message."*

Held against every caller-supplied value the Node facade dereferences or transforms today, it
decides two cleanly, decides two by its conclusion while its stated reason does not fit, is silent
on a fifth, and exposes a sixth that had no guard at all:

| Transformed input | Under the rule as proposed |
|---|---|
| `from` / `to` presence (`mail.ts`) | Fits. Both are dereferenced; the fault is the SDK's and never reaches the server |
| `to: []` forwarded to the server's 400 | Fits. Transformed but not faulting, so the server answers |
| Comma in a recipient display name (`address.ts`) | Conclusion fits, reason does not |
| CR/LF in an address or display name (`address.ts`) | Conclusion fits, reason does not |
| `region` and credentials (`client.ts`) | Not covered |
| `headers` names and values (`mail.ts`) | Unguarded. Merged, walked and emitted as MIME header pairs, with CR/LF passing through |

The last row is the reason the table is keyed by input rather than by guard. A first pass of this
audit enumerated the guards that existed and checked each against the rule; run that way it can
only find a guard that should not be there, never a field that should be guarded and is not. The
review of PR #5 probed the built facade and found `headers: { 'X-Foo': 'bar\r\nBcc: evil@…' }`
sent verbatim, name and value both, while the five address fields beside it were guarded.

The comma case transforms and the fault **does** reach the server, which rejects it as
`'"Doe' 'to' email not valid`. Clause 2's reason ("never reaches the server") therefore does not
justify the guard that clause 2's conclusion requires, and clause 4 read strictly says the fix
belongs in the server's message instead.

The CR/LF case is not about an SDK fault or an unclear message at all. The values are carried into
MIME headers, so a line break in caller-supplied text is header injection. Clause 3 would route it
to the spec, but a `pattern` in a specification does not stop a facade from concatenating caller
text into a header.

`region` and the credential pair are not wire fields. Both are constructor configuration, and the
`region` check exists because an unrecognised value left the base URL unset and the generated core
fell back silently to a different host — a defect with no server response to defer to, because the
request reached the wrong server successfully.

---

## Decision

**The rule is adopted, with its reason for clause 2 restated and two clauses added.** As adopted:

**1. An SDK MUST NOT validate a field it forwards to the wire unchanged.** The server is the
authority and its response is the correct error. A facade that re-implements the server's
constraints drifts from them silently and fails requests the server would have accepted.

**2. An SDK MUST guard a field it dereferences or transforms before sending.** The trigger is the
transformation, not where the failure surfaces. Once the facade reads into a value or reshapes it,
the SDK owns what the server receives, and a defect there is either invisible to the server or
reported by it against a value the caller never wrote.

**3. Presence and format constraints belong in the OpenAPI spec, not in facade code.** Where a
constraint is expressible in the spec, it is expressed there and inherited by all five SDKs through
Layer 1 rather than written five times in five facades.

**4. Where the server's error for an invalid field is unclear, the fix is the server's message** —
and a facade guard is a stopgap that records the defect rather than a substitute for it. A guard
adopted under this clause MUST cite a numbered discrepancy in `client-contract.md` §7, so it is
removable when the server improves.

**5. Security guards are not validation and are not subject to clause 1.** Where caller-supplied
text reaches a protocol boundary the SDK constructs — a MIME header, a URL, a shell — the SDK MUST
reject what would let the caller alter that structure, whether or not the server would also reject
it. The server's judgement is irrelevant here: the vulnerability is the SDK's, and a message
declining to send is a correct outcome.

**6. This governs wire fields.** Constructor configuration is outside it and is validated eagerly:
it is chosen once, it selects hosts and credentials rather than travelling as data, and its failures
produce successful requests to the wrong place rather than errors to defer to.

---

## Rationale

### Why the transformation, not the destination, is the right trigger

Clause 2's original reason and its conclusion diverge in exactly the case that produced this ADR's
sharpest example. TurboSMTP splits `to`, `cc` and `bcc` on commas before parsing RFC 5322 quoted
strings, so `"Doe, Jane" <a@x.com>` is torn in half and rejected. The SDK constructed that quoted
string from a structured address the caller supplied, so the value the server complains about is one
the caller never wrote, and the server's message quotes a fragment of it. The fault reaches the
server, and the guard is still right.

Restating the trigger as the transformation covers this without weakening clause 1: a field the SDK
forwards untouched still belongs to the server, and nothing here licenses re-implementing its
constraints.

### Why security needs its own clause rather than an exception

Clause 1 is a statement about *authority* — who decides whether a value is acceptable. Clause 5 is a
statement about *structure* — whether the caller can change the shape of what the SDK builds. These
do not trade off. A server that happily accepted a CR in a display name would make the SDK an
injection vector rather than making the guard unnecessary, so deferring to it is the wrong move even
when it is the permissive one.

Routing this to the spec, as clause 3 would, does not work either. A `pattern` constrains what a
document says is valid; it does not constrain what a facade does with a string on its way into a
header it assembles itself.

### Why configuration is excluded rather than merely unmentioned

The failure mode is different in kind. An invalid wire field produces an error response to map. An
invalid `region` produced a *successful* request to `pro.api.serversmtp.com` instead of the intended
send host — no error to defer to, no response to map, and a developer with no signal at all. The
rule's whole structure assumes a server response exists to be the authority; where none does, the
rule cannot apply and eager validation is the only option.

### Why this is worth a record rather than a contract line

It decides a class of question rather than a case, it will be applied by four teams that were not in
the conversation, and clause 4's stopgap framing means guards adopted under it are meant to be
removed later. A record carries the reasoning; `client-contract.md` §4 carries the resulting rules.

---

## Consequences

### Positive

- The five facades converge on one answer instead of five, and the answer is stated before four of
  them are written.
- Every existing Node guard is either justified or explicitly out of scope, with no guard surviving
  on habit.
- Clause 4 makes provider-workaround guards self-documenting and self-retiring: each one points at a
  discrepancy, and the discrepancy is the thing to fix.
- Clause 3 pushes constraints toward the spec, where they reach all five languages through
  regeneration rather than five hand-written implementations.

### Negative / Constraints

- **Clause 5 is a judgement call at the margin.** "A protocol boundary the SDK constructs" is
  narrower than "anything unsafe", but it still needs a reviewer's judgement per case. That is
  accepted as preferable to enumerating boundaries in advance.
- **Clause 4 creates an obligation the SDK program cannot discharge alone.** Filing a discrepancy is
  ours; improving the server's message is not, so some stopgaps will be long-lived.
- **Existing facade code must be audited as each language lands**, not only new code, and the
  audit enumerates **every caller-supplied value the facade dereferences or transforms**, not the
  guards that already exist. The first direction finds missing guards; the second can only find
  surplus ones. Node's audit is the table above, and its `headers` row is the case the wrong
  direction missed.
- **`client-contract.md` §4.1 currently states the comma rule without citing the discrepancy that
  clause 4 now requires.** It cites discrepancy 13 in §7, so the citation exists; whether the
  wording satisfies clause 4 is a contract-amendment question rather than an ADR one.

---

## References

- PR #5, thread on `sdks/packages/node/src/mail.ts` — where the rule was proposed and the `from`/`to`
  fault was found.
- `client-contract.md` §3.4 — the single typed error hierarchy a `TypeError` escapes.
- `client-contract.md` §4.1 — address formatting rules, including the comma and CR/LF cases.
- `client-contract.md` §7 — the discrepancy register clause 4 requires guards to cite; discrepancies
  12 (region fallback) and 13 (comma splitting) are the two this ADR reasons from.
- [ADR-0005](0005-sdk-program-authority.md) — why SDK decisions are recorded here rather than settled
  per language.
