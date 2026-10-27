# Database / Banco de dados

## Current boundary / Limite atual

Phase 2 preparation is in source: PostgreSQL 17 Compose services, Prisma 7 schema,
an initial SQL migration and an integration suite. Prisma is not installed and
PostgreSQL/Docker are unavailable in the current environment. The migration was
hand-authored and has **not been applied or validated by Prisma**. Authentication
HTTP endpoints and the transactional repository remain unimplemented.

A preparação da fase 2 está no código: serviços PostgreSQL 17, schema Prisma 7,
migração SQL inicial e suíte de integração. Prisma e PostgreSQL/Docker estão
indisponíveis. A migração foi escrita manualmente e **não foi aplicada nem validada
pelo Prisma**. Endpoints de autenticação e repositório transacional permanecem
pendentes. Arquivos novos também aguardam commit.

`/v1/health` checks process liveness only. AsyncStorage holds only non-sensitive
preferences under `fintrack.preferences.v1`; never passwords, tokens or financial records.
/ Saúde do processo não verifica o banco; AsyncStorage guarda apenas preferências.

## Local setup / Configuração local

Run from the repository root with registry access and Docker Compose available.
Installations must produce real manifests and lock entries; none were fabricated.
/ Execute na raiz com npm e Docker disponíveis. Não se inventam entradas no lockfile.

```sh
npm install --workspace @fintrack/api @prisma/client@7 @prisma/adapter-pg@7
npm install --save-dev --workspace @fintrack/api prisma@7
```

Keep all three Prisma packages on the same resolved release. `.npmrc` requests exact
saved versions. Review the audit and commit the actual lockfile after validation.
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
`apps/api/prisma.config.mjs`; generated TypeScript: ignored `apps/api/generated/prisma`.
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

No financial schema is delivered yet. Future ledger work retains BIGINT minor
units, owner-scoped relationships, atomicity and idempotency. / O modelo financeiro
segue pendente, com centavos BIGINT, isolamento por proprietário e atomicidade.

References consulted on 2026-10-27 / Referências consultadas em 27/10/2026:
[Prisma PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql),
[generator](https://www.prisma.io/docs/orm/prisma-schema/overview/generators),
[config](https://www.prisma.io/docs/orm/reference/prisma-config-reference),
[PostgreSQL constraints](https://www.postgresql.org/docs/17/ddl-constraints.html),
[official image](https://hub.docker.com/_/postgres).
