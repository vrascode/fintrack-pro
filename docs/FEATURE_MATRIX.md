# Matriz de funcionalidades — 2026-11-04

Estados consideram a validação executada neste checkout. Testes unitários com repositórios simulados e E2E com API interceptada não provam persistência PostgreSQL.

| Funcionalidade                                  | Estado                         | Evidência ou condição pendente                                                           |
| ----------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Cadastro, login, logout e renovação             | Implementado, mas não validado | Código HTTP/Prisma e testes unitários; integração SQL local bloqueada por P1000 em 5433. |
| Recuperação e verificação de e-mail             | Pendente                       | Sem rotas e provedor configurado.                                                        |
| Gerenciamento de sessões por dispositivo        | Parcialmente implementado      | Revogação da sessão corrente; falta listagem/revogação por dispositivo.                  |
| Contas, categorias, transações e transferências | Implementado, mas não validado | API e interface pessoais; integração SQL local bloqueada nesta data.                     |
| Edição, exclusão lógica e histórico de revisão  | Implementado, mas não validado | Serviço e testes unitários; integração SQL local bloqueada nesta data.                   |
| Contas mensais e recorrência                    | Parcialmente implementado      | Simulação demonstrativa isolada; sem persistência pessoal.                               |

Atualização de implementação: modelos `Bill` e `BillPayment`, migração incremental, API autenticada e tela pessoal foram adicionados. A migração ainda não foi aplicada nem validada com PostgreSQL de testes; o estado continua **parcialmente implementado** até o teste SQL real e revisão do fluxo no navegador com API real.
| Cartões, faturas e parcelas | Pendente | Tela indica desenvolvimento; sem modelos e rotas. |
| Orçamentos e metas | Implementado, mas não validado | API e interface pessoais; integração SQL local bloqueada nesta data. |
| Reserva vinculada a conta real | Pendente | Caixinhas demonstrativas são virtuais. |
| Dashboard pessoal | Parcialmente implementado | Indicadores usam transações reais recebidas da API, mas carregam o histórico inteiro no cliente. |
| Relatórios e CSV | Parcialmente implementado | Cálculo e CSV na interface; escape de fórmulas passou em testes unitários. Falta PDF e agregação no servidor. |
| Alertas e notificações | Pendente | Sem infraestrutura pessoal persistente. |
| Português, inglês e temas | Implementado e testado | Testes unitários e 46 E2E web com API interceptada nesta data. |
| Web e bundles móveis | Implementado, mas não validado | Exportação das três plataformas passou; sem execução em dispositivo físico. |
| Isolamento entre usuários | Implementado, mas não validado | Escopo por usuário no código e testes unitários; integração SQL local pendente. |
| Preparação de produção | Pendente | Credenciais, infraestrutura, auditoria de dependências e aceite real pendentes. |
