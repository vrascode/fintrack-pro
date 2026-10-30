# Database / Banco de dados

## Current boundary / Limite atual

Phase 2 and ledger preparation are in source: PostgreSQL 17 Compose services, Prisma 7
dependencies, schema/client generation, versioned identity and ledger migrations,
and real-database integration suites. Prisma validates the schema and generates the
client locally. Native Windows PostgreSQL services are now running on 5432 and 5433,
but their project-role credentials still need local recovery/provisioning. A separate
PostgreSQL 17.11 cluster on 55432 passed all four migrations, nine SQL tests and both
desktop/mobile real browser scenarios. The API has process and database
readiness endpoints, a lazy Prisma service, registration/login, and bearer-session
authorization for logout. Credentials are hashed; login stores session and refresh
token digests transactionally. Authenticated `GET /v1/accounts` and `POST
/v1/accounts` and `GET /v1/categories` and `POST /v1/categories` list and create
owner-scoped records; `/v1/transactions` lists and creates posted entries with
per-user idempotency keys and account/category ownership checks. Future-dated entries
are rejected until a scheduled-entry model exists. Other financial workflows remain
unimplemented. Service unit tests use Prisma-shaped fakes; the separate SQL and
browser suites now also prove persistence against real PostgreSQL. Persisted refresh
rotation under a row lock was exercised by reload/API-restart/login acceptance.
Rate limiting and a complete concurrency/security audit remain pending.

Migration `202610300001_account_opening_balance` adds exact-cent opening balance,
reference date and planning inclusion to accounts without deleting or rewriting
ledger data. Existing rows default to zero cents, migration date and planning enabled.
Migration `202610300002_category_reserve_flag` adds an opt-in essential-expense
classification, defaulting existing categories to nonessential.

A preparação da fase 2 e do ledger está no código: serviços PostgreSQL 17,
dependências Prisma 7, validação do schema/geração do cliente, migrações versionadas
de identidade e ledger e suítes para banco real. O Prisma valida o schema e gera o
cliente localmente. PostgreSQL está instalado em duas instâncias locais, mas as
credenciais de aplicação ainda exigem recuperação. Quatro migrações, nove testes SQL
e dois cenários de navegador passaram em um cluster PostgreSQL 17 isolado na 55432.
Existem serviços Prisma para identidade, contas, categorias e lançamentos com
autorização por usuário. Testes locais com repositórios simulados não comprovam
persistência PostgreSQL.

`/v1/health` checks process liveness; `/v1/health/ready` checks database readiness.
AsyncStorage holds only non-sensitive preferences under `fintrack.preferences.v1`;
never passwords, tokens or financial records. Native authentication credentials use
Expo SecureStore. Web keeps access credentials in memory and restores sessions from
an HttpOnly SameSite refresh cookie; production cookies require HTTPS. No refresh
credential is returned in browser JSON. Real-database browser acceptance passed in
the isolated cluster; native-device and production deployment checks remain pending.

Configure `EXPO_PUBLIC_API_URL` for the API reachable by the target device. Android
emulator development defaults to `10.0.2.2`; physical devices require a reachable
development host. Production builds reject HTTP and loopback URLs. A configured HTTPS
production API is not deployed by this repository yet.

## Local setup / Configuração local

### Native Windows installation / Instalação Windows sem Docker

The local Windows services currently use PostgreSQL 17 on port 5432 and PostgreSQL
18 on port 5433. The application uses the separate `fintrack` and `fintrack_test`
databases configured in the ignored root `.env`. Never repurpose an existing database.
To provision missing roles/databases, explicitly select **one** environment:
`node scripts/setup-local-postgres.mjs --development` or
`node scripts/setup-local-postgres.mjs --test`. The command prompts for that
instance's `postgres` password without echoing/saving it. `--inspect` prints safe
metadata without connecting. Existing role passwords and records are preserved by
default. `--reconcile-password` explicitly updates only the selected project role
to the password already in its ignored `.env` URL. It refuses elevated roles,
roles shared with other databases/memberships and databases with a different owner.
New/reconciled application passwords must be at least 16 printable ASCII characters
without spaces; Node derives a salted SCRAM verifier so DDL never contains the
plaintext secret. This bootstrap restriction does not change the app user password
policy or the administrator password policy. Setup verifies temporary SQL write/read;
migrations and persistent acceptance are separate. Next run `npm.cmd run db:migrate`;
run `npm.cmd run test:integration` only after provisioning the separate test target.

Os serviços Windows usam 5432 para desenvolvimento e 5433 para a instância separada
de testes. Escolha `--development` ou `--test` no comando de setup; nunca há acesso
automático às duas instâncias. Informe a senha administrativa localmente, sem eco.
Por padrão, senhas existentes são preservadas. `--reconcile-password` autoriza
explicitamente alinhar apenas o usuário dedicado do projeto com o `.env`, após
verificar privilégios, vínculos e propriedade. O setup usa verificador SCRAM e
testa escrita/leitura temporária; isso não substitui aceitação persistida. Dados em
`.local/` e o arquivo `.env` ficam fora do Git. Não inicie outro cluster sobre as
portas ocupadas nem apague os diretórios dos serviços instalados.

Run from the repository root with registry access and Docker Compose available.
Installations must produce real manifests and lock entries; none were fabricated.
/ Execute na raiz com npm e Docker disponíveis. Não se inventam entradas no lockfile.

`npm ci` installs the pinned Prisma CLI, client and PostgreSQL adapter from the
committed lockfile. Keep all three on the same resolved release and rerun the
dependency audit when registry connectivity is available.
/ Mantenha os três pacotes na mesma versão resolvida, revise a auditoria e versione
o lockfile após validar.

Copy `.env.example` to `.env` and fill both passwords with different random values.
Assemble the URLs from the table, URL-encoding passwords. Format:
`postgresql://USER:PASSWORD@HOST:PORT/DATABASE` (uppercase words are placeholders).

Copie `.env.example` para `.env`, preencha senhas aleatórias distintas e monte as
URLs a partir da tabela, codificando as senhas para URL. Os termos em maiúsculas
são marcadores, não credenciais. Nunca publique `.env` ou URLs privadas.

| Variable / Variável | User / Usuário  | Host        | Port / Porta | Database / Banco |
| ------------------- | --------------- | ----------- | ------------ | ---------------- |
| `DATABASE_URL`      | `fintrack`      | `127.0.0.1` | `5432`       | `fintrack`       |
| `TEST_DATABASE_URL` | `fintrack_test` | `127.0.0.1` | `5433`       | `fintrack_test`  |

```sh
docker compose --env-file .env -f infra/compose.yaml up -d --wait postgres
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:status

docker compose --env-file .env -f infra/compose.yaml --profile test up -d --wait postgres-test
npm run test:integration
```

Both Compose passwords are required. Development uses a named volume; the test
service uses ephemeral storage. Both bind only to loopback. Stop with
`docker compose --env-file .env -f infra/compose.yaml --profile test stop`;
this preserves the development volume. These are local services, not a production
deployment, least-privilege role configuration or backup policy.

As duas senhas são obrigatórias. Desenvolvimento usa volume persistente; testes,
armazenamento temporário. Ambos expõem portas em loopback. O comando `stop` preserva
o volume de desenvolvimento. Isso não substitui deploy, papéis com privilégios
mínimos ou backup de produção.

Database scripts load root `.env` without overriding process variables. Configuration:
`apps/api/prisma.config.mjs`; generated TypeScript is ignored at
`apps/api/src/generated/prisma` so the API build compiles the client within its
source boundary. `npm run build -w @fintrack/api` generates the client first. The
generation-only fallback URL does not open a database connection.
`db:migrate` uses `migrate deploy`, never `db push` or `migrate reset`.

Os scripts carregam `.env` sem sobrescrever variáveis já definidas. O cliente gerado
é ignorado pelo Git. Migrações usam `migrate deploy`, sem reset destrutivo. Apenas
a saúde do processo independe de banco; autenticação e operações financeiras exigem
PostgreSQL acessível, credenciais válidas e migrações aplicadas.

## Recover local PostgreSQL 17 / Recuperar PostgreSQL 17 local

The Windows recovery procedure is restricted to `postgresql-x64-17`, port 5432,
and the verified data/HBA directory `C:\Program Files\PostgreSQL\17\data`.
It refuses a different instance. Port 5433 is not modified. Run in your own
PowerShell terminal (as administrator if file/service access requires it):

```powershell
Set-Location C:\Projetos\fintrack-pro
node scripts/recover-postgres-admin.mjs --inspect
node scripts/recover-postgres-admin.mjs
```

The script backs up the exact HBA bytes under ignored `.local/postgres17-recovery-*`.
It temporarily permits **only** `postgres` connecting to database `postgres` over
`127.0.0.1/32`. The first command in the authenticated psql session restores the
original configuration **before** `\password postgres` prompts for a new password.
The password is typed twice without echo, then once more to verify a fresh password
connection. It never enters Node, process arguments, script files or SQL history.
The script also restores in `finally`; an independent 30-second watchdog restores
the backup if the parent exits or hangs before restoration. No service restart,
reinstall, database deletion or global Windows policy change is used.

O procedimento verifica serviço, PID, versão, porta, diretório e HBA antes de agir.
O backup preserva os bytes originais; a restauração grava no mesmo arquivo para
preservar suas permissões. A exceção temporária permite somente `postgres` no banco
`postgres` via `127.0.0.1`. A configuração original volta **antes** dos prompts de
senha. A senha fica exclusivamente no terminal do psql, sem eco, argumentos ou
histórico. Uma restauração adicional em `finally` e um processo independente com
prazo de 30 segundos protegem falhas/interrupções. A porta 5433 fica intacta.

Do not run simultaneous HBA edits during recovery. Keep the printed backup path.
After a whole-machine power failure, inspect authentication before starting use;
if necessary restore with `node scripts/recover-postgres-admin.mjs --restore
<printed-directory>\state.json`. No software watchdog runs while Windows is off.
Never send passwords in chat or commit `.env`/recovery backups.

Não edite o HBA simultaneamente. Guarde o caminho do backup. Após queda de energia
do computador inteiro, confira a configuração antes de usar o serviço e restaure
com o comando acima se necessário. Nenhum watchdog funciona com o Windows desligado.
Validação dos testes do procedimento não comprova que a senha real foi redefinida:
essa confirmação exige executar o comando local e concluir a conexão final do psql.

Sources / Fontes: [PostgreSQL 17 HBA on Windows](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html)
and [psql password handling](https://www.postgresql.org/docs/17/app-psql.html).

## Isolated Windows acceptance / Aceitação Windows isolada

`npm.cmd run test:e2e:isolated` uses installed PostgreSQL 17 binaries to create a
fresh, password-protected cluster under ignored `.local/` on loopback port **55432**.
It does not change `.env` or the services on 5432/5433. Random test credentials stay
in memory; a one-use Windows named pipe supplies initdb. It provisions an ordinary
`fintrack_test` role, validates SCRAM reconciliation, applies the four migrations,
runs SQL integration and desktop/mobile browser acceptance, then stops its own
cluster. Diagnostic data is retained locally. The command refuses an occupied port.
It requires the existing Node installation, PostgreSQL 17 and Microsoft Edge.

Esse comando permite validar PostgreSQL real sem depender da senha administrativa
das instâncias instaladas. Usa um cluster novo, credenciais aleatórias em memória e
usuário de aplicação sem superpoderes. Apenas o banco `_test` recebe dados e limpeza
dos testes. O resultado não prova recuperação da instância pessoal em 5432.

## Identity model / Modelo de identidade

| Model / Modelo | Purpose and invariants / Finalidade e invariantes                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `User`         | UUID, unique normalized email, password hash, verification timestamp / email único normalizado, hash e verificação                      |
| `Session`      | User ownership, device, hashed access token, access/idle/absolute expiry, revocation / proprietário, dispositivo, expiração e revogação |
| `RefreshToken` | Session family, unique digest, consumption and expiry timestamps; replay history / histórico de uso para detectar reutilização          |
| `AuthToken`    | Purpose-scoped email verification/password recovery, digest, expiry and consumption / finalidade, hash, expiração e consumo             |

Foreign keys cascade identity deletion. SQL CHECK constraints enforce normalized
emails, digest shape and timestamp ordering; preserve them in future migrations.
Prisma does not represent all SQL CHECK constraints. Database constraints alone
do not perform authorization or session rotation.

Chaves estrangeiras propagam exclusão. CHECKs SQL validam normalização, formato dos
hashes e ordem de datas; preserve-os nas próximas migrações. O schema Prisma não
representa todos os CHECKs. Restrições não substituem autorização nem rotação.

The tested session core uses 15-minute access, 7-day idle and 30-day absolute
lifetimes. Its transitions do not persist data. The next repository must lock the
session row and atomically consume refresh/store its successor. Replay revocation
must commit before returning an error. Keep consumed hashes until absolute session
expiry, including expired tokens; test concurrent refresh/logout and rollback in PostgreSQL.

O núcleo testado usa acesso de 15 minutos, inatividade de 7 dias e limite absoluto
de 30 dias. As transições não persistem dados. O próximo repositório deve bloquear
a sessão e confirmar consumo/rotação atomicamente. Revogação por reutilização deve
ser confirmada antes do erro. Preserve hashes consumidos até expirar a sessão e
valide concorrência e rollback no PostgreSQL.

## Integration gate / Requisito de integração

`test:integration` builds the API, requires an explicit loopback `TEST_DATABASE_URL`
ending in `_test`, validates/generates Prisma, deploys migrations twice (second run
must be a no-op), checks migration status and runs the database suite. It never
uses the development URL as fallback, rejects URL query options and cleans up
only its own uniquely identified records.

The suite is written to check reconnect persistence, email constraints, foreign
keys, concurrent single-winner consumption, rollback, timestamp/hash constraints
and cascade deletion. It does **not** establish end-to-end login, email delivery
or full transactional refresh rotation. Missing prerequisites fail with a nonzero
exit. No mock fallback or skipped test is reported as integration success.

A suíte exige banco local de teste explícito, valida Prisma, aplica migrações duas
vezes e testa persistência, restrições, concorrência, rollback e cascata. Só limpa
seus próprios registros. Ela **não** valida login completo, entrega de email ou
rotação transacional completa. Pré-requisitos ausentes encerram com erro, sem
mock ou aprovação fictícia.

## Ledger schema / Modelo do ledger

The current Prisma schema models accounts (checking, savings, wallet and cash),
income/expense categories and dated transactions. Amounts use PostgreSQL `BIGINT`
minor units. Composite foreign keys bind each account and category reference to
the transaction owner; a database unique key scopes idempotency to the owner.
Transfers are represented as one entry with source and destination accounts, and
SQL checks reject non-positive amounts, same-account transfers and invalid transfer
shapes. Account balances are intended to be derived from entries: income adds,
expense subtracts, and transfers subtract from source/add to destination. No balance
column is stored.

Authenticated account/category/transaction routes and personal mobile/web forms are
implemented. Balances are derived through exact-cent domain rules, with complete
paged transaction reads. Editing/deletion policies and the larger financial lifecycle
remain pending. `tests/integration/ledger.test.mjs` and `npm.cmd run test:e2e:real`
require real PostgreSQL and must pass before persistence is accepted as integrated.

References consulted on 2026-10-27 / Referências consultadas em 27/10/2026:
[Prisma PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql),
[generator](https://www.prisma.io/docs/orm/prisma-schema/overview/generators),
[config](https://www.prisma.io/docs/orm/reference/prisma-config-reference),
[PostgreSQL constraints](https://www.postgresql.org/docs/17/ddl-constraints.html),
[official image](https://hub.docker.com/_/postgres).
