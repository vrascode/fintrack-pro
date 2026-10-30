# Database / Banco de dados

## Current boundary / Limite atual

Phase 2 and ledger preparation are in source: PostgreSQL 17 Compose services, Prisma 7
dependencies, schema/client generation, versioned identity and ledger migrations,
and real-database integration suites. Prisma validates the schema and generates the
client locally. PostgreSQL/Docker are unavailable here, so no migration has been
applied and the integration suites have not passed. The API has process and database
readiness endpoints plus a lazy Prisma service, but authentication HTTP endpoints,
financial repositories and application services remain unimplemented.

Migration `202610300001_account_opening_balance` adds exact-cent opening balance,
reference date and planning inclusion to accounts without deleting or rewriting
ledger data. Existing rows default to zero cents, migration date and planning enabled.

A preparação da fase 2 e do ledger está no código: serviços PostgreSQL 17,
dependências Prisma 7, validação do schema/geração do cliente, migrações versionadas
de identidade e ledger e suítes para banco real. O Prisma valida o schema e gera o
cliente localmente. PostgreSQL/Docker estão indisponíveis neste ambiente, portanto as
migrações não foram aplicadas e as suítes reais não passaram. Rotas HTTP de identidade,
repositórios financeiros e serviços de aplicação continuam pendentes.

`/v1/health` checks process liveness; `/v1/health/ready` checks database readiness.
AsyncStorage holds only non-sensitive preferences under `fintrack.preferences.v1`;
never passwords, tokens or financial records. / A saúde do processo e a prontidão do
banco têm endpoints distintos; AsyncStorage guarda apenas preferências.

## Local setup / Configuração local

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
é ignorado pelo Git. Migrações usam `migrate deploy`, sem reset destrutivo. A API
atual continua independente da configuração de banco.

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

These are persistence constraints, not a completed financial feature. No account or
transaction HTTP route, authenticated owner context, repository, balance query,
editing/deletion policy or mobile workflow exists yet. The hand-authored ledger
migration has not been applied to PostgreSQL. `tests/integration/ledger.test.mjs`
requires real PostgreSQL and must pass before this schema is accepted as integrated.

References consulted on 2026-10-27 / Referências consultadas em 27/10/2026:
[Prisma PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql),
[generator](https://www.prisma.io/docs/orm/prisma-schema/overview/generators),
[config](https://www.prisma.io/docs/orm/reference/prisma-config-reference),
[PostgreSQL constraints](https://www.postgresql.org/docs/17/ddl-constraints.html),
[official image](https://hub.docker.com/_/postgres).
