# Event Webhook

Receive real-time notifications for delivery and engagement events as TurboSMTP processes your messages.

> The Event Webhook is configured from the TurboSMTP dashboard — it is not managed through the API described elsewhere in this hub. This page documents the events TurboSMTP pushes to your endpoint and shows how they relate to the send and analytics APIs.

**On this page:**

- [Event Types](#event-types)
- [Payload Fields](#payload-fields)
- [Example Payloads](#example-payloads)
  - [Processed](#processed)
  - [Dropped](#dropped)
  - [Delivered](#delivered)
  - [Deferred](#deferred)
  - [Bounced](#bounced)
  - [Opened](#opened)
  - [Clicked](#clicked)
  - [Unsubscribed](#unsubscribed)
  - [Spam Report](#spam-report)
- [Correlating Events with Your System](#correlating-events-with-your-system)
- [Next Steps](#next-steps)

---

## Event Types

The status of email delivery to the recipient is indicated by **delivery events**, while a recipient's interaction with the email is represented by **engagement events**.

### Delivery Events

| Event | Trigger |
|---|---|
| `PROCESSED` | Message accepted and queued for delivery |
| `DELIVERED` | Message delivered to the recipient's mail server |
| `DEFERRED` | Delivery temporarily delayed — will be retried |
| `BOUNCED` | Message permanently rejected by the recipient's server |
| `DROPPED` | Message dropped without delivery |

### Engagement Events

| Event | Trigger |
|---|---|
| `OPENED` | Recipient opened the email |
| `CLICKED` | Recipient clicked a tracked link |
| `UNSUBSCRIBED` | Recipient unsubscribed |
| `REPORT` | Recipient reported the message as spam |

For querying the same lifecycle historically (rather than receiving it as a push), see the [Analytics](analytics.md) status model.

---

## Payload Fields

### Common Fields (all events)

| Field | Description |
|---|---|
| `id` | Event identifier |
| `mid` | Message ID — matches the `mid` returned by [`POST /mail/send`](transactional.md) |
| `status` | The event type (see tables above) |
| `email` | Recipient address |
| `subject` | Email subject (may be `null`) |
| `timestamp` | Event time as Unix time, GMT+0 |

### Conditional Fields

| Field | Type | Present on | Description |
|---|---|---|---|
| `reason` | object | `DROPPED`, `BOUNCED` | Error details from the receiving server. An object whose `response` key holds the server's message (a duplicate is also keyed under `"0"`). |
| `reason` | string | `DEFERRED` | The SMTP deferral message returned by the receiving server. |
| `attempt` | number | `DEFERRED` | Delivery attempt count |
| `useragent` | string | `OPENED`, `CLICKED` | Recipient browser/client information |
| `ip` | string | `OPENED`, `CLICKED` | Recipient IP address |
| `url` | string | `CLICKED` | The clicked link |

> **`reason` is not the same type on every event.** On `DROPPED` and `BOUNCED` it is an object (read the server text from `reason.response`); on `DEFERRED` it is a plain string. Parse accordingly.

---

## Example Payloads

### Processed

```json
{
 "id": "5943788912",
 "mid": "5520611177",
 "status": "PROCESSED",
 "email": "example@turbo-smtp.com",
 "subject": "Test Email",
 "timestamp": 1576709777
}
```

### Dropped

```json
{
 "id": "5943799537",
 "mid": "5520621607",
 "status": "DROPPED",
 "email": "example@turbo-smtp.com",
 "subject": null,
 "timestamp": 1576710200,
 "reason": {
   "0": "Dropped due to complaining recipient",
   "response": "Dropped due to complaining recipient"
 }
}
```

### Delivered

```json
{
 "id": "5943788912",
 "mid": "5520611177",
 "status": "DELIVERED",
 "email": "example@turbo-smtp.com",
 "subject": "Test Email",
 "timestamp": 1576709777
}
```

### Deferred

```json
{
 "id": "5943788913",
 "mid": "5520611177",
 "status": "DEFERRED",
 "email": "example@turbo-smtp.com",
 "subject": "Test Email",
 "timestamp": 1576709777,
 "reason": "400 try again later",
 "attempt": 2
}
```

### Bounced

```json
{
 "id": "5943830007",
 "mid": "5520650288",
 "status": "BOUNCED",
 "email": "example@turbo-smtp.com",
 "subject": "Test Email",
 "timestamp": 1576711314,
 "reason": {
   "0": "104.47.38.36 does not like recipient. Remote host said: 550 5.4.1 Recipient address rejected: Access denied. AS(201806281) [BL2NAM02FT016.eop-nam02.prod.protection.outlook.com] {199.244.74.162} Giving up on 104.47.38.36. ",
   "response": "104.47.38.36 does not like recipient. Remote host said: 550 5.4.1 Recipient address rejected: Access denied. AS(201806281) [BL2NAM02FT016.eop-nam02.prod.protection.outlook.com] {199.244.74.162} Giving up on 104.47.38.36. "
 }
}
```

### Opened

```json
{
 "id": "5943788913",
 "mid": "5520611177",
 "status": "OPENED",
 "email": "example@turbo-smtp.com",
 "subject": "Test Email",
 "timestamp": 1576709777,
 "useragent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
 "ip": "40.101.136.165"
}
```

### Clicked

```json
{
 "id": "5943788913",
 "mid": "5520611177",
 "status": "CLICKED",
 "email": "example@turbo-smtp.com",
 "subject": "Test Email",
 "timestamp": 1576709777,
 "useragent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
 "url": "https://serversmtp.com",
 "ip": "156.218.154.17"
}
```

### Unsubscribed

```json
{
 "id": "5943788913",
 "mid": "5520611177",
 "status": "UNSUBSCRIBED",
 "email": "example@turbo-smtp.com",
 "subject": "Test Email",
 "timestamp": 1576709777
}
```

### Spam Report

```json
{
 "id": "5943788913",
 "mid": "5520611177",
 "status": "REPORT",
 "email": "example@turbo-smtp.com",
 "subject": "Test Email",
 "timestamp": 1576709777
}
```

---

## Correlating Events with Your System

Two values let you join webhook events back to your own records:

- **`mid`** — every event carries the message ID returned by `/mail/send` at send time.
- **`reference_id`** — the OpenAPI specification defines the `reference_id` send field as *"custom argument included within an email to be added to the Event Webhook response"*. Set it at send time to attach your own correlation key (an order ID, a user ID) to the message's events.

```json
{
  "from": "notifications@yourdomain.com",
  "to": "user@example.com",
  "subject": "Your order has shipped",
  "content": "Order #1234 is on its way.",
  "reference_id": "order-1234"
}
```

---

## Next Steps

- [Send messages with a `reference_id`](transactional.md)
- [Query delivery history with Analytics](analytics.md)
- [Handle bounces with Suppressions](suppressions.md)
