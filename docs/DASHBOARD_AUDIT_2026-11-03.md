# Auditoria do dashboard — 2026-11-03

## Plano curto e limites de commits

1. Corrigir o período e a apresentação do dashboard com dados da API; validar cálculo, web/native e E2E; criar um commit de dashboard.
2. Corrigir falhas reproduzíveis nos formulários e validar os fluxos afetados; criar commits separados por funcionalidade quando o Git permitir.
3. Registrar as verificações e os bloqueios sem alterar dados existentes.

## Diagnóstico com evidência

| Gravidade            | Achado                                                                                                                                     | Evidência                                                                              | Situação                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Alta                 | Dashboard autenticado sempre calculava o mês corrente; não havia controle de período.                                                      | `PersonalOverview` chamava `summarizePersonalFinance(..., today())` sem estado de mês. | Corrigido; teste unitário e E2E verificam o corte do período.                |
| Média                | Card de histórico renderizava todas as transações carregadas, aumentando a tela e o custo de renderização.                                 | `data.transactions.map` no card antigo.                                                | Corrigido; mostra cinco registros recentes e link para o histórico completo. |
| Média                | Data inicial de formulários e dashboard vinha de `toISOString()` (UTC), podendo apontar para o dia seguinte no Brasil perto da meia-noite. | `today()` antigo em `screens.tsx`; `dateInTimeZone` já existia em `@fintrack/shared`.  | Corrigido com o fuso financeiro existente.                                   |
| Média                | Edição do nome de conta fecha mesmo quando a API falha.                                                                                    | `updateAccount` captura erro e resolve; `AccountActions` fecha em qualquer resolução.  | Corrigido; E2E cobre falha e nova tentativa.                                 |
| Baixa                | A paleta clara não usava o fundo, texto e bordas da identidade solicitada.                                                                 | Tokens em `theme-colors.ts`.                                                           | Corrigido; testes de contraste mantidos.                                     |
| Baixa                | A barra móvel truncava nomes com cinco abas.                                                                                               | Captura de tela E2E em Pixel 7 antes do ajuste.                                        | Ajustada para quatro destinos principais.                                    |
| Limitação de produto | Notificações, vencimentos, orçamentos e metas reais não têm modelos/endpoints persistidos neste monorepo.                                  | `schema.prisma`, módulos de `apps/api/src`, rotas atuais.                              | Pendente; o dashboard não exibe números fictícios para esses recursos.       |

O banco principal respondeu ao `npm.cmd run db:status` com cinco migrations atualizadas. `npm.cmd run doctor` confirmou as tabelas principais, mas as credenciais do banco isolado `TEST_DATABASE_URL` foram rejeitadas (`28P01`). Nenhum dado do banco principal foi alterado nesta auditoria.

## Validação executada

- Estado inicial: `npm.cmd test` — 119/119; `npm.cmd run lint` e `npm.cmd run typecheck` — aprovados.
- Após o dashboard: `npm.cmd test` — 121/121; `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run bundle` — aprovados.
- `EXPO_PUBLIC_API_URL=https://api.example.test/v1 node scripts/expo.mjs export --platform web` (variável definida apenas no processo de teste) e `npm.cmd run test:e2e` — 40/40 aprovados em desktop e mobile, com API simulada e explícita. Após os ajustes de navegação, o teste de dashboard passou 2/2 e confirmou que Cartões continua acessível no desktop; o teste combinado de dashboard/fundação passou 10/10 antes do último ajuste de visibilidade.
- `npx.cmd playwright test e2e/account-edit.spec.ts e2e/personal-dashboard.spec.ts` — 4/4 aprovados; o editor preserva o valor após HTTP 503 e fecha após salvar.
- `npm.cmd run test:integration` — bloqueado por `P1000` no banco isolado `fintrack_test`; o banco principal não foi usado como substituto.
- `PORT=3102 npm.cmd run api` seguido de `GET /v1/health/ready` — HTTP 200 no banco principal, sem escrita. A porta 3000 já estava ocupada por outro processo.
- `npm.cmd run format:check` — falhou por três documentos preexistentes e dois testes novos ainda não formatados na primeira execução. Os dois testes novos foram formatados; os documentos preexistentes não foram alterados.
- `git add -- <arquivos da etapa>` — recusado ao criar `.git/index.lock` (`Permission denied`). Nenhum commit ou push foi feito.

## Pendências

Autenticação, persistência e isolamento reais ainda requerem o banco de teste com credenciais válidas para executar integração e E2E real. Recursos de vencimentos, orçamentos, metas e notificações precisam de modelo, API e interface próprios. A saudação nominal requer um nome/perfil persistido, que o modelo de usuário atual não oferece. O resultado E2E simulado não substitui essa validação real.
