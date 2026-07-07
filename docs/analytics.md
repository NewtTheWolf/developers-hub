# Analytics

Look up individual messages and their delivery and engagement lifecycle — queued, delivered, opened, clicked, bounced, reported as spam — for everything you send through TurboSMTP. These endpoints return per-message records, not pre-computed totals; any aggregate figures you report are derived from these records.

> **Authentication:** all endpoints on this page accept either auth method — `Authorization: $TURBO_API_KEY` or the `consumerKey`/`consumerSecret` header pair. See [Getting Started](getting-started.md).
>
> Analytics lives on the **main host** `https://pro.api.serversmtp.com/api/v2` — not on the send host.

**On this page:**

- [List Analytics Data](#list-analytics-data)
- [Get a Single Message](#get-a-single-message)
- [Export to CSV](#export-to-csv)
- [Message Statuses](#message-statuses)
- [Recipe: Track a Campaign](#recipe-track-a-campaign)
- [Next Steps](#next-steps)

---

## List Analytics Data

**`GET /analytics`**

```bash
curl -G https://pro.api.serversmtp.com/api/v2/analytics \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  --data-urlencode "from=2026-01-01" \
  --data-urlencode "to=2026-12-31" \
  --data-urlencode "status[]=SUCCESS" \
  --data-urlencode "status[]=OPEN" \
  --data-urlencode "status[]=CLICK" \
  --data-urlencode "status[]=FAIL" \
  --data-urlencode "status[]=SYSFAIL" \
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
| `status[]` | No | Filter by status — repeat the parameter for multiple values (see encoding above) |
| `filter` | No | Text to search (recipient, sender, subject, domain, or campaign ID) |
| `filter_by` | No | Which fields `filter` applies to: `subject`, `sender`, `recipient`, `domain` |
| `smart_search` | No | `true`/`false` (default `false`) |
| `orderby` | No | Sort field: `send_time` (default), `sender`, `recipient`, `subject` |
| `ordertype` | No | `asc` or `desc` (default `desc`) |
| `tz` | No | Timezone offset, e.g. `-07:00` |

### Response

```json
{
  "count": 2,
  "results": [
    {
      "id": 1800872493473407000,
      "subject": "Newsletter update",
      "sender": "sample@gmail.com",
      "recipient": "robert-doe@elecronic-arts.com",
      "send_time": "2023-08-10 04:04:21",
      "status": "SUCCESS",
      "domain": "gmail.com",
      "error": "",
      "recipient_domain": "electronic-arts.com",
      "x_campaign_id": "Offer AB Test."
    },
    {
      "id": 1800871904471490600,
      "subject": "New Movies",
      "sender": "sales@gmail.com",
      "recipient": "jhon-doe@datamart.com",
      "send_time": "2023-08-11 04:04:21",
      "status": "FAIL",
      "domain": "gmail.com",
      "error": "142.250.138.27 does not like recipient.\nRemote host said: 550-5.1.1 The email account does not exist.",
      "recipient_domain": "datamart.com",
      "x_campaign_id": "Offer AB Test."
    }
  ]
}
```

| Field | Description |
|---|---|
| `id` | Message ID (64-bit integer — same precision caveat as `mid` from [`/mail/send`](transactional.md)) |
| `send_time` | When the message was sent, `YYYY-MM-DD HH:MM:SS` |
| `status` | Current [message status](#message-statuses) |
| `domain` / `recipient_domain` | Domain part of the sender / recipient address |
| `x_campaign_id` | Value of the `X-campaign-ID` field passed at send time |
| `error` | SMTP error string for failed deliveries (empty otherwise) |

[Try it in the API reference →](../api-reference/index.html#/analytics/getAnalyticsData)

`400` errors: `missing_required_parameter_from`, `missing_required_parameter_to`, `from_format_should_be_yyyy-mm-dd`, `to_format_should_be_yyyy-mm-dd`, `page_should_be_integer`, `page_should_be_greater_than_0`, `limit_should_be_integer`, `limit_should_be_greater_than_0`, `invalid_status_value`, `missing_required_parameter_filter_by`, `filter_by_can_only_be_subject_or_sender_or_recipient_or_domain`, `smart_search_should_be_true_or_false`, `orderby_can_only_be_subject_or_sender_or_recipient_or_domain`, `ordertype_should_be_asc_or_desc`.

---

## Get a Single Message

**`GET /analytics/{Id}`** — look up one message by ID. Use the `id` from a list response, or the `mid` returned by `/mail/send`.

```bash
curl https://pro.api.serversmtp.com/api/v2/analytics/1800872493473406976 \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET"
```

Response:

```json
{
  "id": 1800872493473406976,
  "subject": "Newsletter update",
  "sender": "sample@gmail.com",
  "recipient": "robert-doe@electronic-arts.com",
  "send_time": "2023-08-10 04:04:21",
  "status": "SUCCESS",
  "domain": "gmail.com",
  "error": "",
  "recipient_domain": "electronic-arts.com",
  "contact_domain": "electronic-arts.com",
  "x_campaign_id": "Offer AB Test."
}
```

Returns a single message object (same shape as the list `results` items). An unknown ID returns `404` with `{"message": "email_not_found"}`.

[Try it in the API reference →](../api-reference/index.html#/analytics/getAnalyticsDataByID)

`400` errors: `invalid_id` (non-integer). `404` errors: `email_not_found`.

---

## Export to CSV

**`GET /analytics/csv`** — same filters as the list endpoint (no paging), returns `text/csv`.

```bash
curl -G https://pro.api.serversmtp.com/api/v2/analytics/csv \
  -H "consumerKey: $CONSUMER_KEY" \
  -H "consumerSecret: $CONSUMER_SECRET" \
  --data-urlencode "from=2026-01-01" \
  --data-urlencode "to=2026-01-31" \
  -o analytics-january.csv
```

```csv
1871534200146968576,DEFER,"Fwd: Test",test@emailchef.com,test@live.com,"Wednesday, February 21 2024 7:48 AM"," Connected to 104.47.51.161 but connection died. (#4.4.2)
1871533807186821120,DEFER,"Test send",test@emailchef.com,test@live.com,"Wednesday, February 21 2024 7:47 AM"," Connected to 104.47.55.161 but connection died. (#4.4.2)
```

[Try it in the API reference →](../api-reference/index.html#/analytics/exportAnalyticsDataCSV)

`400` errors: `missing_required_parameter_from`, `missing_required_parameter_to`, `from_format_should_be_yyyy-mm-dd`, `to_format_should_be_yyyy-mm-dd`, `invalid_status_value`, `missing_required_parameter_filter_by`, `filter_by_can_only_be_subject_or_sender_or_recipient_or_domain`, `smart_search_should_be_true_or_false`, `orderby_can_only_be_subject_or_sender_or_recipient_or_domain`, `ordertype_should_be_asc_or_desc`.

---

## Message Statuses

Every sent message has exactly one current status:

| Status | Meaning |
|---|---|
| `NEW` | Email has been queued for delivery |
| `DEFER` | Email is in the queue for delivery |
| `SUCCESS` | Email has been delivered |
| `OPEN` | Email has been opened |
| `CLICK` | Email has been clicked |
| `REPORT` | Email has been reported as spam |
| `FAIL` | Email has bounced |
| `SYSFAIL` | Email was dropped |
| `UNSUB` | Recipient unsubscribed |

TurboSMTP aggregates these statuses into the groups you see in the [TurboSMTP Web dashboard](https://dashboard.serversmtp.com/dashboard):

| Group | Statuses included |
|---|---|
| Queued | `NEW`, `DEFER` |
| Delivered | `SUCCESS`, `OPEN`, `CLICK`, `UNSUB`, `REPORT` |
| Opens | `OPEN`, `CLICK`, `UNSUB`, `REPORT` |
| Clicks | `CLICK` |
| Unsubscribes | `UNSUB` |
| Spam | `REPORT` |
| Bounce | `FAIL` |
| Drop | `SYSFAIL` |

> **Groups overlap.** A clicked message counts toward Delivered, Opens, and Clicks at the same time — the groups are cumulative views over the single underlying status, not mutually exclusive buckets.

---

## Recipe: Track a Campaign

1. Send messages with a campaign label:

   ```json
   { "from": "...", "to": "...", "subject": "...", "X-campaign-ID": "spring-launch" }
   ```

2. Search results for the campaign label (each result carries it back as `x_campaign_id`):

   ```bash
   curl -G https://pro.api.serversmtp.com/api/v2/analytics \
     -H "consumerKey: $CONSUMER_KEY" \
     -H "consumerSecret: $CONSUMER_SECRET" \
     --data-urlencode "from=2026-01-01" \
     --data-urlencode "to=2026-01-31" \
     --data-urlencode "filter=spring-launch"
   ```

   > `filter_by` accepts only `subject`, `sender`, `recipient`, or `domain` — it cannot target `x_campaign_id` directly. Use the campaign label as the free-text `filter` value and check `x_campaign_id` in the results.

---

## Next Steps

- [Receive these events in real time via webhooks](webhooks.md)
- [Handle bounces with Suppressions](suppressions.md)
- [Full API reference](../api-reference/index.html#/analytics/getAnalyticsData)
