# SDK generator configs

Per-language [OpenAPI Generator](https://openapi-generator.tech) config files for **Layer 1**
(the generated transport + models core). Consumed by the generation script (task 1.6) via
`-c sdks/config/<lang>.yaml`. Generator version is pinned in [`../openapitools.json`](../openapitools.json)
(currently 7.24.0). See [`../plan.md`](../plan.md) and [`../client-contract.md`](../client-contract.md).

## Generator flavor per language

| Language | Generator | Transport | Notes |
|---|---|---|---|
| Node/TS | `typescript-fetch` | native `fetch` | no axios dep; Node 18+ and browsers |
| Python | `python` | urllib3 | pydantic v2 models; async facade is a later addition (contract §3.1) |
| C# | `csharp` | `HttpClient` | `net8.0`; nullable reference types on |
| Go | `go` | net/http | nullable → `Nullable<T>` wrappers |
| PHP | `php` | Guzzle | |

All five were validated against the bundled 3.1 spec in the **1.3 spike** — no down-convert shim and
no Kiota fallback needed.

## Layer 1 / Layer 2 layout

These configs generate **Layer 1 only**, into an **internal namespace** so the hand-written Layer 2
facade can own the public entrypoint (`TurboSMTPClient`) within the same published package:

| Language | Layer 1 (generated) namespace | Public facade surface |
|---|---|---|
| Node/TS | emitted to `packages/node/src/generated/` | `@turbosmtp/sdk` |
| Python | `turbosmtp._generated` | `turbosmtp` |
| C# | `TurboSMTP.Generated` | `TurboSMTP` |
| Go | package `generated` | package `turbosmtp` (owns `go.mod`) |
| PHP | `TurboSMTP\Generated` | `TurboSMTP` |

Package identity matches the registry names fixed in the contract (`@turbosmtp/sdk`, `turbosmtp`,
`TurboSMTP`, `turbosmtp/turbosmtp-client`). Packaging/project files (package.json, pyproject, go.mod,
.csproj, composer.json) are owned by the facade, not the generated core — the script skips generated
project files (`generateSourceCodeOnly`/`withGoMod:false`/ignore rules) so regeneration never clobbers
the facade's packaging.

## What these configs deliberately omit

- **`inputSpec` / `outputDir`** — supplied per run by the 1.6 script, not baked here.
- **Domain filter** — kept out so each config is **domain-agnostic and reused across every tier**.
  Domain partitioning (P0 mail → P1 validation → …) is applied by the **script** per run. Approach:
  pre-filter the bundled spec to the target domain's tag(s) before generation (proven-clean models,
  since the spike showed full-spec generation resolves all `$ref`s). The exact filter mechanism
  (Redocly filter decorator vs the generator's `openapi-normalizer FILTER`) is chosen and validated
  for model-pruning in task 1.6.
- **`skipFormModel`** — left at the generator default (`true`) because **P0 Mail has no multipart**.
  This default drops multipart upload request models; **flip to `false` (or handle via operation
  params) when configuring P1 validation upload and P2 suppressions-import / subaccount-logo**
  (carried over from the 1.3 spike).

## Regenerating

Do not hand-edit generated Layer 1 code. Change the spec upstream in `turbo-smtp-openapi/`, re-sync
`api-reference/turbo-smtp.yaml`, re-bundle to `sdks/build/`, and re-run the generation script.
