#!/usr/bin/env node
/**
 * TurboSMTP SDK — Layer 1 generation pipeline (task 1.6).
 *
 * Pipeline:  bundle  →  filter-by-domain (+ prune)  →  generate per language
 *   1. bundle   : api-reference/turbo-smtp.yaml → build/turbo-smtp.bundled.yaml   (redocly bundle)
 *   2. filter   : keep only the target domain's tag(s), drop orphaned components  (redocly filter-in
 *                 + --remove-unused-components) → build/turbo-smtp.<domain>.yaml
 *   3. generate : openapi-generator-cli generate -c config/<lang>.yaml            (version pinned in
 *                 ../openapitools.json). Fed the 3.1 spec directly — no down-convert (see 1.3/1.4).
 *
 * Both tools are pinned to an exact version. The bundler is not a passive step: its output
 * is the generator's input, so a bundler minor changes the committed Layer 1 without any
 * spec change. ADR-0004 rules 1-2 apply — never a range permitting minors, and the floor is
 * the version actually validated.
 *
 * Cross-platform by design: pure Node + `npx`, so it runs identically on Windows (local) and Linux
 * (CI). Requires Node 18+ and a JVM (the generator is Java; the npm wrapper downloads the jar).
 *
 * Usage (run from anywhere):
 *   node sdks/scripts/generate.mjs [--domain=mail] [--lang=node,python,...] [--out-root=<dir>]
 *                                  [--tags=tagA,tagB] [--skip-bundle]
 *
 * Examples:
 *   node sdks/scripts/generate.mjs                        # P0: mail domain, all 5 languages, canonical layout
 *   node sdks/scripts/generate.mjs --lang=node            # just the Node reference (task 2.1)
 *   node sdks/scripts/generate.mjs --out-root=build/generated   # safe dry run into build/ (git-ignored)
 *
 * Notes:
 *   - Layer 1 lands in an internal namespace per language (see config/README.md); the hand-written
 *     Layer 2 facade owns the public entrypoint and packaging. Skipping generated project files
 *     (package.json / .csproj / composer.json) is handled per-package at scaffolding time (2.1+).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SDK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SDK_ROOT, '..');
const BUILD_DIR = join(SDK_ROOT, 'build');

/** Exact, not a range: see the pipeline note above. Verified against this repository's spec. */
const REDOCLY = '@redocly/cli@2.47.0';

const SPEC_IN = join(REPO_ROOT, 'api-reference', 'turbo-smtp.yaml');
const BUNDLED = join(BUILD_DIR, 'turbo-smtp.bundled.yaml');

// Domain → OpenAPI tag(s). Verified: mail, validation. Others are placeholders for later tiers —
// confirm the actual tag strings against the spec when those domains are implemented, or pass --tags.
const DOMAIN_TAGS = {
  mail: ['mail'],
  validation: ['email-validator'],
  analytics: ['analytics'],
  suppressions: ['suppressions'],
  subaccounts: ['subaccounts'],
  account: ['consumerkey', 'authentication'],
};

// Language → generator config + canonical Layer 1 output dir (relative to SDK_ROOT).
const LANGS = {
  node: { config: 'config/node.yaml', out: 'packages/node/src/generated' },
  python: { config: 'config/python.yaml', out: 'packages/python' },
  csharp: { config: 'config/csharp.yaml', out: 'packages/csharp' },
  go: { config: 'config/go.yaml', out: 'packages/go/generated' },
  php: { config: 'config/php.yaml', out: 'packages/php' },
};

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) fail(`Unrecognized argument: ${a}`);
    args[m[1]] = m[2] ?? true;
  }
  return args;
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

/** Run a command string via the shell (cross-platform npx resolution), cwd = sdks/ so the
 *  generator wrapper finds openapitools.json. Aborts the pipeline on non-zero exit. */
function run(label, cmd) {
  console.log(`\n▶ ${label}\n  ${cmd}`);
  const r = spawnSync(cmd, { cwd: SDK_ROOT, shell: true, stdio: 'inherit' });
  if (r.status !== 0) fail(`${label} failed (exit ${r.status ?? r.signal}).`);
}

function main() {
  const args = parseArgs(process.argv);
  const domain = args.domain || 'mail';
  const tags = args.tags ? String(args.tags).split(',') : DOMAIN_TAGS[domain];
  if (!tags)
    fail(`Unknown domain "${domain}". Known: ${Object.keys(DOMAIN_TAGS).join(', ')} (or pass --tags).`);

  const langs = args.lang ? String(args.lang).split(',') : Object.keys(LANGS);
  for (const l of langs)
    if (!LANGS[l]) fail(`Unknown language "${l}". Known: ${Object.keys(LANGS).join(', ')}.`);

  mkdirSync(BUILD_DIR, { recursive: true });

  // 1. Bundle (skippable if the bundle already exists and is fresh).
  if (!args['skip-bundle']) {
    run('bundle spec', `npx --yes ${REDOCLY} bundle "${SPEC_IN}" -o "${BUNDLED}"`);
  }

  // 2. Filter to the domain's tag(s) and prune orphaned components.
  const filterCfg = join(BUILD_DIR, `_filter-${domain}.yaml`);
  const filtered = join(BUILD_DIR, `turbo-smtp.${domain}.yaml`);
  writeFileSync(
    filterCfg,
    `decorators:\n  filter-in:\n    property: tags\n    matchStrategy: any\n    value:\n${tags.map((t) => `      - ${t}`).join('\n')}\n`,
  );
  run(
    `filter → ${domain} [${tags.join(', ')}]`,
    `npx --yes ${REDOCLY} bundle "${BUNDLED}" --config "${filterCfg}" --remove-unused-components -o "${filtered}"`,
  );

  // 3. Generate each language from the filtered, domain-scoped spec.
  for (const l of langs) {
    const outDir = args['out-root']
      ? join(resolve(String(args['out-root'])), l)
      : join(SDK_ROOT, LANGS[l].out);
    run(
      `generate ${l} (${domain})`,
      `npx --yes @openapitools/openapi-generator-cli generate ` +
        `-i "${filtered}" -c "${join(SDK_ROOT, LANGS[l].config)}" -o "${outDir}"`,
    );
  }

  console.log(`\n✔ Done — domain "${domain}", languages: ${langs.join(', ')}.`);
}

main();
