# TurboSMTP SDK — The Semantic Layer

> The semantic layer is the language-agnostic definition of what every TurboSMTP SDK must do, and
> the **common ground for Layer 2 (facade) generation** across every supported language.
>
> Its sections are deliberately unnumbered. Nothing outside this document references a section of
> it, so there is no numbering to preserve and it can be reorganised whenever that serves a reader.
>
> **Reading order:** orientation first, then detail — what this governs, which namespaces exist, the
> conventions every domain obeys, the Mail domain in full, how it is verified, and the register of
> spec-vs-reality gaps. Each section also stands on its own if you jump straight to it.

**Sections**

- [Scope & what it governs](#scope--what-it-governs) — what this binds, and what it leaves to Layer 1.
- [Namespaces & domain coverage](#namespaces--domain-coverage) — which namespaces exist, and which package carries them.
- [Cross-cutting conventions](#cross-cutting-conventions) — naming, auth, region, errors, pagination, retries.
- [Mail domain (full detail)](#mail-domain-full-detail) — parameters, wire mapping, return shape, errors, inline images.
- [Mail conformance scenarios](#mail-conformance-scenarios) — what every SDK's tests must assert.
- [Discrepancies register](#discrepancies-register) — spec-vs-reality gaps the facade papers over.

## Scope & what it governs

This defines the **single, canonical developer-facing surface** for the TurboSMTP client libraries,
independent of any one language's idioms. It exists to:

- guarantee cross-language consistency (same namespaces, methods, params, returns, errors);
- serve as the reference for the shared conformance test matrix
  ([Mail conformance scenarios](#mail-conformance-scenarios));
- prevent OpenAPI Generator's per-language naming conventions from drifting apart.

**What it governs:** the **Layer 2 facade** surface — everything a developer touches. It does
**not** dictate Layer 1 (generated) internals, which are per-language and regenerated from the spec,
nor how Layer 3 (the conformance suite) is run — only what that suite must assert.

**Spec source of truth:** the synced OpenAPI 3.1 copy under `../api-integrations/upstream/`. Every
field, enum, host and status code below traces to it. Where the API's real behaviour differs from
the spec, the difference is recorded in the [Discrepancies register](#discrepancies-register) and
corrected upstream — never absorbed silently.

## Namespaces & domain coverage

The only namespace specified so far is **`mail`**.

> **Namespaces are a *surface* guarantee, independent of distribution granularity.** This fixes what
> a developer reaches (`client.mail`) and says nothing about how many packages the surface arrives
> in. A change to a *distribution* name is not a change to an *import* name.

| Namespace | Domain | Auth path | Status |
|---|---|---|---|
| `mail` | `/mail/send` | consumerKey+secret | built; not yet published |

**Which distribution carries which namespace.** The `mail` namespace ships in the mail package
(`@turbosmtp/mail`). Every other namespace, once specified, ships in a separate unified package
(`@turbosmtp/sdk`); the two are independent — neither depends on the other, and the unified package
is not a superset.

Because the packages are independent, each carries its own copy of the
[error taxonomy](#error-taxonomy): an error
class from the mail package and the same-named class from the unified package are **distinct
types**, and an `instanceof` or equivalent type check written against one does not match the other.
A consumer using both handles each package's errors separately, and no SDK presents them as
interchangeable.

**Coverage caveat — orphaned operations (do NOT promise in any SDK).** These are defined in the
upstream domain files but never wired into the root `paths:`, so they are pruned from the served
bundle and are **not SDK-coverable** until fixed upstream in `turbo-smtp-openapi/`:
`AuthenticationLoginByAPIKey`, `AuthenticationLogoutByAPIKey`, `getUserInfo`,
`createContactBilling`, `deleteContactBilling`, `getContactsBilling`, `getPersonalDetailsBilling`,
`updateContactBilling`, `updatePersonalDetailsBilling`. Nothing here may expose them, and an
operation is checked against the **served bundle**, never against the domain files, before an SDK
commits to it. This list changes whenever the upstream wiring does.

## Cross-cutting conventions

### Naming map

One concept, one idiomatic spelling per language. The **canonical client class is `TurboSMTPClient`** in every
language (idiomatic casing applies).

| Concept | Node/TS |
|---|---|
| Client class | `TurboSMTPClient` |
| Constructor | `new TurboSMTPClient(opts)` |
| Mail namespace | `client.mail` |
| Send method | `mail.send(msg)` |
| Async convention | Promise |
| `from` field | `from` |
| Mail package | `@turbosmtp/mail` (npm) |
| Unified package | `@turbosmtp/sdk` (npm) |

Notes:
- Initialization is a **single options object passed to the constructor** (see
  [Auth model](#auth-model)).

### Auth model

The facade **hides this entirely**. The developer supplies one credential object; the SDK attaches
the correct headers per operation, so which scheme an endpoint takes is never something a caller
has to learn.

**Current credential shape — `consumerKey` + `consumerSecret` only:**

```
TurboSMTPClient({
  consumerKey:    "…",   // required
  consumerSecret: "…",   // required
  region:         "global" | "eu",   // optional, default "global"
  // transport seam — Node: fetchApi
})
```

> **Transport tuning is not specified yet.** A request timeout with a documented, overridable
> default is a requirement this layer still owes: no SDK implements one today. It will be added to
> the shape above, with the default stated. Retry tuning is deliberately absent rather than
> pending — `/mail/send` is not idempotent and is never retried automatically, so the Mail domain has nothing to
> configure.

- Every operation today sends **both** `consumerKey` and `consumerSecret`; the SDK never sends `Authorization`.
- When a future domain requires `Authorization`-only operations, the credential object gains an optional `apiKey` field, added without changing the shape above.

### Region model

Region is a **constructor option**, an enum: **`global`** (default) or **`eu`**.

Region affects **only the `/mail/send` host** today. Every other operation always uses the global
API server. Hosts (from the spec):

| Scope | Host | Applies to |
|---|---|---|
| Global API | `https://pro.api.serversmtp.com/api/v2` | all operations **except** `/mail/send` |
| Send — Global (default) | `https://api.turbo-smtp.com/api/v2` | `/mail/send` when `region = "global"` |
| Send — EU | `https://api.eu.turbo-smtp.com/api/v2` | `/mail/send` when `region = "eu"` (EU data residency) |

An unrecognised `region` **MUST be rejected at construction** with the SDK's base error, rather
than left to fall through: an unset base URL resolves to the global API host, which does not serve
`/mail/send`, so the request succeeds against the wrong server
([discrepancy 12](#discrepancies-register); scenario 11).

### Error taxonomy

The spec has **no unified error envelope** — several distinct shapes (`CommonMessageResponseBody`,
`AuthorizationError`, and a send-specific `errorCode`/`details` body) — and defines only
`200/201/400/401/403/404`. There is **no `422`, `429`, or `5xx`** and **no rate-limit headers**,
even though prose says `/authorize` is rate-limited. The facade normalizes all of this into one
typed hierarchy (idiomatic per language — subclasses in Node/Py/C#/PHP, error values/`errors.As` in
Go):

```
TurboSMTPError                 (base — all SDK errors)
├── AuthenticationError        401
├── BadRequestError            400  (carries errors[] and/or details)
│   └── ValidationError        400  (input-validation subset, when distinguishable)
├── ForbiddenError             403
├── NotFoundError              404
├── RateLimitError             429  (defensive — spec omits it; carries retryAfter if present)
├── ApiError                   other non-2xx / 5xx (carries status + raw body)
└── NetworkError               transport/timeout/DNS (no HTTP response)
```

Every error carries: `status` (HTTP code, or null for `NetworkError`), `message`, and `raw` (the
undecoded body). Raw→typed mapping:

| Raw source | Typed error | Notes |
|---|---|---|
| 401 `AuthorizationError` (`missing_/invalid_authorization_key`) | `AuthenticationError` | shared `Unauthorized` response |
| 401 send-specific `{ errorCode, message, details }` | `AuthenticationError` | `errorCode`/`details` preserved |
| 400 send-specific `{ message, errors[] }` | `BadRequestError` | `errors[]` preserved |
| 400 `Common…BadRequestResponseBody` / domain 400 enums | `BadRequestError` / `ValidationError` | enum message preserved |
| 403 `ForbiddenForActivePlan` / `wrong_credentials_specified` | `ForbiddenError` | |
| 404 `CommonMessageResponseBody` (`*_not_found`) | `NotFoundError` | |
| 429 (undocumented) | `RateLimitError` | handled defensively; honors `Retry-After` if returned |
| 5xx / unmapped | `ApiError` | |
| no response | `NetworkError` | |

### Pagination framework

List endpoints use a `{ count, results }` body with `page`/`limit` **query params** (defaults
`page=1`, `limit=10`; from `PageQueryParam`/`LimitQueryParam`). There is **no total-pages field and
no cursor** — end-of-data is inferred when a page returns fewer than `limit` results.

The facade exposes, for every paged domain method, an **auto-pagination iterator** (async iterator /
generator / `range`-style channel / `Iterator` per language) that transparently walks pages. Manual
`page`/`limit` access remains available. **Mail has no paged endpoint** — this framework is defined now
so future domain additions are drop-in.

### Retries & backoff

Configurable via `maxRetries` (default small, e.g. 2); currently applies only to `GET`. A `429` on
`/mail/send` is not retried — it surfaces as `RateLimitError`.

## Mail domain (full detail)

**Namespace:** `mail`. **Method:** `send`. **Backing operation:** `sendEmail` — `POST /mail/send`,
request schema `MailMessage`, success `SendSucessResponsetBody`.

### Parameter shape (idiomatic facade)

| Facade param | Type | Required | Meaning |
|---|---|---|---|
| `from` | Address | **yes** | sender (see **Address** below) |
| `to` | AddressInput | **yes** | recipients (min 1) |
| `cc` | AddressInput | no | copy recipients |
| `bcc` | AddressInput | no | blind copy recipients |
| `subject` | string | no | ≤ 700 chars |
| `text` | string | no | plain-text body |
| `html` | string | no | HTML body |
| `replyTo` | AddressInput | no | first-class Reply-To address |
| `headers` | map<string,string> | no | additional custom headers (escape hatch) |
| `attachments` | Attachment[] | no | see below |
| `referenceId` | string | no | echoed in the Event Webhook |
| `campaignId` | string | no | campaign identifier |
| `mimeRaw` | string | no | raw MIME that **replaces** `text`+`html` |

**Address** (facade): either a **pre-formatted string** (`user@example.com` or
`Name <user@example.com>`) or a **structured address** `{ address: string, name?: string }`.
**AddressInput** is one Address or a collection of them, in whatever form is idiomatic for the
language (array, varargs, list).

Formatting rules, normative:

- A pre-formatted string is passed to the wire **verbatim**. The caller owns its formatting.
- A structured address without a `name` serializes to the bare address.
- Except for recipient comma names below, a structured address whose `name` contains an RFC 5322 §3.2.3 **special**
  (`( ) , . : ; < > @ [ ] " \`) MUST be emitted as a **quoted string**, with embedded `"` and `\`
  backslash-escaped. Quoting is what keeps a name like `Dr. Smith` intact in `from` and `reply-to`;
  see the comma rule below for why it is not sufficient in the recipient fields.
- A `name` free of specials is emitted unquoted.
- A **structured address** whose `name` contains a **comma MUST use RFC 2047 UTF-8 encoded words**
  for the display name in `to`, `cc` and `bcc`. Each encoded word MUST be at most 75 characters,
  contain complete UTF-8 characters, and decode to its original part of the name. Adjacent encoded
  words are separated by a space. **Live-verified 2026-10-16:** quoted names still fail because the
  API splits recipients on commas before parsing them; encoded names are accepted and retain their
  decoded display names in delivered mail, including Unicode names on the Global and EU hosts.
  `from` and `replyTo` are not comma-split and MUST keep the quoted form.
- Encoding applies only to structured `name` values. **Pre-formatted strings MUST remain verbatim**,
  including comma-separated recipient lists. A caller who hand-writes `'"Doe, Jane" <a@x.com>'`
  therefore receives the API's `400`; use a structured address to let the SDK encode the name.
- An address or display name containing **CR or LF MUST be rejected** with the SDK's base error.
  The API carries these values into MIME headers, so a line break in caller-supplied text is
  header injection; quoting does not neutralise it. This applies to `from`, `to`, `cc`, `bcc` and
  `replyTo`, to pre-formatted strings as well as structured addresses, and to every `headers`
  name and value, which the facade turns into a MIME header pair directly. The trigger is whether
  the SDK constructs the header pair, not merely whether caller-supplied text eventually lands in
  one. Validate these values **before encoding** a display name, so encoding cannot hide an injection.

**Reply-To limitation (live-verified 2026-10-16):** the facade accepts an `AddressInput`, but the API
retains only the first Reply-To address in delivered mail. Both address orders were tested. Use a
single address; accepting a list at the SDK boundary does not imply end-to-end support for multiple
Reply-To addresses. The existing input type is retained for compatibility.

**Attachment** (facade): `{ content: bytes, filename: string, contentType: string, contentId?: string }`.
The SDK base64-encodes `content` — the developer never handles base64.

### Mapping → `MailMessage` (Layer 2 → wire)

| Facade | → | `MailMessage` / `attachment` field | Transform |
|---|---|---|---|
| `from` | → | `from` | **Address → formatted string** |
| `to` / `cc` / `bcc` | → | `to` / `cc` / `bcc` | **AddressInput → comma-joined CSV of formatted addresses** |
| `subject` | → | `subject` | passthrough |
| `text` | → | `content` | rename |
| `html` | → | `html_content` | rename, then qualify inline `cid:` references |
| `replyTo` | → | `custom_headers["reply-to"]` | format, then inject into header map |
| `headers` | → | `custom_headers` | merge; an explicit `replyTo` replaces any `reply-to` key **regardless of casing** (header names are case-insensitive, so leaving another spelling in place emits two Reply-To headers) |
| `attachments[].content` | → | `attachments[].content` | **bytes → base64** |
| `attachments[].filename` | → | `attachments[].name` | rename |
| `attachments[].contentType` | → | `attachments[].type` | rename |
| `attachments[].contentId` | → | `attachments[].content_id` | rename; the wire value stays **bare** |
| `referenceId` | → | `reference_id` | rename |
| `campaignId` | → | `X-campaign-ID` | rename |
| `mimeRaw` | → | `mime_raw` | passthrough |

Not exposed as first-class params (available via `headers`/`mimeRaw`): `List-Unsubscribe`,
`X-Entity-Ref-ID`, tracking headers. No template or scheduled-send fields exist in the spec.

### Return shape

`SendSucessResponsetBody` is `{ message: string, mid: int64 }`. The facade returns:

```
SendResult { messageId: string }
```

- `messageId` = `mid` **stringified**. `mid` is an int64, which is unsafe as a JavaScript `number`;
  every language returns it as a string so the surface is identical across every language.
- `message` (e.g. `"OK"`) is not surfaced as a primary field; SDKs may expose it as `SendResult.raw`
  but the contracted, tested field is `messageId`.

### Errors

`/mail/send` uses two send-specific shapes, mapped per the [Error taxonomy](#error-taxonomy):

- **400** `SendBadRequestResponseBody` `{ message, errors[] }` → `BadRequestError` (exposes `errors[]`).
  The facade MUST flatten nested error arrays into a string list, keeping strings in order and
  excluding non-string entries. The original parsed response remains unchanged in `raw`.
  Real messages include invalid/missing sender or recipients, `Invalid Mime`, and `nocredit`.
- **401** `SendUnauthorizedResponseBody` `{ errorCode, message, details }` → `AuthenticationError`
  (preserves `errorCode`/`details`).

### Inline images (provider quirk — normative)

An attachment carrying a `contentId` is an inline part. The wire field `content_id` is sent **bare**,
but TurboSMTP composes the actual MIME Content-ID as **`<content_id@SENDER_DOMAIN>`**. A bare
`<img src="cid:logo">` reference therefore never matches, and the image is delivered as an ordinary
attachment instead of rendering inline. This is the single most common inline-image defect against
this API, and it is not described in the published documentation.

Every facade **MUST** therefore rewrite the HTML body before sending: for each attachment declaring a
`contentId`, replace `cid:<id>` with `cid:<id>@<sender-domain>`, where `<sender-domain>` is the domain
of `from` (parsed from the address, whether given bare or as `Name <user@example.com>`).

Rules:

- Matching **MUST NOT** rewrite an id that is a prefix of a longer one — `cid:logo` must be left alone
  inside `cid:logo2`.
- Every occurrence of a given id is rewritten, not only the first.
- The rewrite is **suppressed**, leaving the body untouched, when the id already contains `@`, when
  there is no HTML body, or when `from` has no parseable domain.
- The wire `content_id` is **never** modified; only the HTML reference gains the domain.

Callers keep writing the natural `cid:<id>` form; the qualification is the SDK's job.

## Mail conformance scenarios

Every SDK's conformance tests (Layer 3) must cover these **11 scenarios**, which pin down the rules
set out above. What each one asserts is fixed here; how the tests are run, gated and reported is not
this document's concern.

| # | Scenario | Asserts |
|---|---|---|
| 1 | **Minimal send** — `from`, `to`, `subject`, `text` | 200; returns `messageId` (non-empty string); body maps to `MailMessage` with `content` set |
| 2 | **HTML send** — `from`, `to`, `subject`, `html` | 200; `html` maps to `html_content`; `content` omitted |
| 3 | **Multi-recipient arrays**: `to`/`cc`/`bcc` as arrays of ≥2, mixing plain and structured addresses | serialized request has comma-joined CSV strings; structured comma names use RFC 2047 UTF-8 encoded words of at most 75 characters that preserve the name and do not split a UTF-8 character; other specials are quoted and escaped; pre-formatted strings stay verbatim |
| 4 | **Reply-To mapping** — `replyTo` set | serialized `custom_headers["reply-to"]` equals the value; no top-level `replyTo` reaches the wire |
| 5 | **Byte attachment** — one attachment with raw bytes, `filename`, `contentType`, plus one inline attachment with `contentId` referenced from HTML | `content` is base64 of the bytes, `name`=filename, `type`=contentType, and `content_id` stays bare; every exact HTML `cid:<id>` reference is rewritten to `cid:<id>@<sender-domain>` without matching the id as a prefix of a longer one; rewriting is suppressed when the id already contains `@`, there is no HTML body, or the sender has no parseable domain |
| 6 | **EU region routing** — client with `region:"eu"` | `/mail/send` request targets `https://api.eu.turbo-smtp.com/api/v2`; a `global` client targets `https://api.turbo-smtp.com/api/v2` |
| 7 | **Auth failure** — bad credentials → 401 | throws typed `AuthenticationError`; carries `errorCode`/`message`/`details` from the send 401 body |
| 8 | **Validation error**: missing `from`/`to`, or `nocredit` → 400 | throws typed `BadRequestError`; flattens nested `errors[]` arrays to strings in order, excludes non-string entries, and retains the original parsed response in `raw` |
| 9 | **Reply-To precedence** — `replyTo` set alongside a `Reply-To` key in `headers`, in any casing | exactly one `reply-to` key reaches the wire and it carries the `replyTo` value; the header-supplied one does not survive beside it |
| 10 | **Line-break rejection** — CR or LF in `from`, `to`, `cc`, `bcc` or `replyTo`, both as a display name and inside a pre-formatted string, or in a `headers` name or value | throws a typed error before the request is built; nothing reaches the transport |
| 11 | **Region rejection** — client constructed with an unrecognised `region` | throws a typed error at construction, distinct from scenario 6, which asserts routing for the two valid values |

**Scenario numbers are stable** — never renumbered, never reused, never retired. A rule that
sharpens a scenario already present strengthens that row in place; a rule that is new *in kind*
appends a new number, and the count is not a constraint.

## Discrepancies register

Spec-vs-reality gaps the facade papers over (each one drives a mapping/decision above). **Entry
numbers are stable** — never renumbered, never reused, never retired.

An entry marked **Stopgap** is a guard that exists only because the server's own error is unclear;
the table states its removal condition.

| # | Discrepancy | Facade handling |
|---|---|---|
| 1 | `/mail/send` `security` advertises `ApiKeyAuth: []`, but the endpoint **rejects** `Authorization` (401) — consumerKey+secret only | Facade never sends `Authorization` for send; the Mail-domain credential is the consumer pair only |
| 2 | `to`/`cc`/`bcc` are single **comma-separated strings**, not arrays | Facade takes one or many addresses, formats and joins to CSV |
| 3 | **Reply-To is not a field** — it lives in `custom_headers["reply-to"]` | First-class `replyTo` param injected into `custom_headers` |
| 4 | Body fields are `content` / `html_content` | Facade uses `text` / `html` |
| 5 | Return `mid` is an **int64** | Returned as **string** `messageId`, safe in every language |
| 6 | Attachments are **base64 strings** | Facade takes raw bytes, encodes internally |
| 7 | **No 429/5xx and no rate-limit headers** modeled, despite documented rate limiting | `RateLimitError`/`ApiError` handled defensively |
| 8 | Pagination has **no total/cursor** | Iterator infers end-of-data from `count` vs `limit` |
| 9 | **No unified error envelope** (≥3 shapes) | Normalized typed hierarchy |
| 10 | Inline parts are keyed by **`<content_id@sender-domain>`**, while `content_id` is sent bare — undocumented, so a natural `cid:<id>` reference silently degrades to a plain attachment | Facade qualifies `cid:` references in the HTML body with the sender domain |
| 11 | A display name is not a modeled field; the whole address is one string, so an unquoted comma in a name splits recipients | Facade accepts structured addresses, quotes specials and MIME-encodes recipient comma names; CR/LF is rejected before formatting or encoding |
| 12 | `region` selects the send host, but an unrecognised value leaves the base URL unset and the generated core silently falls back to `pro.api.serversmtp.com`, which does not serve `/mail/send` | Facade validates `region` in the constructor, so an untyped caller fails loudly rather than sending to the wrong host |
| 13 | `to`/`cc`/`bcc` are split on commas **before** RFC 5322 quoted strings are parsed, so quoted comma names fail while `from` and `reply-to` accept them | Structured recipient names use RFC 2047 UTF-8 encoding, verified through delivery. This replaces the previous local rejection. `from` and `replyTo` keep the quoted form; pre-formatted strings remain caller-owned |
| 14 | The API retains only the first Reply-To address, even when the SDK serializes multiple addresses | Document the backend limitation and recommend one address; retain the existing SDK input type |
| 15 | Send validation errors can contain nested arrays despite the declared string array | Flatten string messages for `BadRequestError.errors`; preserve the complete parsed response in `raw` |
