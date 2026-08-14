# TurboSMTP SDK — Language-Agnostic Client Contract

> **Status: RATIFIED (Phase 0 gate passed — 2026-07-22).** This is the keystone contract every
> TurboSMTP SDK must satisfy; it is now authoritative and SDK code is unblocked. Any change from here
> is a versioned amendment (see [§8](#8-conformance--change-control)). Strategy and rationale live
> in [`plan.md`](./plan.md); the executable checklist is [`TASKS.md`](./TASKS.md). This document
> fulfills tasks **0.2** (author the contract) and **0.3** (P0/P1 coverage & namespace names).

## 1. Purpose & scope

This contract defines the **single, canonical developer-facing surface** for the TurboSMTP client
libraries in all five languages — **Node.js/TypeScript, Python, C#, Go, PHP** — independent of any
one language's idioms. It exists to:

- guarantee cross-language consistency (same namespaces, methods, params, returns, errors);
- serve as the reference for the shared conformance test matrix ([§3.3](#33-p0-mail-conformance-scenarios));
- prevent OpenAPI Generator's five naming conventions from drifting apart.

**What it governs:** the **Layer 2 facade** surface (see [§2](#2-layering-recap)) — everything a
developer touches. It does **not** dictate Layer 1 (generated) internals, which are per-language and
regenerated from the spec.

**Authority:** this contract is authoritative. Any facade addition must land here first
(see [§8](#8-conformance--change-control)). Where the raw spec and this contract disagree, the
contract wins for the facade surface, and the divergence is recorded in
[§7 Discrepancies register](#7-discrepancies-register).

**Spec source of truth:** `../api-reference/turbo-smtp.yaml` (OpenAPI 3.1, `info.version 2.0.0-oas3`).
Every field, enum, host, and status code below is traceable to it. Do not hand-edit that spec here;
changes are made upstream in `turbo-smtp-openapi/` and re-synced.

## 2. Layering recap

Each SDK is three thin layers (full rationale in `plan.md`):

- **Layer 1 — Generated core.** Transport, (de)serialization, auth headers, models, multipart —
  produced by OpenAPI Generator, regenerated on spec change, committed per language. **Not governed
  by this contract.**
  > **Hiding Layer 1 is asymmetric, and the asymmetry is accepted** (finding E4, ratified in
  > [ADR-0007](docs/adr/0007-sdk-packaging-granularity.md)). It is *enforceable* only in **Node**
  > (`exports` encapsulation makes unlisted subpaths throw `ERR_PACKAGE_PATH_NOT_EXPORTED`) and
  > **Go** (`internal/`, which the compiler enforces). **Python** (`turbosmtp._generated`) and
  > **PHP** (`@internal`) are convention-only, and **C# cannot hide it at all** — the generator
  > emits `public` types in `TurboSMTP.Generated`. So in three of five languages a consumer *can*
  > reach Layer 1 and may bind to it. This is documented rather than fought with custom templates;
  > what the contract guarantees is the Layer 2 surface, not the unreachability of Layer 1.
- **Layer 2 — Curated facade.** The unified `TurboSMTPClient` and its domain namespaces. This is
  where the surface diverges from endpoints 1:1 (arrays instead of CSV, hidden auth, composed
  helpers). **This contract governs Layer 2.**
- **Layer 3 — Tests, examples, docs.** Conformance tests derived from [§3.3](#33-p0-mail-conformance-scenarios).

## 3. Cross-cutting conventions

### 3.1 Naming map

One concept, five idiomatic spellings. The **canonical client class is `TurboSMTPClient`** in every
language (idiomatic casing applies).

| Concept | Node/TS | Python | C# | Go | PHP |
|---|---|---|---|---|---|
| Client class | `TurboSMTPClient` | `TurboSMTPClient` | `TurboSMTPClient` | `Client` | `TurboSMTPClient` |
| Constructor | `new TurboSMTPClient(opts)` | `TurboSMTPClient(**opts)` | `new TurboSMTPClient(options)` | `turbosmtp.NewClient(opts)` | `new TurboSMTPClient($options)` |
| Mail namespace | `client.mail` | `client.mail` | `client.Mail` | `client.Mail` | `$client->getMail()` |
| Validation namespace | `client.validation` | `client.validation` | `client.Validation` | `client.Validation` | `$client->getValidation()` |
| Send method | `mail.send(msg)` | `mail.send(...)` | `Mail.SendAsync(req)` | `Mail.Send(req)` | `getMail()->send([...])` |
| Async convention | Promise | sync + `AsyncTurboSMTPClient` (later) | `…Async` + `Task<T>` | `(T, error)` | sync |
| `from` field | `from` | `from_` / `from_address` | `From` | `From` | `from` |
| Package | `@turbosmtp/sdk` (npm) | `turbosmtp` (PyPI) | `TurboSMTP` (NuGet) | `github.com/turbosmtp/turbosmtp-go` | `turbosmtp/turbosmtp-client` (Packagist) |

Notes:
- `from` is a reserved word in Python; use `from_` (with `from_address` accepted as an alias). Every
  other language uses the plain `from`/`From`.
- Go conventionally names the package-level type `Client` (used as `turbosmtp.Client`); the
  constructor `NewClient` returns it. This is the one deviation from the literal `TurboSMTPClient`
  string, and it is the idiomatic equivalent.
- **Registry casing is lowercase** everywhere (`turbosmtp` / `@turbosmtp` / `TurboSMTP`). Fix the
  mixed-case Go module path (`turboSMTP`) shown in today's `index.md` to lowercase `turbosmtp`.
- The already-shipped C#/PHP SDKs used a `…ConfigurationBuilder` + `.Build()` pattern. Those are
  **superseded**: initialization is a single options object/constructor (see [§3.2](#32-auth-model)),
  no builder.

### 3.2 Auth model

The spec defines three `apiKey`-in-header schemes: `Authorization` (the raw key — **no `Bearer`
prefix**), `consumerKey`, and `consumerSecret` (`components.securitySchemes`). Different operations
require different schemes, and `/mail/send` explicitly **rejects** `Authorization`.

The facade **hides this entirely**. The developer supplies one credential object; the SDK attaches
the correct headers per operation.

**P0 credential shape — `consumerKey` + `consumerSecret` only:**

```
TurboSMTPClient({
  consumerKey:    "…",   // required
  consumerSecret: "…",   // required
  region:         "global" | "eu",   // optional, default "global" (see §3.2b)
  timeout, maxRetries, …             // optional transport tuning
})
```

- For every P0 operation the SDK sends **both** the `consumerKey` and `consumerSecret` headers.
- The SDK **never** sends `Authorization` in P0. `/mail/send` requires the consumer pair and rejects
  the bearer key with `401` — the developer never learns this.
- **Deferred `apiKey` extension point.** When a P2+ domain introduces `Authorization`-only
  operations (e.g. consumer-key management, `/authorize`), an optional `apiKey` field is added to the
  credential object and the SDK routes per operation. Not in P0 because no P0 operation can use it.
  This is an **additive** change — it will not break the P0 shape.
- This deliberately corrects today's guides, whose single-`TURBO_API_KEY` init **cannot send mail**.

### 3.2b Region model

Region is a **constructor option** (superseding the old C# `SetRegion()` / PHP `setRegion()`
builder methods), an enum: **`global`** (default) or **`eu`**.

Region affects **only the `/mail/send` host** today. Every other operation always uses the global
API server. Hosts (from the spec):

| Scope | Host | Applies to |
|---|---|---|
| Global API | `https://pro.api.serversmtp.com/api/v2` | all operations **except** `/mail/send` |
| Send — Global (default) | `https://api.turbo-smtp.com/api/v2` | `/mail/send` when `region = "global"` |
| Send — EU | `https://api.eu.turbo-smtp.com/api/v2` | `/mail/send` when `region = "eu"` (EU data residency) |

A raw `baseUrl` override escape-hatch is **out of scope** for P0 (may be revisited if self-hosted
deployments need it).

### 3.3 P0 Mail conformance scenarios

> **This section is a stable anchor** — `TASKS.md` 2.3 and 4.1 reference **§3.3** by number. Keep the
> numbering and the count of eight.

Every SDK's Layer 3 tests must cover these **8 scenarios**. They run against the Prism mock server
(credential-free) except where a live send is noted; scenarios 1–2 also back a gated live smoke test.

| # | Scenario | Asserts |
|---|---|---|
| 1 | **Minimal send** — `from`, `to`, `subject`, `text` | 200; returns `messageId` (non-empty string); body maps to `MailMessage` with `content` set |
| 2 | **HTML send** — `from`, `to`, `subject`, `html` | 200; `html` maps to `html_content`; `content` omitted |
| 3 | **Multi-recipient arrays** — `to`/`cc`/`bcc` as arrays of ≥2 | serialized request has comma-joined CSV strings for `to`/`cc`/`bcc` |
| 4 | **Reply-To mapping** — `replyTo` set | serialized `custom_headers["reply-to"]` equals the value; no top-level `replyTo` reaches the wire |
| 5 | **Byte attachment** — one attachment with raw bytes, `filename`, `contentType` | `content` is base64 of the bytes, `name`=filename, `type`=contentType (and `content_id` when `contentId` given) |
| 6 | **EU region routing** — client with `region:"eu"` | `/mail/send` request targets `https://api.eu.turbo-smtp.com/api/v2`; a `global` client targets `https://api.turbo-smtp.com/api/v2` |
| 7 | **Auth failure** — bad credentials → 401 | throws typed `AuthenticationError`; carries `errorCode`/`message`/`details` from the send 401 body |
| 8 | **Validation error** — missing `from`/`to`, or `nocredit` → 400 | throws typed `BadRequestError`; exposes the `errors[]` array from the send 400 body |

### 3.4 Error taxonomy

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

### 3.5 Pagination framework

List endpoints use a `{ count, results }` body with `page`/`limit` **query params** (defaults
`page=1`, `limit=10`; from `PageQueryParam`/`LimitQueryParam`). There is **no total-pages field and
no cursor** — end-of-data is inferred when a page returns fewer than `limit` results.

The facade exposes, for every paged domain method, an **auto-pagination iterator** (async iterator /
generator / `range`-style channel / `Iterator` per language) that transparently walks pages. Manual
`page`/`limit` access remains available. **P0 has no paged endpoint** — this framework is defined now
so P1/P2 additions are drop-in.

### 3.6 Retries & backoff

Framework-level policy, configurable via `maxRetries` (default small, e.g. 2):

- Retry idempotent requests (GET) on transport errors and on `429`/`5xx` with exponential backoff.
- Do **not** auto-retry non-idempotent `/mail/send` by default (avoid duplicate sends); a `429` on
  send surfaces as `RateLimitError` for the caller to handle.

## 4. P0 — Mail domain (full detail)

**Namespace:** `mail`. **Method:** `send`. **Backing operation:** `sendEmail` — `POST /mail/send`,
request schema `MailMessage`, success `SendSucessResponsetBody`.

### 4.1 Parameter shape (idiomatic facade)

| Facade param | Type | Required | Meaning |
|---|---|---|---|
| `from` | string | **yes** | `user@example.com` or `Name <user@example.com>` |
| `to` | string[] | **yes** | recipients (array, min 1) |
| `cc` | string[] | no | copy recipients |
| `bcc` | string[] | no | blind copy recipients |
| `subject` | string | no | ≤ 700 chars |
| `text` | string | no | plain-text body |
| `html` | string | no | HTML body |
| `replyTo` | string | no | first-class Reply-To address |
| `headers` | map<string,string> | no | additional custom headers (escape hatch) |
| `attachments` | Attachment[] | no | see below |
| `referenceId` | string | no | echoed in the Event Webhook |
| `campaignId` | string | no | campaign identifier |
| `mimeRaw` | string | no | raw MIME that **replaces** `text`+`html` |

**Attachment** (facade): `{ content: bytes, filename: string, contentType: string, contentId?: string }`.
The SDK base64-encodes `content` — the developer never handles base64.

### 4.2 Mapping → `MailMessage` (Layer 2 → wire)

| Facade | → | `MailMessage` / `attachment` field | Transform |
|---|---|---|---|
| `from` | → | `from` | passthrough |
| `to` / `cc` / `bcc` | → | `to` / `cc` / `bcc` | **array → comma-joined CSV string** |
| `subject` | → | `subject` | passthrough |
| `text` | → | `content` | rename |
| `html` | → | `html_content` | rename |
| `replyTo` | → | `custom_headers["reply-to"]` | inject into header map |
| `headers` | → | `custom_headers` | merge (explicit `replyTo` wins over a `reply-to` key) |
| `attachments[].content` | → | `attachments[].content` | **bytes → base64** |
| `attachments[].filename` | → | `attachments[].name` | rename |
| `attachments[].contentType` | → | `attachments[].type` | rename |
| `attachments[].contentId` | → | `attachments[].content_id` | rename |
| `referenceId` | → | `reference_id` | rename |
| `campaignId` | → | `X-campaign-ID` | rename |
| `mimeRaw` | → | `mime_raw` | passthrough |

Not exposed as first-class params (available via `headers`/`mimeRaw`): `List-Unsubscribe`,
`X-Entity-Ref-ID`, tracking headers. No template or scheduled-send fields exist in the spec.

### 4.3 Return shape

`SendSucessResponsetBody` is `{ message: string, mid: int64 }`. The facade returns:

```
SendResult { messageId: string }
```

- `messageId` = `mid` **stringified** (per `TASKS.md` 2.2 — a 64-bit id is unsafe as a JS `number`).
- `message` (e.g. `"OK"`) is not surfaced as a primary field; SDKs may expose it as `SendResult.raw`
  but the contracted, tested field is `messageId`.

### 4.4 Errors

`/mail/send` uses two send-specific shapes, mapped per [§3.4](#34-error-taxonomy):

- **400** `SendBadRequestResponseBody` `{ message, errors[] }` → `BadRequestError` (exposes `errors[]`).
  Real messages include invalid/missing sender or recipients, `Invalid Mime`, and `nocredit`.
- **401** `SendUnauthorizedResponseBody` `{ errorCode, message, details }` → `AuthenticationError`
  (preserves `errorCode`/`details`).

## 5. P1 — Email Validation (framework + `validateList` sketch)

> **Full P1 method signatures and return schemas are deferred to `TASKS.md` task 5.1.** This section
> fixes the namespace, the composed-helper shape, and the result vocabulary so P0 review can approve
> the direction without blocking on P1 detail.

**Namespace:** `validation`. Backing operations are the served `/emailvalidation/*` set
(`getEmailValidationSubscription`, `uploadEmailValidationFile`, `getEmailValidationLists`,
`getEmailValidationListSummary`, `deleteEmailValidationListById`, `validateEmailValidatorList`,
`getValidatedEmailsByList`, `getEmailValidationDataByEmailId`, `exportCSVValidatedEmailsByList`,
`validateEmail`).

Planned surface (to be detailed in 5.1):

- **`validation.verify(email)`** — single-address check (`validateEmail`).
- **`validation.validateList(file)`** — the **composed helper** (Layer 2 only): `upload` →
  `startValidate` → **poll** `getEmailValidationListSummary` on `is_processed` / `percentage` until
  complete → fetch paged results via the [§3.5](#35-pagination-framework) iterator. This orchestration
  lives only in the facade; it is never a single endpoint.

**Result vocabulary (stable now)** — from `EmailValidatorMailSharedDetails`:

- `status` enum: `valid`, `invalid`, `catch_all`, `unknown`, `spamtrap`, `abuse`, `do_not_mail`.
- `sub_status` enum (24 values incl. `''`, `role_based`, `disposable`, `mailbox_not_found`,
  `greylisted`, `possible_typo`, …) — carried through verbatim.

## 6. Priority tiers, namespaces & domain coverage

Folds in **task 0.3**. Namespaces are confirmed as: **`mail`, `validation`, `analytics`,
`suppressions`, `subaccounts`, `account`**.

> **Namespaces are a *surface* guarantee, independent of distribution granularity**
> ([ADR-0007](docs/adr/0007-sdk-packaging-granularity.md)). This table fixes what a developer reaches
> (`client.mail`, `client.validation`, …) and says nothing about how many packages the surface arrives
> in. Today ADR-0007 fixes that at **one unified package per language** — so the §3.1 `Package` row is
> one registry name each — and if a flip trigger ever splits a language, this table is unaffected: the
> namespaces are the same, only the install line changes. Consequently a package-name change (e.g. the
> unresolved PyPI `turbosmtp` conflict, `TASKS.md` 3.3b) amends §3.1's `Package` row alone and touches
> nothing here, because a *distribution* name is not an *import* name.

| Tier | Namespace(s) | Domain | Auth path | Status |
|---|---|---|---|---|
| **P0** | `mail` | `/mail/send` | consumerKey+secret | ship first (reference SDK) |
| **P1** | `validation` | `/emailvalidation/*` | consumerKey+secret | after P0; incl. `validateList` |
| **P2** | `analytics` | `/analytics*` | consumerKey+secret | later |
| **P2** | `suppressions` | `/suppressions*` | consumerKey+secret | later |
| **P2** | `subaccounts` | `/subaccounts*` | consumerKey+secret (plan-gated 403) | later |
| **P2** | `account` | `/user/consumerKeys*`, `/authorize`, `/deauthorize` | **`Authorization` (apiKey)** | later — **introduces the deferred `apiKey` credential** ([§3.2](#32-auth-model)) |
| **P3 / maybe-never** | `billing` | `/billing/*` | — | implement only if justified |
| **P3 / maybe-never** | `alerts` | alerts | — | low priority |
| **P3 / maybe-never** | `meta` | countries/states | — | low priority |

**Served surface:** 39 paths / 60 operationIds.

**Coverage caveat — orphaned operations (do NOT promise in any SDK).** These are defined in the
upstream domain files but never wired into the root `paths:`, so they are pruned from the served
bundle and are **not SDK-coverable** until fixed upstream in `turbo-smtp-openapi/`:
`AuthenticationLoginByAPIKey`, `AuthenticationLogoutByAPIKey`, `getUserInfo`,
`createContactBilling`, `deleteContactBilling`, `getContactsBilling`, `getPersonalDetailsBilling`,
`getUserInfo`, `updateContactBilling`, `updatePersonalDetailsBilling`. Nothing in this contract may
expose them.

## 7. Discrepancies register

Spec-vs-reality gaps the facade papers over (each one drives a mapping/decision above):

| # | Discrepancy | Facade handling |
|---|---|---|
| 1 | `/mail/send` `security` advertises `ApiKeyAuth: []`, but the endpoint **rejects** `Authorization` (401) — consumerKey+secret only | Facade never sends `Authorization` for send; P0 credential is the consumer pair only ([§3.2](#32-auth-model)) |
| 2 | `to`/`cc`/`bcc` are single **comma-separated strings**, not arrays | Facade takes arrays, joins to CSV ([§4.2](#42-mapping--email-2-layer-2--wire)) |
| 3 | **Reply-To is not a field** — it lives in `custom_headers["reply-to"]` | First-class `replyTo` param injected into `custom_headers` |
| 4 | Body fields are `content` / `html_content` | Facade uses `text` / `html` |
| 5 | Return `mid` is an **int64** | Returned as **string** `messageId` (JS-safe) |
| 6 | Attachments are **base64 strings** | Facade takes raw bytes, encodes internally |
| 7 | **No 429/5xx and no rate-limit headers** modeled, despite documented rate limiting | `RateLimitError`/`ApiError` handled defensively ([§3.4](#34-error-taxonomy)) |
| 8 | Pagination has **no total/cursor** | Iterator infers end-of-data from `count` vs `limit` ([§3.5](#35-pagination-framework)) |
| 9 | **No unified error envelope** (≥3 shapes) | Normalized typed hierarchy ([§3.4](#34-error-taxonomy)) |

## 8. Conformance & change control

- This contract is **authoritative** for the Layer 2 surface. Every SDK must expose exactly the
  contracted namespaces, methods, params, returns, and error types for the tiers shipped so far.
- The shared conformance test matrix (Phase 4, `TASKS.md` 4.1) is **derived from
  [§3.3](#33-p0-mail-conformance-scenarios)**; those scenario numbers are a stable API.
- **Any facade addition or change lands here first**, then in the SDKs — never the reverse. This is
  the safeguard against cross-language drift.
- **Review gate:** this document must be reviewed and approved before any Phase 1 generation or
  Phase 2 facade code begins.
