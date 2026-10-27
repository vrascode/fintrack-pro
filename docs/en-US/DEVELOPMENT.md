# Development guide

Use the [root setup](../../README.md). All commands run at the project root.
This directory is an independent Git repository on `main`, with remote
`https://github.com/vrascode/fintrack-pro.git`. Work only inside this project;
review `git diff --cached --name-only` before each scoped commit. The current
user instruction authorizes validated commits and push to `origin/main`, without
history rewriting or force push. Suspend publication on security, credential or
critical validation blockers; record the exact failure in the progress log.

- `packages/shared`: Zod contracts, signed 64-bit cents, calendar arithmetic.
- `packages/config`: strict compiler defaults and shared lint rules.
- `apps/api`: ESM NestJS app; build with TypeScript for decorator metadata.
- `apps/mobile`: Expo Router, reusable UI and an injectable Zustand preference store.
- `tests`: Node test runner, real loopback HTTP and temporary disk persistence.
- `e2e`: Playwright interaction tests against the exported app.

Phase 2 adds strict identity contracts and server-only password/token/session
primitives under `apps/api/src/identity`. These functions do not persist users or
expose login routes. Use the PostgreSQL/Prisma setup in [DATABASE.md](../../DATABASE.md)
for `db:validate`, `db:generate`, `db:migrate` and `test:integration`. The database
suite is separate from `check` and must pass before claiming persistence.

`typecheck` builds shared/API declarations before checking mobile and test types,
so it no longer depends on an earlier build. Generated Prisma code is ignored by
Git, formatting and lint; schema/client validation is a separate required step.

Money API examples: `parseDecimal('12.34') === 1234n`, `splitMoney(100n, 3)`
returns `[34n, 33n, 33n]`. Decimal input uses a dot and at most two fraction digits;
it rejects excess precision. Ratio rounding is half away from zero. JSON uses
canonical integer strings, never numeric floats. `addMonths('2024-01-31', 1)`
returns `2024-02-29`; calculate recurring occurrences from the original anchor to
avoid cumulative clamping drift.

Preference writes are serialized, merged against the latest committed snapshot
and displayed only after successful persistence. Failed hydration blocks edits.
Unknown schema versions are preserved and shown as a recoverable error; reset is
an explicit user action. Current preferences do not sync between devices.

For offline builds in PowerShell, set `EXPO_OFFLINE=1`, `EXPO_NO_TELEMETRY=1` and
`CI=1` in the environment. Set `TEMP` and `TMP` to the project's `.cache` directory
to keep Metro temporary outputs local. Expo compatibility checks in offline mode
use installed SDK metadata and do not verify current server metadata.

Run `npm run check`, `npm run bundle`, then `npm run test:e2e` after changes.
Do not mark native runtime behavior verified from a browser test or bundle export.
Known security and infrastructure limits are in [security](../../SECURITY.md) and
[database](../../DATABASE.md). Actual results belong in [progress](../../PORTFOLIO_PROGRESS.md).
