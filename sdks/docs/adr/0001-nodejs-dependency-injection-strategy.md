# ADR-0001: Dependency Injection Strategy — Node.js SDK

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-28 |
| **Applies to** | `sdks/packages/node` |

---

## Context

The SDK needs to support testability (no real HTTP calls in unit tests) and runtime flexibility (custom transports for proxying, edge runtimes, or exotic environments). This requires the HTTP transport layer to be replaceable.

Two broad approaches were considered:

1. **Formal DI framework** (e.g., `inversify`, `tsyringe`, `awilix`)
2. **Lightweight constructor injection via options bag**

---

## Decision

Use **constructor injection through an options bag** for all injectable dependencies. No DI framework is used or will be introduced into any SDK package.

The HTTP transport is the primary injectable. It is exposed as a `fetchApi` option on the client constructor, typed as `typeof fetch`. It defaults to the global `fetch` (available natively in Node.js ≥ 18) when not provided:

```typescript
new TurboSMTPClient({
  consumerKey: '...',
  consumerSecret: '...',
  fetchApi: myCustomFetch, // optional — defaults to global fetch
})
```

This pattern is also referred to as a **test seam**: a deliberate extension point that exists primarily to make the SDK unit-testable without network calls, and secondarily to support legitimate runtime transport customization.

---

## Rationale

### Why not a formal DI framework?

| Concern | Detail |
|---|---|
| **Unwanted transitive dependency** | Any DI framework added to the SDK becomes a dependency of every consumer, regardless of whether they use that framework themselves. |
| **Framework conflict** | Consumers using NestJS, or any other framework with its own container, would have two competing DI systems with no interoperability. |
| **Compiler constraints** | Decorator-based frameworks (`inversify`, `tsyringe`) require `experimentalDecorators` and `emitDecoratorMetadata` — non-trivial `tsconfig.json` constraints to impose on consumers. |
| **Bundle size** | Reflect metadata and a DI runtime can add 10–50 KB, which matters for browser and edge targets. |
| **Over-engineering** | The SDK has one real injectable dependency (HTTP transport). A full DI container is designed to manage dozens of services. |

### Why the options-bag pattern is the right fit for SDKs

This is the established industry standard for SDK and library development. Major Node.js SDKs follow the same approach:

- **AWS SDK v3** — `httpHandler` option
- **Stripe Node SDK** — `httpClient` option
- **OpenAI Node SDK** — `fetch` option + `httpAgent` option
- **Axios** — `adapter` option
- **Got** — `handlers` array

None use a DI framework internally.

---

## Consequences

### Positive
- Zero runtime dependencies — the SDK adds nothing to the consumer's bundle or dependency tree.
- Works identically in Node.js, browser, and edge runtimes.
- Unit tests are fully offline, deterministic, and credential-free.
- Consumers using any framework (or no framework) can use the SDK without friction.

### Negative / Constraints
- The options bag must be kept manageable. If the number of injectable concerns grows significantly, the API surface risks becoming unwieldy.

### Future evolution path

If the SDK grows to require multiple swappable concerns (logger, retry policy, cache, metrics), the recommended evolution is a **middleware/plugin pipeline** — not a DI container:

```typescript
// Example of the evolution path (not yet implemented)
new TurboSMTPClient({ consumerKey, consumerSecret })
  .withPlugin(retryPlugin({ maxAttempts: 3 }))
  .withPlugin(loggerPlugin(console))
  .withPlugin(customFetchPlugin(myFetch))
```

This scales the pattern without introducing framework dependencies. See AWS SDK v3's middleware stack as a reference implementation.

---

## References

- `sdks/packages/node/src/client.ts` — `TurboSMTPClientOptions.fetchApi`
- `sdks/packages/node/test/helpers.mjs` — `makeFetch()` / `makeThrowingFetch()` test seam usage
- `sdks/client-contract.md` — §3.1 client configuration contract
- Feathers, M. (2004). *Working Effectively with Legacy Code* — definition of "seam"
- [AWS SDK v3 middleware stack](https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/)
