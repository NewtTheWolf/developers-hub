# Go SDK

The official TurboSMTP SDK for Go applications.

**Status:** Planned — coming soon

---

## Planned Installation

```bash
go get github.com/turboSMTP/turbosmtp-go
```

**Requirements:** Go 1.21+

---

## Planned Usage

```go
package main

import (
    "fmt"
    "github.com/turboSMTP/turbosmtp-go/turbosmtp"
)

func main() {
    client := turbosmtp.NewClient("YOUR_API_KEY")

    // Send transactional email
    _, err := client.Mail.Send(turbosmtp.SendRequest{
        From:    "notifications@app.com",
        To:      []string{"user@example.com"},
        Subject: "Welcome Aboard",
        HTML:    "<h1>Success</h1>",
    })
    if err != nil {
        panic(err)
    }

    // Validate an email address
    result, err := client.Validation.Verify("suspect@domain.com")
    if err != nil {
        panic(err)
    }
    fmt.Println(result.Status)
}
```

---

## Design Notes

The Go SDK will be generated from the [OpenAPI 3.1 specification](../api-reference/README.md) using `openapi-generator-cli v7.18.0`.

---

## Stay Updated

Watch this repository or open a [Feature Request](../.github/ISSUE_TEMPLATE/feature_request.md) to be notified when this SDK is available.
