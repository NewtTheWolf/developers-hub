# Contributing to TurboSMTP Developers Hub

Thank you for your interest in contributing. This repository follows a **Docs-as-Code** model — all documentation, SDK guides, and AI integration references are version-controlled here and reviewed via pull requests.

---

## Ways to Contribute

- Fix typos or improve clarity in existing documentation
- Report API behavior discrepancies (drift between spec and runtime)
- Add or improve SDK guides
- Submit community SDK wrappers for unsupported languages
- Improve CI/CD workflows

---

## Getting Started

1. Fork this repository
2. Create a branch: `git checkout -b fix/your-description`
3. Make your changes
4. Open a Pull Request against `main`

Please use the provided [PR template](.github/pull_request_template.md) and fill in all relevant sections.

---

## Documentation Standards

- All documentation is written in Markdown
- Follow the existing folder structure under `docs/`
- Code examples must be tested and functional
- API examples must reference the OpenAPI 3.1 specification in `api-reference/`

---

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) for:
- API behavior that does not match the documented specification (drift)
- Broken code examples
- SDK errors or unexpected behavior

---

## SDK Contributions

Community-maintained SDKs are welcome. To register a community SDK:
1. Open an Issue with the `sdk-proposal` label
2. Ensure your library is generated from or conforms to the OpenAPI 3.1 spec in `api-reference/`
3. Add an entry to `sdks/index.md` via Pull Request

---

## Code of Conduct

Be respectful and constructive. We are building a community-driven developer ecosystem and expect all contributors to engage professionally.
