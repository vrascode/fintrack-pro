# Guia de desenvolvimento

Consulte a [instalação](../../README.pt-BR.md). Execute os comandos na raiz do projeto.
Esta pasta é um repositório Git independente, na branch `main`, com remoto
`https://github.com/vrascode/fintrack-pro.git`. Trabalhe apenas neste projeto e
confira `git diff --cached --name-only` antes de cada commit por funcionalidade.
A instrução atual autoriza commits validados e push para `origin/main`, sem
reescrever histórico nem usar force push. Suspenda a publicação diante de bloqueios
de segurança, credenciais ou validação crítica e registre a falha no progresso.

- `packages/shared`: contratos Zod, centavos de 64 bits e aritmética de calendário.
- `packages/config`: configuração estrita do compilador e regras de lint.
- `apps/api`: NestJS ESM, compilado com TypeScript para metadados de decorators.
- `apps/mobile`: Expo Router, componentes reutilizáveis e preferências Zustand.
- `tests`: testes Node, HTTP real em loopback e persistência temporária em disco.
- `e2e`: testes Playwright sobre o app exportado.

A fase 2 adiciona contratos de identidade e primitivas de senha/tokens/sessão em
`apps/api/src/identity`. Essas funções não persistem usuários nem expõem login.
Siga [DATABASE.md](../../DATABASE.md) para `db:validate`, `db:generate`, `db:migrate`
e `test:integration`. A suíte de banco é separada de `check` e precisa passar antes
de afirmar persistência real.

`typecheck` gera declarações de shared/API antes de verificar tipos de mobile e
testes; não depende mais de build anterior. O cliente Prisma gerado é ignorado
pelo Git, formatação e lint; validação de schema/cliente é requisito separado.

Exemplos: `parseDecimal('12.34') === 1234n`; `splitMoney(100n, 3)` retorna
`[34n, 33n, 33n]`. A entrada decimal usa ponto e até duas casas; excesso de precisão
é rejeitado. Razões arredondam metades para longe de zero. O JSON usa strings
inteiras canônicas, nunca floats. `addMonths('2024-01-31', 1)` retorna `2024-02-29`;
calcule recorrências a partir da data original para evitar perda cumulativa do dia.

Gravações de preferências são serializadas, combinadas com o último estado salvo
e exibidas apenas após persistência bem-sucedida. Falha de leitura bloqueia edições.
Versões desconhecidas são preservadas e mostradas como erro recuperável; restaurar
é ação explícita. As preferências não sincronizam entre dispositivos.

Para builds offline no PowerShell, defina `EXPO_OFFLINE=1`, `EXPO_NO_TELEMETRY=1` e
`CI=1` no ambiente. Direcione `TEMP` e `TMP` à pasta `.cache` do projeto para manter
temporários do Metro no workspace. A checagem offline de compatibilidade usa os
metadados do SDK instalado e não consulta metadados atuais do servidor.

Execute `npm run check`, `npm run bundle` e `npm run test:e2e` após mudanças.
Bundle e navegador não validam execução em aparelho. Consulte os limites em
[segurança](../../SECURITY.md) e [banco](../../DATABASE.md); registre resultados
reais no [progresso](../../PORTFOLIO_PROGRESS.md).
