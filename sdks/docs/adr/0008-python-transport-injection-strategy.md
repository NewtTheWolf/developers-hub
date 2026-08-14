# ADR-0008: Transport Injection Strategy — Python SDK

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Applies to** | `sdks/packages/python` |

---

## Context

The Python SDK needs the same property the Node reference has: **unit tests that are offline,
deterministic and credential-free, yet assert the exact bytes the SDK would put on the wire.** That is
what makes `TASKS.md` 2.3's suite able to verify the whole `client-contract.md` §4.2 mapping — arrays
→ CSV, `text` → `content`, `replyTo` → `custom_headers["reply-to"]`, bytes → base64 — without a
network or an account. [ADR-0001](0001-nodejs-dependency-injection-strategy.md) achieved it in Node with
a `fetchApi` option on the client constructor, and named the pattern a **test seam**.

Python is not a free copy of that decision, because the transport is not a single injectable function
and the generated code does not offer a constructor hook. **Layer 1 was generated and inspected on
2026-08-14** (generator 7.24.0, `config/python.yaml`, mail domain, into a throwaway directory — task
3.1 is still PENDING) to establish the real shape rather than assume it. Four candidate seam levels
exist, and exactly one of them sits where `fetchApi` sits.

```python
# turbosmtp/_generated/api/mail_api.py
class MailApi:
    def __init__(self, api_client=None) -> None:      # ← injectable
        if api_client is None:
            api_client = ApiClient.get_default()

# turbosmtp/_generated/api_client.py
class ApiClient:
    def __init__(self, configuration=None, header_name=None, header_value=None, cookie=None):
        self.rest_client = rest.RESTClientObject(configuration)   # ← hard-constructed, no parameter

# turbosmtp/_generated/rest.py
class RESTClientObject:
    def __init__(self, configuration) -> None:
        ...
        self.pool_manager = urllib3.PoolManager(**pool_args)      # ← hard-constructed, no parameter

    def request(self, method, url, headers=None, body=None,
                post_params=None, _request_timeout=None):
```

So the two lowest layers take **only a `Configuration`** and build their collaborator internally.
`rest_client` and `pool_manager` are plain instance attributes — assignable after construction, but
not constructor parameters. Any transport seam in Python is therefore a decision about *which layer to
replace* and *how to wire the replacement*, not merely which option to name.

The four levels, and what a test at each can actually prove:

| Level | Replace | What still runs for real | What a test can assert |
|---|---|---|---|
| **A** | the whole `ApiClient` (via `MailApi(api_client=…)`) | nothing below the facade | almost nothing — the double would have to reimplement serialization, so §4.2 assertions become assertions about the test double |
| **B** | `rest_client` (an object with `.request(...)`) | pydantic model construction, alias serialization, JSON encoding, URL assembly, auth-header attachment | **the exact method, URL, headers and serialized body** — the same position in the stack as Node's `fetchApi` |
| **C** | `pool_manager` (a `urllib3.PoolManager`) | everything in B plus `RESTClientObject`'s own body/header handling | the same as B, plus urllib3-level framing — but the double must speak `urllib3.HTTPResponse` |
| **D** | nothing; only `Configuration` (host, proxy, TLS) | everything | nothing offline — this is configuration, not a seam |

---

## Decision

**Constructor injection through keyword options. No DI framework, in this or any SDK package** —
[ADR-0001](0001-nodejs-dependency-injection-strategy.md)'s reasoning transfers unchanged and is not
re-litigated here.

**The injectable is the transport at level B**, exposed as a `transport` keyword on the facade
constructor and defaulting to the generated `RESTClientObject`:

```python
client = TurboSMTPClient(
    consumer_key="...",
    consumer_secret="...",
    region="eu",
    transport=my_fake,        # optional — defaults to the generated urllib3 transport
)
```

Four points fix the shape.

### 1. The contract is structural, not nominal

`transport` is typed as a `typing.Protocol` mirroring `RESTClientObject.request`, so a test double
needs no import from Layer 1 and no inheritance:

```python
class Transport(Protocol):
    def request(self, method, url, headers=None, body=None,
                post_params=None, _request_timeout=None) -> RESTResponseLike: ...
```

The response duck-type is what `ApiClient.response_deserialize` actually consumes: `.status` (int),
`.data` (bytes, **non-None** — it asserts this), `.read()`, and `.headers` / `.getheaders()`. A test
double is a dozen lines with no dependencies, which is what keeps `TASKS.md` 3.3a dependency-free.

### 2. Wiring is post-construction assignment, pinned by a canary test

Because `ApiClient` offers no parameter, the facade builds a real `ApiClient` and replaces the
attribute:

```python
api_client = ApiClient(configuration)
if transport is not None:
    api_client.rest_client = transport
```

This depends on a Layer 1 **implementation detail**, so it is protected rather than trusted: 3.3a
carries a **canary test** asserting that `ApiClient` still exposes `rest_client` and that
`RESTClientObject.request` still has the expected parameter names. Regeneration then fails loudly in
CI instead of silently sending test traffic to the network. Subclassing `ApiClient` was rejected —
the same coupling, with inheritance on top.

### 3. The facade owns `Configuration` and never touches the module-level defaults

`Configuration.get_default()` and `ApiClient.get_default()` are process-global mutable state. The
facade always constructs its own `Configuration` — host per `client-contract.md` §3.2b region rules,
credentials as default headers with `Authorization` never set (§3.2) — so two clients in one process
cannot contaminate each other and tests need no global teardown.

### 4. This is a seam first and a public transport API second

Per ADR-0001's framing, `transport` exists primarily to make the SDK testable and secondarily to allow
legitimate customization (proxies, corporate TLS, instrumentation). It is **not** a promise that any
HTTP library can be dropped in: the Protocol is urllib3-response-shaped, so a `requests`- or
`httpx`-based transport must adapt its response. Documented as such; not advertised as
bring-your-own-client.

---

## Rationale

### Why level B rather than A, C or D

**A is disqualified on correctness of the tests, not on taste.** The §3.3 scenarios exist to prove the
§4.2 mapping. If the double replaces `ApiClient`, then pydantic alias serialization — the thing that
turns `var_from` into wire `from` and `attachments[].filename` into `name` — never runs, and the suite
verifies the test double instead of the SDK. Node's `fetchApi` sits below serialization precisely
because that is where assertions become meaningful.

**C buys little and costs coupling.** It exercises `RESTClientObject`'s own header and body handling
too, which is real but thin, and in exchange every double must construct a `urllib3.HTTPResponse` —
importing urllib3 internals into the test suite and re-breaking whenever urllib3 changes shape. B's
duck-type is four members.

**D is not a seam.** Pointing `Configuration.host` at a local server is an integration test with a
server to run; it cannot assert a serialized body offline. (A Prism mock is still worth having —
`TASKS.md` 4.2 — as a complement, not a substitute.)

### Why a Protocol rather than an ABC or a concrete base class

A `Protocol` is structural: the double satisfies it by having the method. An ABC would force test code
and any custom transport to import from `turbosmtp._generated`, which contradicts
[ADR-0007](0007-sdk-packaging-granularity.md)'s finding E4 position — Layer 1 is internal by
convention in Python, so the *public* seam must not require reaching into it.

### Why not an HTTP-mocking library

`responses`, `respx` and `vcrpy` would each work, and each would add a test dependency that asserts at
the wrong altitude: they intercept *after* the request is built, and typically match on URL + body
patterns rather than handing the test the exact object the SDK produced. They also do not cover the
`NetworkError` mapping path (§3.4), which a double covers by raising. Node's suite has zero test
dependencies; Python's should too, and this is the choice that allows it.

### Ecosystem alignment — and why the keyword is `transport`, not `http_client`

Injecting the transport, rather than using a container or monkeypatching, is the established Python SDK
pattern; none of the SDKs below uses a DI framework, matching ADR-0001's finding in the Node ecosystem.
Verified against vendor documentation **2026-08-14**:

| SDK | Keyword | What is injected |
|---|---|---|
| **Azure SDK for Python** | `transport=` — **required by guideline** | An **SDK-defined** abstraction (`HttpTransport`), default `RequestsTransport` / `AioHttpTransport` |
| **Google Cloud Python** | `transport=` | SDK-defined transport classes |
| **Twilio** | `http_client=` | An SDK-defined `HttpClient` abstraction, documented as usable to create *"a mocking layer for unit testing"* |
| **Stripe** | `http_client=`, plus a process-global `stripe.default_http_client` | A subclass of the SDK's own `stripe.HTTPClient` (`RequestsClient`, `HTTPXClient`, `AIOHTTPClient`, …) |
| **OpenAI / Anthropic / Brevo v5** | `http_client=` / `httpx_client=` | A **concrete third-party** `httpx.Client` |

The field splits on the keyword, but not arbitrarily: **`transport=` is used where the injected object
is an abstraction the SDK itself defines; `http_client=` where it is a concrete third-party client.**
Ours is the former — a Protocol shaped like `RESTClientObject.request`, not a urllib3 or httpx object —
so `transport` is the name that matches the convention rather than merely being available. It is also
the only one of the two with a normative rule behind it:

> *"DO allow users to pass in a `transport` keyword-only argument that allows the caller to specify a
> specific transport instance."*
> — [Azure SDK for Python design guidelines](https://azure.github.io/azure-sdk/python_design.html)

That is the same guidelines document [ADR-0007](0007-sdk-packaging-granularity.md) cites for C# packaging,
so the two ADRs are not drawing on different notions of "idiomatic".

### The peer group that shares our generator has no seam at all

The comparison that matters most is SDKs built from the same openapi-generator Python template, because
they face the identical `ApiClient` / `RESTClientObject` structure documented above. The ecosystem's
answer there is **not** a seam: it is "point `Configuration.host` at a mock server" — level D in the
table above, which cannot assert a serialized body offline. Brevo is the instructive case: its v1.x was
raw generator output with `ApiClient` and `Configuration` exposed to users, and **v5 abandoned that
shape** — `ApiClient`/`Configuration` are now hidden behind a single `Brevo(api_key=…)` client that
accepts `httpx_client=`. That is the Layer 1 / Layer 2 split this program already committed to, arrived
at independently, and it confirms that exposing the generated core is the thing to move away from.

### One thing this decision does *not* have to solve

Node's facade regex-extracts `mid` from the raw response text because JS `number` rounds above 2⁵³
(`TASKS.md` 2.2). The 2026-08-14 inspection settles the Python side: the generated model types it as
`mid: Optional[Annotated[int, Field(le=..., ge=0, strict=True)]]`, and Python `int` is
arbitrary-precision, so `json.loads` → pydantic preserves all 64 bits. **The facade needs no
raw-text access for precision**, which keeps a raw-passthrough requirement out of the seam contract.

---

## Consequences

### Positive

- 3.3a can port all 8 §3.3 scenarios plus the 4 extras as **offline, credential-free, zero-dependency**
  tests that assert method, URL, headers and serialized body — parity with 2.3 rather than a weaker
  Python equivalent.
- The `NetworkError` branch of §3.4 is directly testable: the double raises.
- The facade constructor signature is settled, so 3.2 can be written without revisiting it.
- No new runtime dependency. `typing.Protocol` is stdlib (3.8+) and `typing_extensions` is already a
  transitive dependency of the generated core (3.0c).
- Two clients in one process are independent, and tests need no global state teardown.

### Negative / Constraints

- **A real `urllib3.PoolManager` is still constructed** even when a transport is injected, because
  `ApiClient.__init__` builds `RESTClientObject` unconditionally. It opens no socket until a request is
  made, so tests stay offline — but it is wasted setup, and worth a comment in the facade so nobody
  "fixes" it by skipping the real `ApiClient`.
- **The wiring is coupled to a Layer 1 implementation detail.** Mitigated by the canary test, not
  eliminated. If a future generator version restructures `ApiClient`, the canary fails and the facade
  needs a one-line update — an accepted maintenance cost of not forking the template.
- **Async is not covered, and this is where we are behind the field.** `client-contract.md` §3.1 defers
  `AsyncTurboSMTPClient`, and `config/python.yaml` pins `library: urllib3`, which is sync-only. An async
  client needs a second Layer 1 generation (`library: asyncio`) **and** an async twin of the Protocol.
  Defensible as a P0 scope call, but note that the comparison group treats sync-only as incomplete:
  Azure's guideline mandates an async transport default (`AioHttpTransport`), Stripe ships
  `AIOHTTPClient`/`HTTPXClient`, and Brevo v5 ships an async client alongside the sync one. Sync-first is
  a sequencing decision, not a resting place.
- **The Protocol is urllib3-response-shaped**, so it is a seam rather than a portable transport
  abstraction (see Decision 4). A `Transport` written against `httpx` must adapt. This is a **known
  deviation** from the SDKs that use the same keyword: Azure's `HttpTransport` returns an azure-core
  response type, i.e. a neutral abstraction. We cannot match that without an adapter layer, because we
  do not own the deserializer — Layer 1's `response_deserialize` consumes `.status` / `.data` / `.read()`
  directly. Revisit if we ever wrap Layer 1's response handling.
- **No process-global default transport.** Stripe offers `stripe.default_http_client` for
  application-wide configuration; we deliberately forbid the generated `get_default()` equivalents
  (Decision 3). The stricter path avoids test pollution and cross-client contamination, at the cost of
  an ergonomic some users will expect.
- **Per-language seam *mechanisms* differ by design, and must be allowed to.** Node `fetchApi`, Python
  `transport=`, and — per ADR-0007's finding E2 — PHP heading for an injected PSR-18 `ClientInterface`
  whose idiomatic *default* is HTTPlug **Discovery**, not injection. C# already has a **dual** path per
  [ADR-0002](0002-csharp-dependency-injection-strategy.md): constructor injection of `HttpClient` *and*
  `services.AddTurboSMTP(…)` over `IHttpClientFactory`, whose extension point is the
  `HttpMessageHandler` pipeline rather than a constructor argument. `client-contract.md` §3.1 has no row
  for the concept yet; when one is added it must state the **property, not the mechanism** — *the
  transport is replaceable without a network, through each ecosystem's own idiomatic injection path* —
  with a single floor that keeps the 4.1 conformance matrix uniform: **a container-free,
  discovery-free path always exists** (ADR-0002 already commits C# to exactly that, and it is what lets
  one test recipe work in five languages). **Add the row once three of five exist**, and do not
  generalise "constructor-level" from the two languages that happen to spell it that way.

---

## References

- [ADR-0001](0001-nodejs-dependency-injection-strategy.md) — Node DI/seam decision; the options-bag
  and no-framework reasoning this ADR inherits
- [ADR-0002](0002-csharp-dependency-injection-strategy.md) — the C# peer decision
- [ADR-0007](0007-sdk-packaging-granularity.md) — finding **E4** (Layer 1 is internal by convention
  only in Python, which is why the seam must not require importing it) and **E2** (the analogous PHP
  transport decision)
- `sdks/client-contract.md` §3.2 (auth), §3.2b (region → host), §3.4 (error taxonomy incl.
  `NetworkError`), §4.2 (the mapping the seam makes assertable), §3.1 (async deferral)
- `sdks/TASKS.md` — 3.0b (this decision), 3.2 (facade constructor), 3.3a (test suite + canary test),
  4.2 (Prism mock, complementary)
- Generated Layer 1 as inspected 2026-08-14 with generator 7.24.0: `api/mail_api.py` (`MailApi`),
  `api_client.py` (`ApiClient.__init__`, `call_api`, `response_deserialize`), `rest.py`
  (`RESTClientObject`, `RESTResponse`)
- Feathers, M. (2004). *Working Effectively with Legacy Code* — definition of "seam"
- [httpx — custom transports](https://www.python-httpx.org/advanced/transports/) ·
  [urllib3 — PoolManager](https://urllib3.readthedocs.io/en/stable/reference/urllib3.poolmanager.html)
- **Vendor SDK evidence, verified 2026-08-14** (the "Ecosystem alignment" table):
  [Azure SDK for Python design guidelines](https://azure.github.io/azure-sdk/python_design.html) — the
  `transport` keyword-only DO ·
  [Azure Core README](https://learn.microsoft.com/en-us/python/api/overview/azure/core-readme) ·
  [Twilio — custom HTTP clients](https://www.twilio.com/docs/libraries/python/custom-http-clients-python) ·
  [stripe-python README](https://github.com/stripe/stripe-python) — `http_client=` / `default_http_client` ·
  [brevo-python README](https://github.com/getbrevo/brevo-python) — the v1.x→v5 move away from exposing
  `ApiClient`/`Configuration`
