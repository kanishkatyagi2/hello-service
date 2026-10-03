# Phase 5 — CI Pipeline (GitHub Actions)

## Goal

Automate lint, test, dependency/image security scanning, and image build for `hello-service` on every push/PR to `main`, replacing fully manual local verification with a reproducible pipeline anyone (not just a specific laptop setup) can trust.

## Real-world problem being solved

Manual local verification doesn't scale or generalize — it depends on one person's machine state and discipline. CI makes "does this change actually work" a reproducible, automatic check running in a clean environment on every change, and is the first gate in any real delivery pipeline before code reaches a cluster.

## Architecture

```
hello-service repo
└── .github/workflows/ci.yml
      Trigger: push / pull_request → main
      Job: ci (ubuntu-latest runner)
        ├─ Checkout
        ├─ Setup Node.js (with npm cache)
        ├─ npm ci
        ├─ Lint (eslint)
        ├─ Test (jest + supertest)
        ├─ Audit dependencies (npm audit --audit-level=high)
        ├─ Build Docker image
        ├─ Scan image (Trivy, HIGH/CRITICAL, report-only)
        ├─ Save image as tarball
        └─ Upload image as workflow artifact
```

Lives in `hello-service` (not the platform repo), per ADR-002 — CI belongs with the app it builds.

## Why each design decision

- **`npm ci`, not `npm install`** — deterministic installs from a committed lockfile; fails if the lockfile is out of sync, which is exactly the guarantee CI needs.
- **Lint → test → audit → build, in that order** — fail fast on the cheapest checks before spending time on build/scan.
- **Trivy for image scanning, `exit-code: '0'`** — scans for CVEs in the built image's OS/dependency layers; deliberately non-blocking for now (report, don't gate) since base-image CVEs are extremely common and a hard gate on day one would be noisy before a real triage policy exists.
- **`npm audit --audit-level=high` blocking** — unlike Trivy, this *does* fail the build on high/critical findings in app dependencies — a reasonable gate from day one since app-level deps are more directly in your control.
- **No registry push** — still produces/uploads the image as a downloadable workflow artifact only; Phase 6 (GHCR) replaces this with an automatic push.
- **Actions pinned by commit SHA, not mutable tag** — see Security note below.

## Local setup completed before CI

- Generated `package-lock.json` (`npm install`) — required for `npm ci`
- Added ESLint (`eslint.config.mjs`, Node globals for app code, Jest globals scoped to `**/*.test.js`)
- Refactored `index.js` → split into `app.js` (exportable Express app, no `listen()`) + `index.js` (starts the server) — required to make the app testable with `supertest` without binding a real port
- Added `app.test.js` (Jest + supertest) — covers `GET /` and `GET /healthz`
- Added `lint`/`test` scripts to `package.json`
- Fixed `.gitignore` — `"*.tar"` had literal quote characters in the pattern (gitignore doesn't use quoted strings), so it wasn't actually matching `*.tar` files; corrected to `*.tar`

## Security note — Trivy Action supply-chain incident

While pinning the Trivy Action version, discovered that `aquasecurity/trivy-action` suffered a real supply-chain compromise around March 19, 2026: a threat actor used compromised credentials to force-push malicious content onto nearly all existing version tags (`0.0.1`–`0.34.2`). The maintainers' confirmed-safe version is `0.35.0` onward.

Resolved and pinned by **immutable commit SHA** rather than a mutable version tag, verified directly against GitHub (not secondhand/scraped sources):

```bash
git ls-remote --tags https://github.com/aquasecurity/trivy-action v0.35.0
# 57a97c7e7821a5776cebc9bb87c984fa69cba8f1   refs/tags/v0.35.0
```

```yaml
uses: aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1 # v0.35.0
```

This is a real, current example of the exact attack class pinning-by-SHA defends against — a tag is a mutable pointer that can be silently redirected; a commit SHA cannot.

## Troubleshooting journey (real issues hit and resolved)

1. **Nonexistent Action version (`0.28.0`)** — initial Trivy Action pin referenced a version that was never a real release; GitHub failed to resolve it immediately (job failed in 2s, before any steps ran — nothing executed, nothing was ever fetched). Investigated properly (see Security note above) and re-pinned to the verified safe SHA.
2. **ESLint failing on `app.test.js`** — `describe`/`test`/`expect` (Jest globals, injected at test-runtime) flagged as `no-undef` because `eslint.config.mjs` only declared Node globals. This didn't surface earlier because lint was last verified clean before `app.test.js` existed. Fixed by adding a third ESLint config block scoping `globals.jest` to `**/*.test.js` only, leaving app code's Node-only globals untouched.

## Verification steps & expected output

```bash
npm run lint   # clean, no output
npm test       # Test Suites: 1 passed, Tests: 2 passed
npm audit      # 0 vulnerabilities
```

GitHub Actions run (triggered by push to `main`): all steps green —
Checkout → Setup Node.js → Install dependencies → Lint → Test → Audit dependencies → Build Docker image → Scan image with Trivy → Save image as tarball → Upload image artifact.

Workflow artifact `hello-service-image.zip` (~48.9MB) produced and downloadable from the run summary.

## How this maps to real industry practice

This is a standard, minimal CI pipeline shape — lint/test/scan/build gates before anything is trusted to move further down the pipeline. The "scan and report before scan and block" progression on Trivy mirrors how most real orgs actually roll out new security gates: visibility first, enforcement once there's a triage process. Pinning third-party Actions by commit SHA is current, real best practice directly motivated by a real 2026 incident, not a hypothetical.

## What was committed to git

```
.github/workflows/ci.yml
app.js
app.test.js
eslint.config.mjs
package.json (modified)
package-lock.json
index.js (modified)
.gitignore (modified — fixed *.tar pattern)
docs/phase-5-ci-pipeline.md
```

## Portfolio evidence collected

- Green GitHub Actions run (all steps)
- `npm run lint` / `npm test` / `npm audit` local output
- Documented, real Trivy Action supply-chain incident and SHA-pinning remediation
- Downloaded `hello-service-image.zip` workflow artifact
- `git ls-remote` verification of the Trivy Action commit SHA