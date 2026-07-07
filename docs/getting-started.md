# Getting Started

Everything you need to make your first TurboSMTP API call.

> **Running the examples on Windows:** all code examples in this documentation use bash-syntax `curl`. They run verbatim in [Git Bash](https://git-scm.com/downloads) or [WSL](https://learn.microsoft.com/windows/wsl/). To adapt one for PowerShell instead: call `curl.exe` (the `.exe` suffix matters — in Windows PowerShell 5.1 plain `curl` is an alias for `Invoke-WebRequest`), replace the `\` line continuations with a backtick (`` ` ``), and set/reference environment variables as `$env:TURBO_API_KEY = "..."` / `$env:TURBO_API_KEY` instead of `export` / `$TURBO_API_KEY`. The classic `cmd.exe` shell is not recommended: it has no single-quote string syntax, so every JSON body would need its inner quotes escaped.

---

## Base URLs

The TurboSMTP API v2 is served from two hosts:

| Host | Used for |
|---|---|
| `https://pro.api.serversmtp.com/api/v2` | All endpoints **except** `/mail/send` (authentication, analytics, suppressions, validation, account management, …) |
| `https://api.turbo-smtp.com/api/v2` | `POST /mail/send` only |
| `https://api.eu.turbo-smtp.com/api/v2` | `POST /mail/send` only — European sending infrastructure |

> **Important:** `POST /mail/send` is the only endpoint on the `api.turbo-smtp.com` host, and it has its own authentication rule (see below). Every other endpoint in this documentation lives on `pro.api.serversmtp.com`.

---

## Authentication

The API supports two authentication methods, both passed as HTTP headers:

| Method | Headers | Lifetime | Best for |
|---|---|---|---|
| **API Key** | `Authorization: <key>` | 2 hours (or non-expiring with `no_expire`) | Interactive sessions, scripts, account administration |
| **Consumer Key / Secret** | `consumerKey: <key>`<br>`consumerSecret: <secret>` | Permanent until deleted | Production integrations — no account password involved, supports IP restrictions |

> **Note:** The API key is sent as the raw value of the `Authorization` header. Do **not** prefix it with `Bearer` or any other scheme.

Two endpoint-specific rules to remember:

- **`POST /mail/send` accepts only `consumerKey`/`consumerSecret`.** Requests with an `Authorization` header are rejected with `401`.
- **Consumer key management (`/user/consumerKeys`) accepts only the `Authorization` header.** You cannot create or delete consumer keys while authenticated with a consumer key.

### Get an API Key

**`POST /authorize`** — exchange your TurboSMTP account credentials for an API key. No authentication headers required.

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@yourdomain.com",
    "password": "yourTurboSmtpPassword",
    "no_expire": false
  }'
```

Response:

```json
{
  "auth": "f8efa7be4e7457c463e8b800e1f11f92072d272c"
}
```

Use the `auth` value as the `Authorization` header in subsequent calls. With `no_expire: false` (the default) the key expires after 2 hours; with `no_expire: true` it stays valid until you revoke it.

```bash
export TURBO_API_KEY="f8efa7be4e7457c463e8b800e1f11f92072d272c"
```

> **Rate limit:** `/authorize` is rate-limited. Cache the key and reuse it instead of logging in before every request.

### Revoke an API Key

To revoke a key before it expires, call **`POST /deauthorize`**:

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/deauthorize \
  -H "Authorization: $TURBO_API_KEY"
```

Response:

```json
{
  "message": "token_deauthorized"
}
```

The key is invalidated immediately. An invalid or already-revoked key returns `401`.

[Try it in the API reference →](../api-reference/index.html#/authentication/AuthenticationLogin)
[Revoke in the API reference →](../api-reference/index.html#/authentication/AuthenticationLogout)

### Create a Consumer Key

**`POST /user/consumerKeys`** — create a permanent key/secret pair. Requires an API key (`Authorization` header).

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/user/consumerKeys \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "production-backend"
  }'
```

Response (`201 Created`):

```json
{
  "consumerKey": "b914ad238d0e8e8851b81e86ce46ae1d",
  "consumerSecret": "JOSenWTYopGjhZ1CDvsEbcK9PNUA06Xy"
}
```

> **Store the secret now.** The `consumerSecret` is returned only at creation time — listing your consumer keys later returns the key, label, and metadata, but never the secret.

```bash
export CONSUMER_KEY="b914ad238d0e8e8851b81e86ce46ae1d"
export CONSUMER_SECRET="JOSenWTYopGjhZ1CDvsEbcK9PNUA06Xy"
```

Consumer keys are the recommended method for production: they don't expose your account password, can be restricted to specific IP addresses, and can be revoked individually with `DELETE /user/consumerKeys/{consumerKey}`. See the [account management guide](account.md#consumer-keys) for listing and deleting keys.

[Try it in the API reference →](../api-reference/index.html#/consumerkey/createConsumerKey)

---

## Your First Request

Send an email with **`POST /mail/send`** — note the dedicated host and the consumer key headers:

```bash
curl -X POST https://api.turbo-smtp.com/api/v2/mail/send \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "developer@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from TurboSMTP",
    "content": "It works!",
    "html_content": "<h1>It works!</h1>"
  }'
```

Response:

```json
{
  "message": "OK",
  "mid": 1688566310828572700
}
```

`mid` is the message ID — keep it if you want to look the message up in [Analytics](analytics.md) later.

> `to` is a **comma-separated string** of recipient addresses (e.g. `"a@example.com,b@example.com"`), not a JSON array.

---

## Error Responses

Endpoints on the main host return errors as a JSON object with a `message` field:

| HTTP status | `message` | Meaning |
|---|---|---|
| `401` | `missing_authorization_key` | No `Authorization` header (or consumer key pair) was sent |
| `401` | `invalid_authorization_key` | The key is invalid or has expired |
| `401` | `account_is_inactive` | The account is deactivated |
| `403` | `wrong_credentials_specified` | `/authorize` was called with a wrong email/password |
| `400` | `missing_required_parameter` | A required request field is missing |

`POST /mail/send` uses a different error shape for authentication failures:

```json
{
  "errorCode": 3,
  "message": "Invalid authorization token",
  "details": "No authorization key was specified for request: POST /api/mail/send"
}
```

---

## Next Steps

- [Send transactional email](transactional.md) — attachments, embedded images, custom headers, tracking
- [Track delivery with Analytics](analytics.md)
- [Manage suppressions](suppressions.md)
- [Validate email addresses](validation.md)
- [Set up webhooks](webhooks.md)
- [Explore the full API reference](../api-reference/index.html)
