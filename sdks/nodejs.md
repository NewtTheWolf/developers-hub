# Node.js / TypeScript SDK

The official TurboSMTP SDK for Node.js and TypeScript applications.

**Status:** Planned — coming soon

---

## Planned Installation

```bash
npm install @turbosmtp/sdk
# or
yarn add @turbosmtp/sdk
```

**Requirements:** Node.js 18+

---

## Planned Usage

```typescript
import { TurboClient } from '@turbosmtp/sdk';

// Instantiate via environment variable
const turbo = new TurboClient(process.env.TURBO_API_KEY);

// Send transactional email
const delivery = await turbo.mail.send({
  from: 'notifications@app.com',
  to: 'user@example.com',
  subject: 'Welcome Aboard',
  html: '<h1>Success</h1>'
});

// Validate an email address
const validation = await turbo.validation.verify('suspect@domain.com');
if (validation.status === 'valid') {
  // Proceed
}
```

---

## Design Notes

The Node.js SDK is being designed around the following principles:

- **Minimal instantiation** — a single API key is all that's needed to get started
- **Unified client** — one package for mail, validation, and analytics
- **Fluent interface** — method chaining for readable, composable code
- **Full TypeScript support** — complete type definitions generated from the OpenAPI 3.1 spec

The SDK will be generated from the [OpenAPI 3.1 specification](../api-reference/README.md) using `openapi-generator-cli v7.18.0` with custom Mustache templates.

---

## Stay Updated

Watch this repository or open a [Feature Request](../.github/ISSUE_TEMPLATE/feature_request.md) to be notified when this SDK is available.
