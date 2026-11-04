# Relatório de testes — 2026-11-04

## Ciclo de cartões

`npm.cmd run check` passou com 136 testes, incluindo distribuição exata de parcelas e calendário de fechamento/vencimento. `202611040003_card_ledger` foi aplicada ao banco de desenvolvimento após backup local verificável, e as três tabelas novas responderam a consultas de leitura. `npm.cmd run test:integration` parou antes dos testes SQL com P1000 em `fintrack_test` (porta 5433); o novo `tests/integration/cards.test.mjs` foi incluído no runner, mas não executou. E2E com API real, pagamentos persistidos e concorrência SQL deste módulo seguem sem validação.

## Correção de contas mensais e início de cartões

Backups locais verificáveis precederam as migrações aditivas `202611040001_bills` e `202611040002_credit_cards`, aplicadas ao banco de desenvolvimento. A API retornou HTTP 200 em `/v1/health/ready` e HTTP 401 em `/v1/bills` sem sessão; consultas de listagem de contas mensais e cartões pelo Prisma concluíram. `npm.cmd run check` passou com 135 testes, build, lint, typecheck e formatação. O banco de testes na porta 5433 ainda rejeita credenciais, portanto testes SQL destrutivos e persistência após reinício não foram validados nesta etapa. Compras e faturas de cartões não estão implementadas.

| Comando                                                        | Resultado observado                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm.cmd run build`                                            | Passou; Prisma Client gerado.                                                                |
| `npm.cmd run lint`                                             | Passou na execução final de `npm.cmd run check`.                                             |
| `npm.cmd run typecheck`                                        | Passou na execução final de `npm.cmd run check`.                                             |
| `npm.cmd test`                                                 | 131 testes passaram na execução final de `npm.cmd run check`.                                |
| `npm.cmd run format:check`                                     | Passou na execução final de `npm.cmd run check`.                                             |
| `npm.cmd run test:integration`                                 | Falhou antes dos testes SQL: P1000 na autenticação do PostgreSQL de teste (porta 5433).      |
| `npm.cmd run test:e2e:isolated`                                | Falhou antes da API: `pg_ctl` não iniciou cluster temporário (erro 87).                      |
| `npm.cmd run bundle`                                           | Exportou Web, Android e iOS com URL HTTPS de teste. Isso não gera APK nem testa dispositivo. |
| `npm.cmd run test:e2e`                                         | 46/46 passaram em navegador desktop e viewport mobile; requisições de API interceptadas.     |
| `npm.cmd run doctor`                                           | Banco principal PostgreSQL 17.11 pronto; teste rejeitou credenciais.                         |
| `npm.cmd run db:status`                                        | Oito migrações aplicadas no banco principal.                                                 |
| `npm.cmd audit --json --fetch-retries=0 --fetch-timeout=15000` | Inconclusivo: falha ao acessar endpoint npm.                                                 |

Persistência com PostgreSQL real, reinício da API, navegador conectado à API real e dispositivos físicos não foram validados nesta etapa. Nenhum teste destrutivo foi direcionado ao banco de desenvolvimento.

## Contas mensais — continuação

Revisão posterior: `npm.cmd run check` passou com 134 testes, build, lint, typecheck e formatação. `npm.cmd run bundle` exportou Web/Android/iOS; `npm.cmd run test:e2e` passou 46/46 com API interceptada. Foi criado `tests/integration/bills.test.mjs` e incluído no runner SQL, mas `npm.cmd run test:integration` parou em P1000 na autenticação de `fintrack_test` antes de aplicar a migração ou executar testes. Nenhum resultado SQL do módulo é reivindicado.

`npm.cmd run db:status` confirmou nove migrações no checkout e `202611040001_bills` ainda pendente no banco principal. Nenhuma migração foi aplicada nesta etapa.

`npm.cmd run typecheck` passou (inclui build), `npm.cmd run lint` passou, `npm.cmd run format:check` passou. `npm.cmd test` passou com 133 testes após o contrato de calendário; um teste direcionado do serviço de pagamentos também passou. A migração de contas mensais não foi aplicada no banco principal; integração SQL continua dependente das credenciais do banco de testes. Nenhum E2E com API real foi executado para este módulo.

## Preparação de produção — 2026-11-04

`npm.cmd run check` passou: build, lint, typecheck, formatação e 143/143 testes
unitários. Testes direcionados de URL, cookies, CORS, EAS e TLS PostgreSQL
passaram. `npm.cmd run test:integration` validou e gerou o Prisma Client, mas
parou em `P1000` ao autenticar no PostgreSQL isolado da porta 5433; nenhum
teste SQL executou. Nenhum teste remoto de Neon, Render, Vercel ou Android
físico foi executado.
`npm.cmd run release:web` exportou o bundle com uma URL HTTPS sintética apenas
para verificar compilação; nenhum endereço de API real foi testado ou publicado.
