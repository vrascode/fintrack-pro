# FinTrack Pro

**A personal finance application built with Expo, React Native, TypeScript and NestJS.**

[Português (Brasil)](README.pt-BR.md) · [Roadmap](ROADMAP.md) · [Validation log](PORTFOLIO_PROGRESS.md)

FinTrack Pro is being developed for mobile devices with shared contracts, exact
money calculations and explicit security boundaries. The current app provides
working navigation and preferences. Phase 2 has started with an identity model
and tested security primitives; database-backed login and financial operations
are not available yet.

## What works today

| Area                 | Implemented behavior                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| App                  | Overview, activity, accounts, cards and preferences tabs; responsive layouts and honest empty states                                           |
| Preferences          | Light/dark/system theme, privacy settings, persistence, corruption recovery and storage-error handling                                         |
| Domain               | Exact integer money, validated calendar dates and shared Zod contracts                                                                         |
| API                  | NestJS `GET /v1/health`, loopback by default, process liveness only                                                                            |
| Identity core        | Password hashing/verification, opaque tokens, expiry, rotation/replay and device-revocation transitions, tested independently of a database    |
| Database preparation | Prisma 7 dependencies, identity/ledger schemas and migrations, generated client and real-database suites; PostgreSQL execution remains blocked |

The identity core is not connected to HTTP or persistence. No mock database is
used to claim integration. See [database setup and remaining work](DATABASE.md).

## Interface and localization

The mobile app and web export share a responsive UI foundation with light, dark,
and system themes. Non-sensitive theme, language, privacy, and desktop sidebar
preferences are stored locally. The interface supports Brazilian Portuguese and
English, with locale-aware date and exact-cent currency formatters. The web
layout adds a collapsible desktop sidebar; mobile keeps bottom-tab navigation.
Financial areas intentionally remain empty until real account and transaction
services are available. See [architecture](ARCHITECTURE.md) for UI boundaries.

## Quick start

Requirements: Node.js 24 LTS (`>=24.13.0 <25`), npm and registry access for the first
install. Local checks used Node 24.20.0 and npm 11.19.0. Use `npm.cmd` / `npx.cmd`
in Windows PowerShell if script policy blocks `npm.ps1`.

```sh
npm ci
npm run build
npm run api
# In a second terminal
npm run web
# Or start Expo for a compatible device/simulator
npm run mobile
```

Open the URL printed by Expo. In **Ajustes**, choose **Escuro**, enable
**Ocultar valores por padrão**, then reload: both settings persist on that device.
Storage failures are reported without claiming the change was saved.

`GET http://127.0.0.1:3000/v1/health` returns:

```json
{ "service": "fintrack-api", "status": "ok", "scope": "process" }
```

Set `HOST` and `PORT` in the shell; the API does not automatically load `.env`.
Database scripts load the root `.env` separately. [.env.example](.env.example)
contains configuration names without credentials.

## Development and validation

```sh
npm run check          # Lint, build/typecheck, local tests and formatting
npm run bundle         # Android, iOS and web exports
npm run test:e2e       # Headless Edge: desktop and mobile browser viewports
```

GitHub Actions runs these checks, native web/mobile exports and both browser
viewports on pushes and pull requests to `main`. See the [CI workflow](.github/workflows/ci.yml).

E2E requires an up-to-date bundle and installed Microsoft Edge, starts its own
server on port 4173 and closes it after the run. Manual preview:
`node scripts/serve.mjs`. Native exports and browser viewports do not establish
native device, biometric or release-signing compatibility.

Follow [DATABASE.md](DATABASE.md) to configure separate development/test databases and run:

```sh
npm run db:validate
npm run db:generate
npm run db:migrate
npm run test:integration
```

Integration is a separate required gate: it fails when prerequisites are missing,
never falls back to the development database and does not count as a passing unit
test. Exact results and blockers are in [the progress log](PORTFOLIO_PROGRESS.md).

## Repository

```text
apps/mobile/       Expo Router UI, design system and local preferences
apps/api/          NestJS health API, identity core, Prisma schema/migration
packages/shared/   Runtime contracts, money and calendar primitives
packages/config/   Strict TypeScript and lint defaults
infra/             Local PostgreSQL services
tests/             Domain, security, persistence and HTTP tests
tests/integration/ PostgreSQL/Prisma integration suite
e2e/               Browser interaction tests
```

Read the [architecture](ARCHITECTURE.md), [security review](SECURITY.md),
[development guide](docs/en-US/DEVELOPMENT.md), [decisions](docs/adr/0001-foundation.md)
and [research](docs/RESEARCH.md).

## Project status

Phase 2 is **in progress, not accepted**. Prisma schema validation and client
generation pass locally. Identity and ledger migrations still need a real PostgreSQL
run; transactional repositories, authenticated HTTP flows, financial CRUD, account
balance queries and mobile workflows are not implemented. Email lifecycle, SecureStore,
biometrics and later billing/reporting features also remain. This is not a
production-ready financial service.

Existing source changes were committed by feature and published to `origin/main`
on 2026-10-27 after the Git permission and connectivity blockers were resolved
through approved operations. See the [publication record](PORTFOLIO_PROGRESS.md).
The latest `npm audit fix` removed the `node-forge` advisory but reported eight
remaining Expo-tooling findings (three high, five low); the remaining automatic
fix requires a breaking Expo downgrade and was not applied. Real database
validation also remains pending. Secrets, local data, caches and generated
outputs stay out of Git.
