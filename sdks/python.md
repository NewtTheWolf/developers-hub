# Python SDK

The official TurboSMTP SDK for Python applications.

**Status:** Planned — coming soon

---

## Planned Installation

```bash
pip install turbosmtp
```

**Requirements:** Python 3.9+

---

## Planned Usage

```python
from turbosmtp import TurboClient

turbo = TurboClient(api_key="YOUR_API_KEY")

# Send transactional email
response = turbo.mail.send(
    from_address="notifications@app.com",
    to=["user@example.com"],
    subject="Welcome Aboard",
    html="<h1>Success</h1>"
)

# Validate an email address
result = turbo.validation.verify("suspect@domain.com")
if result.status == "valid":
    pass  # Proceed
```

---

## Design Notes

The Python SDK will be generated from the [OpenAPI 3.1 specification](../api-reference/README.md) using `openapi-generator-cli v7.18.0` with custom templates targeting a fluent, Pythonic interface.

---

## Stay Updated

Watch this repository or open a [Feature Request](../.github/ISSUE_TEMPLATE/feature_request.md) to be notified when this SDK is available.
