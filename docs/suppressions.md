# Suppressions

A suppression is an address TurboSMTP will not deliver to — because it bounced, complained, unsubscribed, failed validation, or was blocked manually. Suppressions protect your sender reputation; this API lets you query, import, export, and delete them.

> **Authentication:** all endpoints on this page accept either auth method — `Authorization: $TURBO_API_KEY` or the `consumerKey`/`consumerSecret` header pair. See [Getting Started](getting-started.md).

**On this page:**

- [Query Suppressions](#query-suppressions)
- [Add Suppressions](#add-suppressions)
- [Delete Suppressions](#delete-suppressions)
- [Export to CSV](#export-to-csv)
- [Suppression Records](#suppression-records)
- [Recipe: Protect Your Reputation](#recipe-protect-your-reputation)
- [Next Steps](#next-steps)

---

## Query Suppressions

**`GET /suppressions`**

```bash
curl -G https://pro.api.serversmtp.com/api/v2/suppressions \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  --data-urlencode "from=2026-01-01" \
  --data-urlencode "to=2026-12-31" \
  --data-urlencode "filter_by=manual" \
  --data-urlencode "limit=10" \
  --data-urlencode "page=1"
```

### Query Parameters

| Parameter | Required | Description |
|---|---|---|
| `from` | Yes | Start date, format `yyyy-mm-dd` |
| `to` | Yes | End date, format `yyyy-mm-dd` |
| `page` | No | Page number (default `1`) |
| `limit` | No | Rows per page (default `10`) |
| `filter` | No | Text to search across recipient, sender, subject, and reason |
| `filter_by` | No | Restrict to one or more **sources** (`manual`, `bounce`, `spam`, `unsubscribe`, `validation_failed`) |
| `smart_search` | No | `true`/`false` (default `false`) |
| `orderby` | No | Sort field: `date` (default), `source`, `recipient`, `reason` |
| `ordertype` | No | `asc` or `desc` (default `desc`) |
| `tz` | No | Timezone offset, e.g. `-07:00` |

> **Careful:** `filter_by` here selects suppression **sources**. On the [Analytics](analytics.md) endpoint the same parameter name selects which *fields* the text filter applies to — they are not interchangeable.

### Response

```json
{
  "count": 5,
  "results": [
    {
      "date": "2026-03-18 14:22:15",
      "sender": "newsletter@example.com",
      "source": "bounce",
      "subject": "March Newsletter",
      "recipient": "user1@example.com",
      "reason": "550 5.1.2 The email account does not exist"
    },
    {
      "date": "2026-03-17 09:45:30",
      "sender": "marketing@example.com",
      "source": "spam",
      "subject": "Limited Time Offer",
      "recipient": "user2@example.com",
      "reason": "Marked as spam"
    },
    {
      "date": "2026-03-16 11:20:00",
      "sender": "support@example.com",
      "source": "unsubscribe",
      "subject": "Support Updates",
      "recipient": "user3@example.com",
      "reason": "Unsubscribe link clicked"
    },
    {
      "date": "2026-03-15 16:55:42",
      "sender": "",
      "source": "manual",
      "subject": "",
      "recipient": "user4@example.com",
      "reason": "Manually added via dashboard"
    },
    {
      "date": "2026-03-14 08:30:00",
      "sender": "noreply@example.com",
      "source": "validation_failed",
      "subject": "Welcome Email",
      "recipient": "invalid@test",
      "reason": "Invalid email format"
    }
  ]
}
```

[Try it in the API reference →](../api-reference/index.html#/suppressions/getSuppressions)

`400` errors: `missing_required_parameter_from`, `from_format_should_be_yyyy-mm-dd`, `missing_required_parameter_to`, `to_format_should_be_yyyy-mm-dd`, `page_should_be_integer`, `page_should_be_greater_than_0`, `limit_should_be_integer`, `limit_should_be_greater_than_0`, `smart_search_should_be_true_or_false`, `orderby_can_only_be_date_or_source_or_recipient_or_reason`, `ordertype_should_be_asc_or_desc`.

### Advanced Filtering via POST

**`POST /suppressions`** accepts the same filters as a JSON body, plus a `restrict` array that GET does not support. Each restriction targets one field with an include/exclude match:

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/suppressions \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "2026-01-01",
    "to": "2026-12-31",
    "filter_by": ["manual"],
    "page": 1,
    "limit": 10,
    "restrict": [
      { "by": "recipient", "operator": "exclude", "filter": "@example-test-domain.invalid" }
    ]
  }'
```

Returns the same format as [GET /suppressions](#query-suppressions) above (an object with `count` and `results` array).

| `restrict[].field` | Values |
|---|---|
| `by` | `sender`, `recipient`, `reason`, `subject` |
| `operator` | `include`, `exclude` |
| `filter` | Text to match |
| `smart_search` | `true`/`false` |

[Try it in the API reference →](../api-reference/index.html#/suppressions/filterSuppressions)

`400` errors: `missing_required_parameter_from`, `from_format_should_be_yyyy-mm-dd`, `missing_required_parameter_to`, `to_format_should_be_yyyy-mm-dd`, `page_should_be_integer`, `page_should_be_greater_than_0`, `limit_should_be_integer`, `limit_should_be_greater_than_0`, `smart_search_should_be_true_or_false`, `orderby_can_only_be_date_or_source_or_recipient_or_reason`, `ordertype_should_be_asc_or_desc`.

---

## Add Suppressions

**`POST /suppressions/import`** — two request formats:

**JSON** (`type: "manual"`) for a list of addresses:

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/suppressions/import \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "manual",
    "reason": "unsubscribe requests from support tickets",
    "content": ["user1@example.com", "user2@example.com"]
  }'
```

**Multipart** (`type: "file"`) for a CSV or TXT file:

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/suppressions/import \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -F "type=file" \
  -F "reason=imported removal requests" \
  -F "file=@suppressions.csv"
```

Response — addresses are partitioned into accepted and rejected:

```json
{
  "status": "success",
  "valid": ["valid.email.1@gmail.com", "valid.email.2@gmail.com"],
  "invalid": ["invalid@email"]
}
```

`400` errors: `missing_upload_file`, `invalid_mail_address_list`.

[Try it in the API reference →](../api-reference/index.html#/suppressions/importSuppressions)

---

## Delete Suppressions

> **Deleting a suppression means TurboSMTP will deliver to that address again.** Only remove entries you are certain were suppressed in error — re-sending to bounced or complaining addresses damages your sender reputation.

### By Address List

**`POST /suppressions/bulk_delete`** — the request body is a **bare JSON array** of email addresses:

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/suppressions/bulk_delete \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -H "Content-Type: application/json" \
  -d '["user1@example.com", "user2@example.com"]'
```

Response: `{"success": true}`. Sending an empty list returns `400` with `no_contacts_were_provided`.

[Try it in the API reference →](../api-reference/index.html#/suppressions/bulkDeleteSuppressions)

### By Filter

**`POST /suppressions/delete`** — deletes **every suppression matching the filter**. Accepts the same body as `POST /suppressions` (without paging/ordering): `from`/`to` (required), `tz`, `filter`, `filter_by`, `smart_search`, `restrict`.

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/suppressions/delete \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "2026-01-01",
    "to": "2026-01-31",
    "filter_by": ["manual"],
    "filter": "imported removal request"
  }'
```

> **Destructive operation.** A broad date range with no `filter`/`filter_by` deletes *all* suppressions in that range — bounces and spam complaints included. Run the identical body against `POST /suppressions` first to preview exactly what will be removed.

[Try it in the API reference →](../api-reference/index.html#/suppressions/deleteFilterSuppressions)

`400` errors: `missing_required_parameter_from`, `from_format_should_be_yyyy-mm-dd`, `missing_required_parameter_to`, `to_format_should_be_yyyy-mm-dd`, `smart_search_should_be_true_or_false`.

---

## Export to CSV

**`GET /suppressions/csv`** — same query parameters as `GET /suppressions` (no paging), returns `text/csv` with columns `Status;Subject;From;To;Date;Reason`:

```bash
curl -G https://pro.api.serversmtp.com/api/v2/suppressions/csv \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  --data-urlencode "from=2026-01-01" \
  --data-urlencode "to=2026-12-31" \
  -o suppressions-yearly.csv
```

### Response

```csv
Status;Subject;From;To;Date;Reason
MANUAL;;;user5@example.com;2026-06-22T12:36:34.560Z;"imported removal requests"
MANUAL;;;user4@example.com;2026-06-22T12:36:34.560Z;"imported removal requests"
FAIL;"March Newsletter";newsletter@example.com;user2@example.com;2026-03-17T09:45:30.000Z;"550 5.1.2 The email account does not exist"
BOUNCE;"March Newsletter";newsletter@example.com;user3@example.com;2026-03-16T11:20:00.000Z;"Permanent failure"
```

`400` errors: `missing_required_parameter_from`, `from_format_should_be_yyyy-mm-dd`, `missing_required_parameter_to`, `to_format_should_be_yyyy-mm-dd`, `smart_search_should_be_true_or_false`, `orderby_can_only_be_date_or_source_or_recipient_or_reason`, `ordertype_should_be_asc_or_desc`.

**`POST /suppressions/csv`** — the same export driven by a JSON filter body (including `restrict`), for when GET query strings aren't expressive enough:

```bash
curl -X POST https://pro.api.serversmtp.com/api/v2/suppressions/csv \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "2026-01-01",
    "to": "2026-12-31",
    "filter_by": ["manual"],
    "restrict": [
      { "by": "recipient", "operator": "exclude", "filter": "@example-test-domain.invalid" }
    ]
  }' \
  -o suppressions-yearly-filtered.csv
```

Returns the same CSV format as [GET /suppressions/csv](#export-to-csv) above.

`400` errors: `missing_required_parameter_from`, `from_format_should_be_yyyy-mm-dd`, `missing_required_parameter_to`, `to_format_should_be_yyyy-mm-dd`, `smart_search_should_be_true_or_false`, `orderby_can_only_be_date_or_source_or_recipient_or_reason`, `ordertype_should_be_asc_or_desc`.

[Try it in the API reference →](../api-reference/index.html#/suppressions/exportSuppressionsDataCSV)

---

## Suppression Records

Each suppression has these fields:

| Field | Description |
|---|---|
| `date` | When the suppression was recorded, `YYYY-MM-DD HH:MM:SS` |
| `recipient` | The suppressed email address |
| `sender` | Sender of the message that triggered the suppression (may be `null`) |
| `source` | How the address was suppressed (see below) |
| `subject` | Subject of the triggering message (empty for manual entries) |
| `reason` | Detail string, e.g. an SMTP error (may be `null`) |

### Sources

| `source` | Meaning |
|---|---|
| `manual` | Added by you, via dashboard, import, or API |
| `bounce` | Delivery permanently failed (hard bounce) |
| `spam` | Recipient reported the message as spam |
| `unsubscribe` | Recipient unsubscribed |
| `validation_failed` | Address failed [email validation](validation.md) |

---

## Recipe: Protect Your Reputation

Every bounce, spam complaint, or invalid send damages your sender reputation. ISPs track this closely; a poor score lands your mail in spam or gets you blacklisted. Suppressions prevent sending to addresses you know will fail.

1. **After sending a campaign:** Query [Analytics](analytics.md) for bounces and complaints from the past 30 days.
2. **Import bounced/complained addresses:** Use the [Add Suppressions](#add-suppressions) endpoint to bulk import addresses with reason `bounced` or `complained`.
3. **Validate new lists:** Run addresses through [Email Validator](validation.md) and manually suppress any `invalid`, `spamtrap`, or `abuse` before sending.
4. **Monitor weekly:** [Export your suppressions to CSV](#export-to-csv) and review for patterns (e.g., spike from a specific domain).

---

## Next Steps

- [Validate addresses before sending to avoid bounces](validation.md)
- [Monitor bounce events in Analytics](analytics.md)
- [React to bounces in real time with webhooks](webhooks.md)
