# Auditoria do projeto — 2026-11-04

Esta auditoria descreve o estado observado no checkout local. Existência de código ou relato antigo não conta como validação de uso real. A árvore Git estava limpa em `main` antes desta etapa.

## Plano de execução e limites de commits

1. Registrar evidências e validar banco e testes sem alterar dados pessoais. Commit de auditoria somente após revisão.
2. Corrigir falhas financeiras e de segurança isoladas, cada uma com teste e commit próprio.
3. Avançar para autenticação, recorrências, cartões e interface conforme as dependências de banco e serviço externo permitirem. Não declarar essas fases concluídas por haver schema ou tela.

## Mapa observado

| Área                 | Estado observado                                                                                                    | Evidência                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Monorepo             | npm workspaces com `apps/api`, `apps/mobile`, `packages/shared`                                                     | `package.json`                                                       |
| Persistência pessoal | API NestJS/Prisma com contas, categorias, transações, orçamentos e metas                                            | `apps/api/src/app.ts`, controllers e `apps/api/prisma/schema.prisma` |
| Autenticação         | Cadastro, login, logout e renovação com sessões persistidas; recuperação e verificação de e-mail ausentes nas rotas | `apps/api/src/identity/auth.controller.ts`                           |
| Transações           | CRUD, revisão, exclusão lógica e chave de idempotência na API; histórico de alterações em tabela própria            | `apps/api/src/transactions/`                                         |
| Banco principal      | PostgreSQL 17.11 acessível, tabelas legíveis, oito migrações aplicadas                                              | `npm.cmd run doctor`, `npm.cmd run db:status` nesta data             |
| Banco de testes      | Porta 5433 aberta, autenticação de `fintrack_test` falha                                                            | `npm.cmd run test:integration`: P1000; `doctor`: 28P01               |
| Demonstração         | Telas de contas mensais e caixinhas usam dados locais explicitamente fictícios                                      | `apps/mobile/app/(tabs)/bills.tsx`, `envelopes.tsx`                  |
| Cartões              | Tela vazia, sem módulo Prisma ou API                                                                                | `apps/mobile/app/(tabs)/cards.tsx`, schema e módulos API             |
| Relatórios           | Cálculo e CSV pessoais no cliente; PDF ausente                                                                      | `apps/mobile/src/personal/reports.ts`, `ReportsScreen.tsx`           |
| CI                   | Testes PostgreSQL em serviço isolado; qualidade e E2E web em Windows                                                | `.github/workflows/ci.yml`                                           |

## Achados priorizados

| Gravidade           | Problema e evidência                                                                                                                                   | Arquivos envolvidos                                                                                     | Solução proposta                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crítica para aceite | Testes reais não chegam às migrações: `test:integration` falha com P1000 em 5433. Cluster temporário falha no `pg_ctl` com erro 87.                    | `.env` local ignorado, `scripts/database.mjs`, `scripts/test-isolated-postgres.mjs`                     | Configurar credencial do banco de testes localmente por mecanismo seguro ou reparar inicialização do cluster isolado; repetir integração antes de aceitar persistência. Não modificar o banco principal. |
| Alta                | CSV pessoal não neutraliza fórmulas; o exportador demonstrativo só verifica o primeiro caractere. Texto com espaços antes de `=` atravessa a checagem. | `apps/mobile/src/personal/reports.ts`, `packages/shared/src/finance.ts`                                 | Centralizar escape e testar prefixos de fórmula e caracteres de controle.                                                                                                                                |
| Alta                | Dashboard e relatórios carregam todo o histórico em páginas de 100 para calcular indicadores, mesmo quando há milhares de registros.                   | `apps/mobile/src/api/client.ts`, `usePersonalFinance.ts`, `FinancialDashboard.tsx`, `ReportsScreen.tsx` | Agregar indicadores no servidor e paginar histórico na interface, sem perder exatidão em centavos.                                                                                                       |
| Alta                | Recuperação/verificação de e-mail e gestão de sessões por dispositivo não têm fluxo HTTP completo.                                                     | `apps/api/src/identity/`, `apps/mobile/app/login.tsx`                                                   | Integrar entrega real configurável e testes locais; expor revogação por dispositivo.                                                                                                                     |
| Alta                | Contas mensais e cartões não persistem no ambiente pessoal.                                                                                            | `apps/mobile/app/(tabs)/bills.tsx`, `cards.tsx`, `apps/api/prisma/schema.prisma`                        | Criar modelos, migrações incrementais, serviços transacionais e testes SQL isolados antes de conectar telas.                                                                                             |
| Média               | PDF, notificações e push não têm fluxo funcional pessoal.                                                                                              | `apps/mobile/src/personal/ReportsScreen.tsx`, módulos API ausentes                                      | Implementar exportação e alertas sem afirmar envio quando não configurado.                                                                                                                               |
| Média               | Limitador de autenticação usa memória por processo; instâncias múltiplas não compartilham limites.                                                     | `apps/api/src/identity/auth-rate-limit.guard.ts`                                                        | Adotar armazenamento distribuído antes de produção.                                                                                                                                                      |
| Média               | `npm audit` não obteve resposta do registry nesta execução; não há resultado novo de vulnerabilidades.                                                 | `package-lock.json`, `SECURITY.md`                                                                      | Repetir com conectividade e avaliar achados antes de atualizar dependências.                                                                                                                             |

## Diagnósticos executados nesta data

O achado de injeção de fórmulas em CSV foi corrigido nesta etapa com uma função de escape compartilhada e testes unitários para exportação pessoal e demonstrativa. A abertura em programas de planilha distintos ainda não foi validada.

- `npm.cmd run build`: passou, inclusive geração do Prisma Client.
- `npm.cmd run db:status`: passou; oito migrações aplicadas no banco principal.
- `npm.cmd run doctor`: banco principal pronto; banco de testes rejeitou credenciais.
- `npm.cmd run test:integration`: falhou antes dos testes SQL, P1000 na porta 5433.
- `npm.cmd run test:e2e:isolated`: falhou ao iniciar PostgreSQL temporário (`pg_ctl`, erro 87).
- `npm.cmd audit --json --fetch-retries=0 --fetch-timeout=15000`: endpoint indisponível; auditoria inconclusiva.

Nenhum dado existente foi alterado por esses diagnósticos. O estado real de navegador, dispositivos físicos e release exige validação separada.
