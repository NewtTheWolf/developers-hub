# C# SDK

The official TurboSMTP SDK for .NET applications.

**Status:** Stable

> Note: Updates to the C# wrapper SDK are currently paused while API conformance testing is in progress. The existing version is functional and stable for production use.

---

## Installation

```bash
dotnet add package TurboSMTP
```

---

## Configuration

The C# SDK uses the Builder pattern for configuration:

```csharp
using TurboSMTP;

var config = new TurboSMTPClientConfigurationBuilder()
    .SetConsumerKey("YOUR_CONSUMER_KEY")
    .SetConsumerSecret("YOUR_CONSUMER_SECRET")
    .SetRegion(Region.EU)
    .Build();

var client = new TurboSMTPClient(config);
```

---

## Send an Email

```csharp
var response = await client.Mail.SendAsync(new SendMailRequest
{
    From = "you@yourdomain.com",
    To = new[] { "recipient@example.com" },
    Subject = "Hello from TurboSMTP",
    HtmlBody = "<h1>It works!</h1>"
});
```

---

## Validate an Email

```csharp
var result = await client.Validation.VerifyAsync("user@example.com");
Console.WriteLine(result.Status); // "valid", "invalid", etc.
```

---

## Source

The C# SDK source is available in the TurboSMTP GitHub organization.

---

## Reporting Issues

If you encounter behavior that does not match the [API Reference](../api-reference/README.md), please open a [Bug Report](../.github/ISSUE_TEMPLATE/bug_report.md).
