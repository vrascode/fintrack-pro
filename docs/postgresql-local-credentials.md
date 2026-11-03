# Local PostgreSQL credentials / Credenciais PostgreSQL locais

**2026-11-02 update:** the main `fintrack` role/database on 5432 now authenticates
and passes real browser persistence acceptance. Only `fintrack_test` on 5433 still
rejects credentials. The earlier observations below are historical; do not repeat
main-database provisioning or administrative recovery. See
[current validation](validation-2026-11-02.md). / O banco principal já funciona;
a investigação administrativa pendente é apenas do destino de testes.

Use existing Windows services. Do not reset administrative passwords, weaken HBA,
delete databases, or start Docker on occupied ports.

Use os serviços Windows existentes. Não redefina senhas administrativas, não
enfraqueça o HBA e não apague dados. Não inicie Docker nas portas desses serviços.

## Confirmed targets / Destinos confirmados

| Variable          | Host      | Port | Database      | Application role |
| ----------------- | --------- | ---- | ------------- | ---------------- |
| DATABASE_URL      | 127.0.0.1 | 5432 | fintrack      | fintrack         |
| TEST_DATABASE_URL | 127.0.0.1 | 5433 | fintrack_test | fintrack_test    |

Both passwords are populated in ignored root `.env`; no process override was
found. Both connections return 28P01. This does not prove role existence or
distinguish an incorrect password from a missing/disabled/expired role.
Administrative access is needed to verify roles, ownership and privileges.
Services 17 and 18 are running; data-directory configuration access was denied.
Their mapping to SQL ports remains unverified by an authenticated connection.

As senhas estão preenchidas, mas foram rejeitadas. Ainda não foi possível
confirmar a existência das roles nem suas permissões.

`POSTGRES_PASSWORD` and `POSTGRES_TEST_PASSWORD` configure Docker in
`infra/compose.yaml`. They do not reconfigure Windows services and are not evidence
of the current Windows `postgres` password. Do not try them as admin credentials.

## Application passwords known / Senhas da aplicação conhecidas

Open `C:\Projetos\fintrack-pro\.env` in your local editor. Change only the password
component of each URL, preserving role, database, host and port. Templates only:

```dotenv
DATABASE_URL=postgresql://fintrack:<URL_ENCODED_APPLICATION_PASSWORD>@127.0.0.1:5432/fintrack
TEST_DATABASE_URL=postgresql://fintrack_test:<URL_ENCODED_TEST_PASSWORD>@127.0.0.1:5433/fintrack_test
```

URL-encode reserved password characters (`@` → `%40`, `#` → `%23`, `%` → `%25`),
not the whole URL. Use local tools only. Never send passwords, `.env` contents or
screenshots in chat, and never put passwords into shell command arguments.

Edite as senhas no editor local. Não cole os placeholders como senhas reais.
Mantenha `.env` ignorado pelo Git. Depois execute `npm.cmd run doctor`.

## Administrator password known / Senha administrativa conhecida

Run these in your own interactive terminal. Each prompts for the **existing**
`postgres` password with hidden input, without saving it or passing it as an
argument. The instances can have different administrative passwords.

```powershell
Set-Location C:\Projetos\fintrack-pro
node scripts/setup-local-postgres.mjs --development --audit
node scripts/setup-local-postgres.mjs --test --audit
```

Audit uses only catalog SELECTs: role existence, LOGIN/elevated flags, expiry,
database existence/owner and CONNECT/CREATE/TEMP privileges. It never reads
password hashes or changes resources. Schema/table permissions, actual application
login and migrations still require separate validation.

A auditoria é somente leitura. Digite a senha atual de `postgres` no seu terminal,
sem enviá-la ao chat. Para criar apenas roles/bancos dedicados ausentes:

```powershell
node scripts/setup-local-postgres.mjs --development
node scripts/setup-local-postgres.mjs --test
```

Default provisioning preserves existing passwords. If you deliberately choose
to align a dedicated application's password with its ignored `.env`, add
`--reconcile-password` to that target's command after reviewing the audit.
The helper refuses elevated/shared roles and another database owner. It never
changes `postgres` or existing data.

Para uma role dedicada existente, `--reconcile-password` troca **somente** a senha
da aplicação para a do `.env`. Use apenas se essa for sua escolha após auditar.
Não é uma redefinição administrativa. Não contorne recusas de isolamento/permissão.

## No password known / Nenhuma senha conhecida

Ask the installer/administrator to enter the current password locally or
provision the dedicated resources. Editing `.env` alone does not change server
credentials. No password reset, guessing, or HBA bypass is part of this procedure.

Peça ao responsável pela instalação que digite a senha atual localmente ou
provisione os recursos. Sem credencial válida, o fluxo real permanece bloqueado.

## After authentication succeeds / Após autenticar

```powershell
npm.cmd run db:migrate
npm.cmd run db:status
npm.cmd run doctor
npm.cmd run test:e2e:real
```

The real suite migrates/tests only the explicit `_test` database, then verifies
browser registration, session renewal, account/history and financial persistence.
It never falls back to development. Restart an already-running API after `.env`
changes, without starting a duplicate process. Personal acceptance requires
readiness 200, registration/login, account and income/expense creation, reload,
logout/login and retained balances on the development database as well.

A suíte `_test` não substitui o aceite do banco pessoal. Reinicie a API existente
após editar `.env`; confirme prontidão 200 antes de validar seus dados pessoais.
