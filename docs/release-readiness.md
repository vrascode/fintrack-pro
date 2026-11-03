# Release preparation / Preparação de publicação

No hosted API, Web deployment or store release was performed. / Nenhum deploy ou
envio às lojas foi realizado.

| Delivery      | Required configuration                                        | Current boundary                                          |
| ------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| GitHub source | Git write access and network access to origin/main            | Sandbox cannot stage or fetch                             |
| API           | Production PostgreSQL, HTTPS host and explicit Web origins    | Hosting and credentials not supplied                      |
| Web           | Real HTTPS API at `/v1` and static host with SPA fallback     | Release check rejects missing/local/placeholder endpoints |
| Android       | Expo project, signing credentials and device acceptance       | Identifier/assets exist; no signed release validated      |
| iOS           | Expo project, Apple signing credentials and device acceptance | Identifier/assets exist; no signed release validated      |

## API

Inject `DATABASE_URL` from the hosting platform's secret store. Set `NODE_ENV` to
`production`, configure `CORS_ORIGINS` with the exact HTTPS Web origin, and select
the appropriate `HOST`/`PORT` for that platform. Configure TLS at the public
ingress and database certificate validation as required by the database provider.
Never put database credentials in an `EXPO_PUBLIC_` variable.

Run `npm.cmd ci`, `npm.cmd run build` and `npm.cmd run db:status`. Back up the
production database before deploying reviewed migrations with `npm.cmd run
db:migrate`. Start with `npm.cmd run api`. Deployment acceptance requires the
isolated integration suite and the real authentication/financial browser flow.
Probe `/v1/health` for process liveness and `/v1/health/ready` for database readiness.
Validate persistence through an API restart in a dedicated staging database.
Keep request bodies and authorization headers out of hosting logs.

## Web

`release:check` performs static validation only; it does not verify ownership,
availability, certificates or deployed API behavior. Supply the real public API:

```powershell
$env:EXPO_PUBLIC_API_URL = Read-Host 'URL HTTPS real da API, terminando em /v1'
npm.cmd run release:check
if ($LASTEXITCODE -ne 0) { throw 'Configure a API de produção antes de continuar.' }
npm.cmd run release:web
```

Publish `apps/mobile/dist` to the chosen static host with an SPA fallback to
`index.html`. Verify direct route navigation, CORS and persistent preferences on
the actual HTTPS origin. Never deploy the UI-test export: its reserved `.invalid`
API endpoint is deliberately unusable outside intercepted tests.

## Android and iOS

Current identifiers are `com.fintrackpro.app` for both platforms. Confirm their
ownership before distribution. `apps/mobile/app.json` references the existing
icon, Android adaptive/monochrome icons, splash assets and SecureStore plugin.
`apps/mobile/eas.json` defines development, preview and production profiles.

Connect the intended Expo project and configure signing through the account's
secure credential workflow. Keep keys and account credentials outside Git.
Supply the real API configuration during native builds. Validate installation,
session restoration, logout, transaction changes, accessibility and network errors
on real devices before submitting signed artifacts. Exports prove compilation only.

## Local test database / Banco local de testes

Update the ignored root `.env` locally with the correct application-role password
in `TEST_DATABASE_URL` for `fintrack_test` on port 5433. Do not paste passwords into
chat. `npm.cmd run doctor` checks both targets without printing passwords. After
authentication works, `npm.cmd run test:integration` validates the isolated target,
deploys migrations without reset and runs SQL tests. Never substitute `DATABASE_URL`.
