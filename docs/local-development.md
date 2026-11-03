# Local development / Desenvolvimento local

## Start / Iniciar

Use Node 24 and the installed dependencies. Keep the root `.env` ignored by Git;
copy the names from `.env.example` and supply credentials only in your local editor.
The development database is PostgreSQL 17, `127.0.0.1:5432/fintrack`, role `fintrack`.
Do not reset or recreate it. The four migrations are already applied on this installation.

Use Node 24. Configure o `.env` da raiz no editor local, sem enviar senhas ao chat.
O banco principal já está migrado; não execute reset nem recrie o banco.

```powershell
Set-Location C:\Projetos\fintrack-pro
npm.cmd run build
npm.cmd run db:status
npm.cmd run doctor
npm.cmd run api
```

In another terminal / Em outro terminal:

```powershell
npm.cmd run web
# Explicit alternate port / Porta alternativa explícita:
npm.cmd run web -- --port 8083
```

`npm.cmd run dev` remains the combined launcher: it checks the main database,
builds, waits for readiness and starts Expo on 8081. It preserves an occupied API
port and refuses an occupied 8081. Confirm an existing API was restarted after
code changes: health 200 alone does not identify the compiled version.
Use separate commands and an alternate port when preserving existing services.

O comando combinado mantém 8081 fixa e preserva processos existentes. Para portas
alternativas, use os comandos separados. Uma API antiga pode responder saúde 200;
confirme o preflight e reinicie apenas o processo cuja responsabilidade conhece.

```powershell
Invoke-RestMethod http://127.0.0.1:3000/v1/health/ready
# Expected / Esperado: service=fintrack-api, status=ok, scope=database
netstat -ano -p tcp | Select-String ':3000\s|:8081\s|:8082\s|:8083\s'
Get-Process -Id <PID_OBSERVADO> | Select-Object Id, ProcessName, Path
```

Never stop an unknown process. To use another API port, set `$env:PORT='3107'`
before `npm.cmd run api`, and set the corresponding public URL before starting Expo.
Não encerre processos desconhecidos; configure portas alternativas.

## API address and environment / Endereço e ambiente

`EXPO_PUBLIC_API_URL` includes `/v1`. The root and mobile workspace commands use
`scripts/expo.mjs`, which forwards only this public value from the root `.env`.
A nonempty shell value takes precedence. Expo's app-level environment files retain
their normal behavior when no root/shell value is supplied. Never put secrets in
an `EXPO_PUBLIC_` variable. Reload the application after changing the value.

A URL é centralizada em `src/api/url.ts`. O launcher carrega a variável pública
do `.env` do monorepo; o shell tem prioridade. Senhas e URLs do PostgreSQL não
são encaminhadas do arquivo da raiz para o processo Expo.

```powershell
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:3107/v1'
npm.cmd run web -- --port 8083
```

| Environment / Ambiente       | Development behavior / Comportamento                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web loopback                 | Uses the page's loopback hostname so `localhost` and `127.0.0.1` do not split SameSite cookies; API port comes from the configured URL, default 3000 |
| Android emulator             | Uses `10.0.2.2`, unless Expo supplies a reachable LAN computer address or a remote API is configured                                                 |
| iOS simulator                | Defaults to `127.0.0.1`; an Expo LAN host can supply the computer address                                                                            |
| Expo Go on physical device   | Uses Expo's private IPv4 LAN host when available; otherwise explicitly configure a reachable API URL                                                 |
| Expo tunnel / custom network | Configure an explicit reachable API URL; the Expo tunnel does not tunnel the separate Nest API                                                       |
| Production bundle            | Requires an explicit HTTPS API URL; development loopback fallbacks are disabled                                                                      |

For a physical phone, bind the API to a reachable interface with `HOST=0.0.0.0`,
use the computer LAN address and verify local firewall access. `localhost` on the
phone means the phone. A remote browser on a LAN URL needs its exact origin in
`CORS_ORIGINS`. Native Expo Go requests do not require a browser Origin header.
Physical-device execution remains a separate verification from browser viewports.

Em celular físico, publique a API na interface de rede local e use o IP do
computador. `localhost` no aparelho não identifica o computador. O túnel Expo
não publica automaticamente a API NestJS.

## CORS and sessions / CORS e sessão

`apps/api/src/config/cors.ts` is the shared origin policy for Nest CORS and
authentication's Origin/CSRF validation. Development (unset, `development` or
`test` NODE_ENV) trusts exact `localhost`, `127.0.0.1` and `[::1]` hosts with
dynamic ports. Names such as `localhost.evil.test`, malformed origins and paths
are rejected. LAN addresses require explicit configuration.

Production and other named environments trust only the comma-separated exact
`CORS_ORIGINS` list. No wildcard, credentials in a URL, path, query or fragment
is accepted. An empty production list authorizes no browser origin.

```dotenv
NODE_ENV=production
CORS_ORIGINS=https://app.example.com,https://admin.example.com
EXPO_PUBLIC_API_URL=https://api.example.com/v1
```

The policy preserves `credentials: true`, responds to authorized preflights with
204 and reflects only the validated origin. Allowed headers include `Content-Type`,
`Authorization`, `Accept` and `Idempotency-Key`; methods include GET/POST/PATCH and
OPTIONS. Untrusted preflights receive no allow-origin header; auth POSTs reject
untrusted origins with 403. No-origin native clients still require authentication.

Em desenvolvimento, qualquer porta dos hosts de loopback é autorizada. Em produção,
somente a lista explícita é aceita. A proteção das rotas de autenticação usa a mesma
política. CORS não substitui a autorização por usuário.

Web access grants stay in memory; reload restores via the host-scoped HttpOnly,
`SameSite=Strict` refresh cookie. Production adds `Secure`. Deploy web and API on
HTTPS within the same site for this cookie policy; authorizing an unrelated site
with CORS alone does not make Strict cookies cross-site. Native grants use
SecureStore. Requests include credentials and renew a rejected access grant once,
preserving the operation's idempotency key.

O navegador guarda o refresh apenas no cookie HttpOnly. Recarregar restaura a sessão;
logout revoga no servidor e limpa o cookie. O deploy deve respeitar SameSite.

```powershell
curl.exe -i -X OPTIONS http://127.0.0.1:3000/v1/auth/register -H "Origin: http://localhost:8083" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,authorization,idempotency-key"
```

## Authentication and finance / Autenticação e finanças

Open `/login`, enter a valid email and a 15–128 character password, and repeat the
password. Registration creates a real hashed-password user, then signs in and
opens the empty account form. Create an account, then categories and posted
income/expenses. The dashboard reads PostgreSQL data and updates after operations.
Duplicate email, incorrect credentials, validation, unauthorized origin, throttling,
server unavailability and connection failure have separate feedback.

Abra `/login`, cadastre uma conta sintética e confirme a senha. Cadastre a primeira
conta financeira, receitas e despesas. Confira o saldo, recarregue, saia e entre
novamente. O fluxo autenticado não insere demonstrações.

Prisma's pg connections are pinned to UTC. This avoids the installed adapter's
offset-less timestamp serialization and read normalization shifting session
instants under a non-UTC server timezone. The server timezone is unchanged.
Historical timestamps are not automatically rewritten; sessions created before
this correction may require signing in again. Any historical data correction needs
a separate review rather than a blanket update.

As conexões Prisma usam UTC para preservar os instantes reais. Não houve atualização
em massa de registros antigos nem alteração de fuso do servidor.

## Tests and blockers / Testes e bloqueios

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run doctor
npm.cmd run db:status
npm.cmd run test:integration
# A production UI fixture URL; browser tests intercept all API requests.
$env:EXPO_PUBLIC_API_URL='https://api.example.test/v1'
npm.cmd run bundle
Remove-Item Env:EXPO_PUBLIC_API_URL
npm.cmd run test:e2e
```

UI/demo E2E runs offline API fixtures and never registers personal users. Real
browser persistence acceptance is separate. To smoke-test the migrated main local
database and **retain clearly named synthetic records**, run:

```powershell
node scripts/validate-local-auth.mjs --api http://127.0.0.1:3000/v1 --web http://localhost:8081 --keep-synthetic-data
```

This command verifies 14 checkpoints including direct SQL persistence, exact
session timestamps, cookies, refresh after expiring only its synthetic session,
logout, financial balances and two-user isolation. It never migrates, resets or
deletes records. It retains `communication-*@example.test` and
`communication-peer-*@example.test`. It refuses non-loopback services, production
mode and databases other than local `fintrack`.

O smoke real grava somente registros sintéticos identificados e os mantém. A suíte
SQL destrutiva usa exclusivamente `TEST_DATABASE_URL` terminando em `_test`, sem
fallback para o banco principal.

The configured PostgreSQL 18 service on 5433 currently rejects application login
with `28P01` (Prisma `P1000`). Role/database existence and privileges cannot be
established using a rejected credential. Use the existing **read-only** interactive
audit, `node scripts/setup-local-postgres.mjs --test --audit`, with the current admin
password entered locally. No administrator reset or HBA change is required here.
See [credential procedure](postgresql-local-credentials.md).

`npm.cmd run test:e2e:isolated -- --version 18` can create a separate ephemeral
cluster on 55433 using installed binaries; the default remains version 17 on 55432. This environment currently blocks `pg_ctl` restricted-token creation
(`87`, followed by `3`), so isolated SQL/browser acceptance remains pending.
Installed services and `.env` are unchanged. No restricted-token workaround is used.

Sources: [NestJS CORS](https://docs.nestjs.com/security/cors),
[Expo environment variables](https://docs.expo.dev/guides/environment-variables/),
[Prisma pg timestamp issue](https://github.com/prisma/orm/issues/28629).
