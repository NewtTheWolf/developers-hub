# ADR-0002: Dependency Injection Strategy — C# SDK

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-28 |
| **Applies to** | `sdks/packages/csharp` |
| **Related** | [ADR-0001](0001-nodejs-dependency-injection-strategy.md) — Node.js DI strategy |

---

## Context

The C# SDK needs the same core properties as other SDK packages: testability without real HTTP calls, and transport flexibility for consumers who need custom proxying or configuration.

However, the .NET ecosystem differs fundamentally from Node.js in one key area: it has a **first-party, platform-level DI abstraction** (`Microsoft.Extensions.DependencyInjection`) that is not a third-party framework — it ships as part of .NET itself and is universally adopted across ASP.NET Core, Worker Services, and any hosted application model.

Ignoring this abstraction in a C# SDK would be the actual anti-pattern, as it would force consumers to manually wire up the client instead of using the idiomatic `IServiceCollection` registration they already use for every other dependency.

Two concerns were considered independently:

1. **HTTP transport injection** — how to make the HTTP layer replaceable (for testing and customization)
2. **DI container integration** — whether and how to support registration in a consumer's IoC container

---

## Decision

### 1. HTTP transport — constructor injection via `HttpClient`

The SDK accepts an `HttpClient` instance via its constructor. This is the established .NET pattern for injectable HTTP transport:

```csharp
// Default — SDK creates its own HttpClient
var client = new TurboSMTPClient("consumerKey", "consumerSecret");

// Injected — consumer controls the HttpClient lifecycle
var client = new TurboSMTPClient("consumerKey", "consumerSecret", httpClient: myHttpClient);
```

For testing, consumers inject an `HttpClient` backed by a mock `HttpMessageHandler`:

```csharp
var handler = new MockHttpMessageHandler();
handler.When("/mail/send").Respond(HttpStatusCode.OK, ...);

var client = new TurboSMTPClient("ck", "cs", new HttpClient(handler));
```

No third-party mocking library is required by the SDK itself.

### 2. DI container integration — `IServiceCollection` extension method

The SDK provides an optional `AddTurboSMTP()` extension method on `IServiceCollection`, built on top of `Microsoft.Extensions.Http` (`IHttpClientFactory`). This is the idiomatic registration path for ASP.NET Core and hosted applications:

```csharp
// Program.cs / Startup.cs
services.AddTurboSMTP(options =>
{
    options.ConsumerKey = configuration["TurboSMTP:ConsumerKey"];
    options.ConsumerSecret = configuration["TurboSMTP:ConsumerSecret"];
    options.Region = Region.EU; // optional
});

// Usage via constructor injection in any service
public class EmailService(TurboSMTPClient client) { ... }
```

`IHttpClientFactory` manages `HttpClient` instance lifecycle (connection pooling, DNS refresh) automatically — consumers do not need to manage this manually.

---

## Rationale

### Why `Microsoft.Extensions.DependencyInjection` is acceptable here (unlike third-party frameworks)

The core principle from ADR-0001 still holds: *a library must not impose a DI framework on its consumers*. This case is different because:

- `Microsoft.Extensions.DependencyInjection` ships with .NET — it is not an external dependency.
- It defines **abstractions** (`IServiceCollection`, `IServiceProvider`) that any container can implement. Consumers using Autofac, Lamar, or DryIoc still benefit from the extension method.
- The extension method is **optional** — consumers not using any DI container can still use plain constructor injection without referencing `Microsoft.Extensions.*` at all.
- Every major .NET SDK/library (Azure SDK, Stripe.net, SendGrid, MailKit wrappers) follows this exact dual-entry-point pattern.

### Why `IHttpClientFactory` over a raw `HttpClient`

| Concern | Raw `HttpClient` | `IHttpClientFactory` |
|---|---|---|
| Socket exhaustion | Risk if consumer creates many instances | Managed — factory pools handlers |
| DNS changes | Stale if long-lived | Handled — handlers recycled periodically |
| Lifecycle management | Consumer's responsibility | Automatic |
| Testability | Mock handler injection | Same — factory resolves a mock-backed client |

---

## Consequences

### Positive
- Idiomatic for every .NET application model (ASP.NET Core, Worker Service, console app).
- `HttpClient` injection provides a clean test seam — same conceptual role as `fetchApi` in the Node.js SDK.
- No third-party runtime dependencies beyond `Microsoft.Extensions.Http` (which consumers already have in any hosted .NET app).
- Plain constructor path ensures usability without any DI container.

### Negative / Constraints
- `Microsoft.Extensions.Http` must be listed as a dependency of the SDK package, adding a small but non-zero transitive dependency for consumers using the plain constructor path who do not already have it.
- The `AddTurboSMTP()` extension method creates a soft coupling to the Microsoft hosting model — acceptable given its ubiquity, but worth noting for consumers targeting minimal/non-hosted environments.

### Future evolution path

If the SDK grows to support middleware-style extensibility (retry policies, logging, custom headers), the recommended path is `Microsoft.Extensions.Http`'s built-in `HttpMessageHandler` pipeline — not a custom plugin system:

```csharp
services.AddTurboSMTP(options => { ... })
        .AddHttpMessageHandler<RetryHandler>()
        .AddHttpMessageHandler<LoggingHandler>();
```

This reuses .NET's own extensibility model and requires no new abstractions in the SDK.

---

## References

- `sdks/config/csharp.yaml` — OpenAPI Generator configuration for the C# package
- `sdks/csharp.md` — C# SDK authoring notes
- [ADR-0001](0001-nodejs-dependency-injection-strategy.md) — Node.js DI strategy (related, different conclusion)
- [Microsoft.Extensions.Http documentation](https://learn.microsoft.com/en-us/dotnet/core/extensions/httpclient-factory)
- [Azure SDK for .NET — HttpClient guidelines](https://azure.github.io/azure-sdk/dotnet_introduction.html)
