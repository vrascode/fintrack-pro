# Relatório de testes — 2026-11-04

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
