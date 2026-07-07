# API Reference

The TurboSMTP API is defined using the **OpenAPI 3.1 specification**, which serves as the single source of truth for all SDKs, documentation, and interactive references.

This page is the narrative overview of the API surface. For the **interactive** reference, use the live Swagger UI below.

---

## Interactive Reference

**Live Swagger UI:** [https://turbosmtp.github.io/developers-hub/](https://turbosmtp.github.io/developers-hub/)

A live "Try It" playground for every endpoint, with no local setup required. It is published from the self-contained Swagger UI bundle in this folder (`index.html` + `turbo-smtp.yaml` + `Domains/`) and redeployed automatically on every change via the [deploy-swagger-ui workflow](../.github/workflows/deploy-swagger-ui.yml).

---

## Specification Source

The spec is authored as a **multi-file** OpenAPI 3.1 document:

```
api-reference/turbo-smtp.yaml   # entrypoint
api-reference/Domains/*.yaml    # per-domain path items and schemas
```

It is synced from the canonical source in the sibling repository `../turbo-smtp-openapi/turbo-api-2/` (see the "API Documentation Sync" section of the repo `CLAUDE.md`). Validity is checked on every change via the [validate-openapi workflow](../.github/workflows/validate-openapi.yml).

---

## Specification Details

| Property | Value |
|---|---|
| Specification Version | OpenAPI 3.1 |
| Generator Toolchain | `openapi-generator-cli v7.18.0` |
| Security Schemes | API Key (raw `Authorization` header) and Consumer Key/Secret header pair |

---

## API Surface

| Domain | Endpoints | Description |
|---|---|---|
| Authentication | `/authorize`, `/deauthorize`, `/change-password`, `/forgot-password` | API key lifecycle and password management |
| Mail | `/mail/send` | Send transactional email (dedicated host, consumer key auth) |
| Analytics | `/analytics`, `/analytics/{Id}`, `/analytics/csv` | Per-message delivery events |
| Suppressions | `/suppressions`, `/suppressions/import`, `/suppressions/csv`, … | Suppressed-address management |
| Email Validation | `/emailvalidation/validateEmail`, `/emailvalidation/lists/*`, … | Single and bulk address validation |
| Subaccounts | `/subaccounts/*` | Multi-tenant management (agency plans) |
| Alerts | `/tools/alerts` | Usage-threshold notifications |
| Consumer Keys | `/user/consumerKeys` | Permanent API credential management |
| Billing | `/billing/buy_emailvalidation_credits` | Validation credit purchase |
| Meta | `/meta/countries`, `/meta/state/{isoCode}` | Reference data |
| Webhooks | Dashboard configuration | Delivery and engagement event streams (not an API endpoint) |

---

## Conformance Policy

All TurboSMTP backend behavior must conform to this specification. If you discover a discrepancy between the spec and a live endpoint response (e.g., a type mismatch such as a stringified boolean instead of a JSON boolean), please open a [Bug Report](../.github/ISSUE_TEMPLATE/bug_report.md).

Conformance is validated automatically on every commit via the [validate-openapi workflow](../.github/workflows/validate-openapi.yml).
