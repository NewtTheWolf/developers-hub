# Subaccounts Management

Manage client accounts under your own — create subaccounts, set their sending quotas, activate or deactivate them, authorize as them, and brand the experience with your agency identity.

> **Plan requirement:** subaccount endpoints are an **agency-plan feature**. Without an eligible plan they return `403` with `{"message": "feature_not_available_for_active_plan"}`.
>
> **Authentication:** all endpoints on this page accept either auth method — `Authorization: $TURBO_API_KEY` or the `consumerKey`/`consumerSecret` header pair. See [Getting Started](getting-started.md).

**On this page:**

- [List Subaccounts](#list-subaccounts)
- [Check Email Availability](#check-email-availability)
- [Create a Subaccount](#create-a-subaccount)
- [Limitations](#limitations)
- [Subaccount Details](#subaccount-details)
- [Quotas and Status](#quotas-and-status)
- [Authorize as a Subaccount](#authorize-as-a-subaccount)
- [Agency Branding](#agency-branding)
- [Recipe: Onboard a Client Subaccount End to End](#recipe-onboard-a-client-subaccount-end-to-end)
- [Next Steps](#next-steps)

---

## List Subaccounts

**`GET /subaccounts/list`**

```bash
curl -G https://pro.api.serversmtp.com/api/v2/subaccounts/list \
  -H "Authorization: $TURBO_API_KEY" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=10" \
  --data-urlencode "filter_by_active=true"
```

### Query Parameters

| Parameter | Description |
|---|---|
| `page` / `limit` | Paging (defaults `1` / `10`) |
| `filter_by_email` | Full or partial email match |
| `filter_by_active` | `true` / `false` |
| `filter_by_ip[]` | One or more sending IPv4 addresses (repeat the parameter) |
| `order_by` | `email` (default) or `last_used` |
| `ordertype` | `asc` or `desc` |

Response:

```json
{
  "count": 1,
  "results": [
    {
      "active": true,
      "email": "subaccount-1@yourdomain.com",
      "subaccount_id": 19302132,
      "parent_id": 22190623,
      "ip": "199.244.75.250",
      "last_used": "2022-11-20 22:44:07",
      "limit": 16,
      "plan_expiration": "2023-01-17 00:00:00",
      "sent": 2,
      "plan_limit_interval": "Monthly",
      "expired": false
    }
  ]
}
```

`limit` is the allowed send volume per `plan_limit_interval` (`Daily`, `Monthly`, or `Yearly` — always following the main account's interval); `sent` is usage in the current period; `-1` means unlimited. `expired` indicates whether the plan expiration date is overdue.

[Try it in the API reference →](../api-reference/index.html#/subaccounts/getSubaccounts)

---

## Check Email Availability

**`GET /subaccounts/email-exists`**

Before creating a subaccount, you can check whether an email address is already taken anywhere on TurboSMTP with this endpoint — it returns `{"result": true}` if it exists.

```bash
curl -G https://pro.api.serversmtp.com/api/v2/subaccounts/email-exists \
  -H "Authorization: $TURBO_API_KEY" \
  --data-urlencode "Email=client@clientdomain.com"
```

Response:

```json
{
  "result": true
}
```

Note: The parameter name `Email` is capitalized.

[Try it in the API reference →](../api-reference/index.html#/subaccounts/checkEmailExists)

---

## Create a Subaccount

**`POST /subaccounts`**

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/subaccounts \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@clientdomain.com",
    "first_name": "Andrea",
    "last_name": "Willems",
    "password": "LetmeIn123!",
    "confirm_password": "LetmeIn123!",
    "ip": "185.228.36.19",
    "policy_agree": true,
    "company_name": "Refreshing Soda Inc."
  }'
```

Response (`201 Created`):

```json
{
  "active": true,
  "email": "client@clientdomain.com",
  "subaccount_id": 19302132,
  "parent_id": 22190623,
  "ip": "185.228.36.19",
  "first_name": "Andrea",
  "last_name": "Willems",
  "address_1": "",
  "address_2": "",
  "city": "",
  "company_name": "Refreshing Soda Inc.",
  "country": "",
  "region": "",
  "zip_code": "",
  "phone_number": "",
  "policy_agree": true,
  "site_url": ""
}
```

| Field | Required | Notes |
|---|---|---|
| `email` | Yes | Must not already exist on TurboSMTP |
| `first_name` / `last_name` | Yes | 1–50 characters |
| `password` / `confirm_password` | Yes | ≥10 chars, at least one uppercase character, one lowercase character, and one digit |
| `ip` | Yes | Sending IP — **must be an IPv4 address already associated with your (parent) account**, else `400` `ip_not_associated_to_user_account` |
| `policy_agree` | Yes | Must be `true` |
| `address_1`, `address_2`, `city`, `region`, `country`, `zip_code`, `phone_number`, `company_name`, `site_url` | No | Owner/agency details |

Use the public country/state lookups in [Account → Reference Data](account.md#reference-data) to populate `country` and `region`.

[Try it in the API reference →](../api-reference/index.html#/subaccounts/createSubaccount)

---

## Limitations

The API currently provides **no endpoint to delete a subaccount**. To fully retire one, deactivate it and set its sending limit to `0`:

**1. Deactivate the subaccount:**

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/subaccounts/19302132/updatesubaccountstatus \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

**2. Set limit to `0` to prevent any sending:**

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/subaccounts/19302132/updatesubaccountsmtplimit \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 0}'
```

A delete endpoint capability is tracked for a future API release.

---

## Subaccount Details

### Get

**`GET /subaccounts/{Id}`**

```bash
curl https://pro.api.serversmtp.com/api/v2/subaccounts/19302132 \
  -H "Authorization: $TURBO_API_KEY"
```

Response:

```json
{
  "active": true,
  "email": "subaccount-1@yourdomain.com",
  "subaccount_id": 19302132,
  "parent_id": 22190623,
  "ip": "199.244.75.250",
  "first_name": "Andrea",
  "last_name": "Willems",
  "address_1": "",
  "address_2": "",
  "city": "",
  "company_name": "Refreshing Soda Inc.",
  "country": "",
  "region": "",
  "zip_code": "",
  "phone_number": "",
  "policy_agree": true,
  "site_url": ""
}
```

Unknown IDs return `404` with `subaccount_not_found`.

[Try it in the API reference →](../api-reference/index.html#/subaccounts/getSubaccountDetails)

### Update

**`PATCH /subaccounts/{Id}`**

```bash
curl -X PATCH https://pro.api.serversmtp.com/api/v2/subaccounts/19302132 \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Andreas",
    "last_name": "Willems",
    "ip": "199.244.75.250",
    "policy_agree": true
  }'
```

Response:

```json
{
  "active": true,
  "email": "subaccount-1@yourdomain.com",
  "subaccount_id": 19302132,
  "parent_id": 22190623,
  "ip": "199.244.75.250",
  "first_name": "Andreas",
  "last_name": "Willems",
  "address_1": "",
  "address_2": "",
  "city": "",
  "company_name": "Refreshing Soda Inc.",
  "country": "",
  "region": "",
  "zip_code": "",
  "phone_number": "",
  "policy_agree": true,
  "site_url": ""
}
```

Update the same fields as creation (email excluded); `first_name`, `last_name`, `ip`, and `policy_agree` are required in the body. The same password and IP validations apply when those fields are sent.

[Try it in the API reference →](../api-reference/index.html#/subaccounts/updateSubaccount)

---

## Quotas and Status

### Sending Limit

**`POST /subaccounts/{Id}/updatesubaccountsmtplimit`**

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/subaccounts/19302132/updatesubaccountsmtplimit \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 2000}'
```

Response:

```json
{
  "subaccount_id": 19302132,
  "parent_id": 22190623,
  "ip": "199.244.75.250",
  "active": true,
  "limit": 2000,
  "sent": 0,
  "last_used": null,
  "plan_expiration": "2023-01-17 00:00:00",
  "plan_limit_interval": "Monthly",
  "expired": false
}
```

`limit` is the number of emails per the plan's interval. **`-1` means no limit.** It cannot exceed your parent account's limit (`400` `limit_should_not_be_higher_than_parent_account_limit`) or be lower than `-1`.

[Try it in the API reference →](../api-reference/index.html#/subaccounts/UpdateSubaccountSMTPLimit)

### Active Status

**`POST /subaccounts/{Id}/updatesubaccountstatus`**

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/subaccounts/19302132/updatesubaccountstatus \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

Response:

```json
{
  "subaccount_id": 19302132,
  "parent_id": 22190623,
  "ip": "199.244.75.250",
  "active": false,
  "limit": 2000,
  "sent": 0,
  "last_used": null,
  "plan_expiration": "2023-01-17 00:00:00",
  "plan_limit_interval": "Monthly",
  "expired": false
}
```

Users cannot log in to an inactive subaccount; note that sending also requires the subaccount's subscription to be active.

[Try it in the API reference →](../api-reference/index.html#/subaccounts/UpdateSubaccountStatus)

### Current Plan

**`GET /subaccounts/{Id}/active-plan`**

```bash
curl https://pro.api.serversmtp.com/api/v2/subaccounts/19302132/active-plan \
  -H "Authorization: $TURBO_API_KEY"
```

Response:

```json
{
  "subaccount_id": 19302132,
  "parent_id": 22190623,
  "ip": "199.244.75.250",
  "active": true,
  "limit": 16,
  "sent": 2,
  "last_used": null,
  "plan_expiration": "2023-01-17 00:00:00",
  "plan_limit_interval": "Monthly",
  "expired": false
}
```

Returns the subaccount's ID, parent ID, IP address, active status, limit, usage (`sent`), last used timestamp, plan expiration, plan interval, and expired flag.

[Try it in the API reference →](../api-reference/index.html#/subaccounts/CheckPlan)

---

## Authorize as a Subaccount

**`POST /subaccounts/authorize`**

Obtain an API key that acts as the subaccount, for support or management tasks:

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/subaccounts/authorize \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "client@clientdomain.com"}'
```

Response:

```json
{
  "auth": "f8efa7be4e7457c463e8b800e1f11f92072d272c"
}
```

Use the returned `auth` value as the `Authorization` header — subsequent calls operate in the subaccount's context, exactly like a key from [`POST /authorize`](getting-started.md#get-an-api-key).

[Try it in the API reference →](../api-reference/index.html#/subaccounts/SubaccountAuthenticationLogin)

---

## Agency Branding

### Logo

**`GET /subaccounts/logo`**

```bash
curl https://pro.api.serversmtp.com/api/v2/subaccounts/logo \
  -H "Authorization: $TURBO_API_KEY"
```

Response:

```json
{
  "logoUrl": "https://..."
}
```

[Try it in the API reference →](../api-reference/index.html#/subaccounts/getAgencyLogo)

**`POST /subaccounts/logo`**

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/subaccounts/logo \
  -H "Authorization: $TURBO_API_KEY" \
  -F "file=@agency-logo.png"
```

Response (`201 Created`):

```json
{
  "logoUrl": "https://..."
}
```

[Try it in the API reference →](../api-reference/index.html#/subaccounts/uploadAgencyLogo)

**`DELETE /subaccounts/logo`**

```bash
curl -X DELETE https://pro.api.serversmtp.com/api/v2/subaccounts/logo \
  -H "Authorization: $TURBO_API_KEY"
```

Response:

```json
{
  "message": "success"
}
```

[Try it in the API reference →](../api-reference/index.html#/subaccounts/deleteAgencyLogo)

### Agency Details

**`GET /subaccounts/agency`**

```bash
curl https://pro.api.serversmtp.com/api/v2/subaccounts/agency \
  -H "Authorization: $TURBO_API_KEY"
```

Response:

```json
{
  "logoUrl": "https://turbosmtp.s3.amazonaws.com/logo/default_logo.svg",
  "agency_name": "My Agency Inc.",
  "agency_website": "https://www.mywebsite.com",
  "agency_footer": "My signature goes here."
}
```

[Try it in the API reference →](../api-reference/index.html#/subaccounts/getAgencySettings)

**`PATCH /subaccounts/agency`**

```bash
curl -X PATCH https://pro.api.serversmtp.com/api/v2/subaccounts/agency \
  -H "Authorization: $TURBO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agency_name": "My Agency Inc.",
    "agency_website": "https://www.mywebsite.com",
    "agency_footer": "My signature goes here."
  }'
```

Response:

```json
{
  "message": "success"
}
```

| Field | Max length |
|---|---|
| `agency_name` | 128 |
| `agency_website` | 128 |
| `agency_footer` | 2048 |

[Try it in the API reference →](../api-reference/index.html#/subaccounts/updateAgencySettings)

---

## Recipe: Onboard a Client Subaccount End to End

Walk through the full lifecycle of a client subaccount — from checking availability to monitoring usage — in a single, repeatable flow:

1. **Verify the email is not already registered** — call `GET /subaccounts/email-exists?Email=<address>` before creating; a `{"result": true}` means the address is taken anywhere on TurboSMTP and the creation will fail.

2. **Create the subaccount with required fields only** — call `POST /subaccounts` with `email`, `first_name`, `last_name`, `password`, `ip`, and `policy_agree`; use an IP already associated with your parent account (`ip_not_associated_to_user_account` is the most common creation failure).

3. **Set a sending quota that matches the client's tier** — call `POST /subaccounts/{Id}/updatesubaccountsmtplimit` immediately after creation; avoid leaving the limit at the inherited default — set `-1` only when you explicitly want unlimited sending, and never higher than your parent account's own limit.

4. **Authorize as the subaccount to verify the setup** — call `POST /subaccounts/authorize` with the subaccount email to obtain a scoped API key; use it to confirm the client sees the correct plan, quota, and agency branding before distributing credentials (see [Agency Branding](#agency-branding) to configure your logo and identity first).

5. **Poll active-plan to track usage over time** — call `GET /subaccounts/{Id}/active-plan` regularly to monitor `sent` vs `limit` and watch the `expired` flag; combine with parent-account usage alerts (see [Account → Usage Alerts](account.md#usage-alerts)) to catch quota exhaustion before it affects delivery.

---

## Next Steps

- [Account management (consumer keys, alerts)](account.md)
- [Getting started with authentication](getting-started.md)
- [Full API reference →](../api-reference/index.html)
