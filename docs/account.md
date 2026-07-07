# Account Management

Manage the credentials and settings of your TurboSMTP account: account details, API key management, consumer keys, passwords, usage alerts, validation credit purchases, and reference data.

> **Authentication:** unless noted otherwise, endpoints accept either auth method — `Authorization: $TURBO_API_KEY` or the `consumerKey`/`consumerSecret` header pair. **Consumer key management and password changes are API-key-only** (see each section). See [Getting Started](getting-started.md).

**On this page:**

- [Consumer Keys](#consumer-keys)
- [Consumer Key Permissions](#consumer-key-permissions)
- [Change Password](#change-password)
- [Forgot Password](#forgot-password)
- [Usage Alerts](#usage-alerts)
- [Buy Email Validation Credits](#buy-email-validation-credits)
- [Reference Data](#reference-data)
- [Recipe: Set Up a Secure Consumer Key](#recipe-set-up-a-secure-consumer-key)
- [Recipe: Monitor Account Quota and Usage](#recipe-monitor-account-quota-and-usage)
- [Next Steps](#next-steps)

---

## Consumer Keys

Consumer keys are permanent API credentials — see [Getting Started](getting-started.md#create-a-consumer-key) for why they're recommended in production.

> **API key required:** all three endpoints below accept only the `Authorization` header. Consumer key listing, creation, and deletion are not allowed when authenticated via consumer key.

### List

**`GET /user/consumerKeys`**

```bash
curl https://pro.api.serversmtp.com/api/v2/user/consumerKeys \
  -H "Authorization: $TURBO_API_KEY"
```

Response:

```json
{
  "count": 2,
  "results": [
    {
      "consumerKey": "bff5c9436b6da9fe3c1d3379e7dc0f21",
      "label": "QA",
      "creation_time": "2023-10-12 11:58:11",
      "ips": [],
      "is_legacy": false,
      "permissions": ["SEND_SMTP", "SEND_API", "APIS"]
    },
    {
      "consumerKey": "1027d089da21adfc7f08dc14303571f3",
      "label": "Staging",
      "creation_time": "2023-08-02 17:18:00",
      "ips": ["192.168.1.1"],
      "is_legacy": false,
      "permissions": ["SEND_SMTP", "SEND_API", "APIS"]
    }
  ]
}
```

Each entry includes `ips` (IP addresses the key is restricted to — empty array means no restriction), `permissions` (list of granted permissions, e.g. `SEND_SMTP`, `SEND_API`, `APIS`), and `is_legacy` (true for older credential formats). The `consumerSecret` is **never** included — it is shown only once, at creation.

[Try it in the API reference →](../api-reference/index.html#/consumerkey/listConsumerKeys)

### Create

**`POST /user/consumerKeys`**

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/user/consumerKeys \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "production-backend",
    "permissions": ["SEND_SMTP", "SEND_API", "APIS"],
    "ips": ["192.168.1.1"]
  }'
```

Request body fields:

| Field | Required | Description |
|---|---|---|
| `label` | No | Human-readable name for the key |
| `permissions` | **Yes** | Permissions to grant. At least one of: `SEND_SMTP`, `SEND_API`, `APIS` |
| `ips` | No | IP addresses allowed to use this key — omit for no restriction |

Response (`201 Created`):

```json
{
  "consumerKey": "b914ad238d0e8e8851b81e86ce46ae1d",
  "consumerSecret": "JOSenWTYopGjhZ1CDvsEbcK9PNUA06Xy"
}
```

> **Store the secret now.** The `consumerSecret` is returned only at creation time — listing your consumer keys later returns the key, label, and metadata, but never the secret.

[Try it in the API reference →](../api-reference/index.html#/consumerkey/createConsumerKey)

### Delete

**`DELETE /user/consumerKeys/{consumerKey}`**

```bash
curl -X DELETE https://pro.api.serversmtp.com/api/v2/user/consumerKeys/bff5c9436b6da9fe3c1d3379e7dc0f21 \
  -H "Authorization: $TURBO_API_KEY"
```

Response:

```json
{
  "message": "success"
}
```

An unknown key returns `404` with `{"message": "key_not_found"}`. Deletion is immediate — any integration using the key stops authenticating.

[Try it in the API reference →](../api-reference/index.html#/consumerkey/deleteConsumerKey)

---

## Consumer Key Permissions

When creating a consumer key, grant one or more of these permissions:

| Permission | Grants |
|---|---|
| `SEND_SMTP` | Send email via SMTP |
| `SEND_API` | Send email via REST API (`POST /mail/send`) |
| `APIS` | Access all other REST endpoints (analytics, suppressions, account management, and more) |

Grant only the permissions your integration needs. A key used only for sending does not need `APIS`.

---

## Change Password

**`PUT /change-password`**

> **API key required:** calling this endpoint with consumer key headers returns `403` with `not_allowed_for_apikey`. Authenticate with the `Authorization` header.

```bash
curl -X PUT https://pro.api.serversmtp.com/api/v2/change-password \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "6SwHbc96dyE8",
    "password": "SMkhhf4J686P",
    "confirm_password": "SMkhhf4J686P"
  }'
```

Response:

```json
{
  "message": "success"
}
```

Password rules:

- At least 10 characters
- At least one uppercase character
- At least one lowercase character
- At least one digit

Returns `{"message": "success"}`. A wrong `current_password` returns `403` with `password_is_invalid`. The `400` catalog covers each rule violation (`password_length_should_not_be_less_than_10_characters`, `password_should_contain_at_least_one_uppercase_character`, `password_should_contain_at_least_one_lowercase_character`, `password_should_contain_at_least_one_digit`, `password_should_equal_confirm_password`, `new_password_should_not_equal_current_password`, plus missing-field variants).

[Try it in the API reference →](../api-reference/index.html#/authentication/ChangePassword)

---

## Forgot Password

A three-step, token-based reset flow. **Tokens are valid for 1 hour.**

### 1. Request a reset email

**`POST /forgot-password`** — no authentication required:

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "developer@yourdomain.com"}'
```

The email contains a **Reset Password** button and a secret token for the API flow. The endpoint returns success whether or not the address is registered, to prevent email enumeration.

### 2. (Optional) Check the token

**`GET /forgot-password?token=<token>`**

```bash
curl https://pro.api.serversmtp.com/api/v2/forgot-password?token=781d4b44aaf5de86dc0a7e1ca2dc409f \
  -H "Authorization: $TURBO_API_KEY"
```

Response:

```json
{
  "message": "success"
}
```

An invalid or expired token returns `403` with `token_is_invalid`. Unlike the other two steps, this check requires authentication (`Authorization` header).

### 3. Set the new password

**`PUT /forgot-password`** — no authentication required; same password rules as above:

```bash
curl -X PUT https://pro.api.serversmtp.com/api/v2/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "password": "SMBBBf4J686P",
    "confirm_password": "SMBBBf4J686P",
    "token": "781d4b44aaf5de86dc0a7e1ca2dc409f"
  }'
```

Response:

```json
{
  "message": "success"
}
```

An invalid or expired token returns `403` with `token_is_invalid`.

[Try it in the API reference →](../api-reference/index.html#/authentication/SendSecretTokenResetPassword)

---

## Usage Alerts

Get an email notification when your plan usage crosses a threshold. Each alert is an `email` + `percentage` (0–100) pair.

### List

**`GET /tools/alerts`**

```bash
curl https://pro.api.serversmtp.com/api/v2/tools/alerts \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET"
```

Response:

```json
{
  "count": 2,
  "results": [
    { "id": 4117, "email": "alert@example.com", "percentage": 50 },
    { "id": 4118, "email": "alert@example.com", "percentage": 100 }
  ]
}
```

[Try it in the API reference →](../api-reference/index.html#/alerts/getAlerts)

### Create

**`POST /tools/alerts`**

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/tools/alerts \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email": "alert@example.com", "percentage": 80}'
```

Response (`201 Created`):

```json
{
  "id": 4117,
  "email": "alert@example.com",
  "percentage": 80
}
```

`400` errors: `missing_required_parameter_email`, `missing_required_parameter_percentage`, `percentage_should_be_integer`, `percentage_should_not_be_less_than_0`, `percentage_should_not_be_higher_than_100`.

[Try it in the API reference →](../api-reference/index.html#/alerts/createAlert)

### Get

**`GET /tools/alerts/{Id}`**

```bash
curl https://pro.api.serversmtp.com/api/v2/tools/alerts/4117 \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET"
```

Response:

```json
{ "id": 4117, "email": "alert@example.com", "percentage": 80 }
```

An unknown `Id` returns `404` with `{"message": "alert_not_found"}`.

[Try it in the API reference →](../api-reference/index.html#/alerts/getAlert)

### Update

**`PATCH /tools/alerts/{Id}`**

```bash
curl -X PATCH https://pro.api.serversmtp.com/api/v2/tools/alerts/4117 \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"percentage": 90}'
```

Response:

```json
{ "id": 4117, "email": "alert@example.com", "percentage": 90 }
```

Both `email` and `percentage` are optional — send only the fields you want to change. `400` errors: `percentage_should_be_integer`, `percentage_should_not_be_less_than_0`, `percentage_should_not_be_higher_than_100`. An unknown `Id` returns `404` with `{"message": "alert_not_found"}`.

[Try it in the API reference →](../api-reference/index.html#/alerts/updateAlert)

### Delete

**`DELETE /tools/alerts/{Id}`**

```bash
curl -X DELETE https://pro.api.serversmtp.com/api/v2/tools/alerts/4117 \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET"
```

Response:

```json
{ "message": "success" }
```

An unknown `Id` returns `404` with `{"message": "alert_not_found"}`.

[Try it in the API reference →](../api-reference/index.html#/alerts/deleteAlert)

---

## Buy Email Validation Credits

Top up Email Validation Credits with **`POST /billing/buy_emailvalidation_credits`**. Because credits are consumed by validation, this endpoint is documented in full — including the free-vs-paid credit model and error catalog — under [Email Validation → Credits](validation.md#credits).

---

## Reference Data

Country and state lookups, useful for building address forms (e.g. when creating [subaccounts](subaccounts.md)). Both endpoints are **public** — no authentication required.

**`GET /meta/countries`**

```bash
curl https://pro.api.serversmtp.com/api/v2/meta/countries
```

Response:

```json
[
  { "iso_code": "US", "currency": "USD", "flag": "🇺🇸", "name": "United States", "phonecode": "1" }
]
```

**`GET /meta/state/{isoCode}`** — states/regions for a country ISO code:

```bash
curl https://pro.api.serversmtp.com/api/v2/meta/state/US
```

Response:

```json
[
  { "name": "Alabama", "iso_code": "AL", "country_code": "US", "type": null }
]
```

An unknown ISO code returns `404` with `{"message": "invalid_iso_code"}`.

[Try it in the API reference →](../api-reference/index.html#/meta/getCountries)

---

## Recipe: Set Up a Secure Consumer Key

Follow the principle of least privilege when creating keys for production integrations:

1. **Create a key with only the permissions needed** — if your integration only sends via SMTP, grant `SEND_SMTP` only; if it sends via REST API, grant `SEND_API` only; grant `APIS` only if you need to query analytics, manage suppressions, or access other endpoints.

2. **Restrict by IP** — include your sending server's IPv4 address in the `ips` array. This limits damage if the key is compromised.

3. **Store the secret securely** — the `consumerSecret` is returned only at creation time. Store it in your secrets manager (e.g., environment variables, HashiCorp Vault, AWS Secrets Manager), never in version control.

4. **Monitor usage** — set up alerts (see Recipe: Monitor Account Quota below) to detect unusual activity.

---

## Recipe: Monitor Account Quota and Usage

Set up alerts at key thresholds to track sending quota consumption and catch issues early:

1. **Create an alert at 50% usage** — gives you time to plan for quota increase.

2. **Create an alert at 80% usage** — warning before you hit your limit.

3. **Create an alert at 100% usage** — immediate notification if you're out of quota.

4. **Review your consumer keys periodically** — list all active keys and verify they're still in use. Rotate (delete old, create new) keys that are no longer active or whose `creation_time` is significantly older than your integration lifecycle.

---

## Next Steps

- [Send transactional email](transactional.md)
- [Track deliverability with Analytics](analytics.md)
- [Manage suppressions](suppressions.md)
- [Manage subaccounts (agency plans)](subaccounts.md)
- [Full API reference](../api-reference/index.html#/)
