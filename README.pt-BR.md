# FinTrack Pro

**Aplicativo de finanças pessoais desenvolvido com Expo, React Native, TypeScript e NestJS.**

[English](README.md) · [Roteiro](ROADMAP.md) · [Registro de validação](PORTFOLIO_PROGRESS.md)

O FinTrack Pro está sendo desenvolvido para dispositivos móveis, com contratos
compartilhados, cálculos monetários exatos e limites explícitos de segurança. Há
uma demonstração fictícia e isolada com fluxos de planejamento para web e mobile.
O código agora conecta contas autenticadas, receitas/despesas realizadas, categorias
e dashboard pessoal à API Prisma. A aceitação com PostgreSQL 17 real passou em
ambiente isolado: cadastro, login, contas, receitas/despesas e persistência.
A instância pessoal em 5432 ainda exige recuperação administrativa e configuração;
isso continua impedindo declarar a instalação local pronta para uso.

## O que funciona hoje

| Área                 | Comportamento implementado                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App                  | Shell responsivo desktop/mobile; dashboard, contas/movimentações/contas a pagar/caixinhas/simulador de demonstração e ajustes                                 |
| Preferências         | Tema claro/escuro/automático, privacidade, persistência, recuperação de corrupção e tratamento de falhas                                                      |
| Domínio              | Dinheiro em inteiros exatos, cálculos financeiros, datas civis validadas, CSV seguro contra fórmulas e contratos Zod compartilhados                           |
| API                  | NestJS com cadastro/login, prontidão e contas/categorias/lançamentos por usuário; loopback por padrão                                                         |
| Núcleo de identidade | Derivação/verificação de senha, tokens opacos, expiração, rotação/reutilização e transições de revogação por dispositivo, testadas independentemente do banco |
| Preparação do banco  | Quatro migrações Prisma, nove testes SQL e dois cenários financeiros de navegador aprovados em PostgreSQL 17 isolado                                          |

A API inclui cadastro/login, autorização por usuário, recuperação de sessão por
cookie e endpoints financeiros. Testes unitários não comprovam PostgreSQL. Veja a
[configuração do banco e pendências](DATABASE.md).

### Uso local com dados próprios

Execute `node scripts/setup-local-postgres.mjs --development` em seu terminal.
O alvo vem do `DATABASE_URL` local (5432 nesta instalação). A senha administrativa
fica oculta e não é salva. O comando cria somente usuários/bancos ausentes.
Para reconciliar explicitamente a senha do usuário dedicado `fintrack` com o `.env`,
acrescente `--reconcile-password`; usuários privilegiados ou compartilhados são
recusados. O teste é separado: `node scripts/setup-local-postgres.mjs --test` usa
somente `TEST_DATABASE_URL` (5433 nesta instalação). `--inspect` mostra o alvo sem
senha e sem conectar. Se a senha administrativa foi perdida, siga a
[recuperação local](DATABASE.md#recover-local-postgresql-17--recuperar-postgresql-17-local).

Execute `npm.cmd run db:migrate`; depois `npm.cmd run api` e `npm.cmd run web` em
terminais separados. Abra `http://localhost:8081/login`. O cadastro leva à primeira
conta: informe nome, saldo inicial e data de referência. No dashboard pessoal, use
**Nova receita ou despesa** para registrar valores. Nenhum exemplo é inserido na
conta pessoal. O endpoint `http://127.0.0.1:3000/v1/health/ready` precisa retornar 200.

`npm.cmd run test:e2e:real` exige o banco separado `_test`, aplica migrações e cobre
cadastro pela interface, saldo inicial de R$ 1.000, receita de R$ 500, despesa de
R$ 200 e saldo de R$ 1.300; também inclui reload, reinício da API, logout/login,
isolamento e repetição de lançamento. `npm.cmd run test:e2e:isolated` executou essa
suíte com sucesso em um cluster PostgreSQL 17 novo na porta 55432: nove testes SQL
e dois cenários de navegador desktop/mobile passaram. `.env` e serviços 5432/5433
foram preservados; essas instâncias ainda precisam da configuração própria.
O uso local exige banco e API em execução. Celular físico precisa de uma API
acessível por ele; não há implantação independente no aparelho validada.

## Interface e idiomas

O app mobile e a versão web compartilham uma base de interface responsiva, com
temas claro, escuro e automático. Tema, idioma, privacidade e recolhimento da
sidebar no desktop são preferências locais não sensíveis. A interface oferece
português brasileiro e inglês, além de formatação de datas por locale e valores
monetários exatos em centavos. No desktop há uma sidebar recolhível; no mobile,
a navegação usa abas inferiores.

Selecione **Explorar demonstração** no dashboard para abrir um conjunto fictício
de seis meses, salvo em uma chave local separada. A demonstração permite lançar
receitas/despesas/transferências, exportar CSV filtrado, pagar obrigações total
ou parcialmente, aportar/resgatar caixinhas virtuais e simular cenários sem
gravar movimentações. O selo de dados fictícios permanece visível. Restaurar ou
editar a demonstração nunca altera registros pessoais ou uma conta bancária.
Esses fluxos não substituem serviços financeiros reais. Veja a
[arquitetura](ARCHITECTURE.md).

| Demonstração desktop                                                                          | Demonstração mobile                                                                         |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ![Dashboard fictício do FinTrack Pro no desktop](docs/screenshots/demo-dashboard-desktop.png) | ![Dashboard fictício do FinTrack Pro no mobile](docs/screenshots/demo-dashboard-mobile.png) |

## Marca e APK Android

Os SVGs originais e ícones gerados estão em `apps/mobile/assets/brand/`. O Expo
usa o ícone do app, foreground/monocromático adaptive do Android, splash e
favicon web. Alterar um ícone nativo exige nova compilação e reinstalação; hot
reload não atualiza o ícone instalado.

Há um perfil interno de APK em `apps/mobile/eas.json`. Após vincular o projeto a
uma conta Expo autenticada, execute no diretório `apps/mobile`:

```sh
npx eas-cli build --platform android --profile preview
```

Esta entrega não inclui um APK gerado nem declara um release publicado.

## Início rápido

Requisitos: Node.js 24 LTS (`>=24.13.0 <25`), npm e acesso ao registro na primeira
instalação. As verificações locais usaram Node 24.20.0 e npm 11.19.0. No PowerShell,
use `npm.cmd` / `npx.cmd` se a política bloquear `npm.ps1`.

```sh
npm ci
npm run build
npm run api
# Em outro terminal
npm run web
# Ou inicie o Expo para um dispositivo/simulador compatível
npm run mobile
```

Abra a URL exibida pelo Expo. Em **Ajustes**, selecione **Escuro**, ative
**Ocultar valores por padrão** e recarregue: ambas as escolhas persistem no
dispositivo. Falhas de armazenamento são exibidas sem afirmar que a alteração foi salva.

`GET http://127.0.0.1:3000/v1/health` retorna:

```json
{ "service": "fintrack-api", "status": "ok", "scope": "process" }
```

Configure `HOST` e `PORT` no terminal; a API não carrega `.env` automaticamente.
Os scripts de banco carregam o `.env` da raiz separadamente. O arquivo
[.env.example](.env.example) contém as configurações sem credenciais.

## Desenvolvimento e validação

```sh
npm run check          # Lint, build/typecheck, testes locais e formatação
npm run bundle         # Exports Android, iOS e web
npm run test:e2e       # Edge sem janela: tamanhos desktop e mobile
```

O GitHub Actions executa essas verificações, exports mobile/web e os dois tamanhos
de navegador em pushes e pull requests para `main`. Consulte o [workflow de CI](.github/workflows/ci.yml).

E2E exige bundle atualizado e Microsoft Edge instalado, inicia seu próprio servidor
na porta 4173 e o encerra ao final. Preview manual: `node scripts/serve.mjs`.
Exports e testes de navegador não validam funcionamento nativo, biometria nem
assinatura de releases.

Siga [DATABASE.md](DATABASE.md), configure bancos distintos de desenvolvimento/teste e execute:

```sh
npm run db:validate
npm run db:generate
npm run db:migrate
npm run test:integration
```

A integração é um requisito separado: falha quando faltam pré-requisitos, nunca
usa o banco de desenvolvimento como fallback e não conta como teste unitário
aprovado. Resultados e bloqueios estão no [registro de progresso](PORTFOLIO_PROGRESS.md).

## Repositório

```text
apps/mobile/       UI Expo Router, design system e preferências locais
apps/api/          Saúde NestJS, núcleo de identidade, schema/migração Prisma
packages/shared/   Contratos, dinheiro e datas
packages/config/   TypeScript estrito e lint
infra/             Serviços PostgreSQL locais
tests/             Testes de domínio, segurança, persistência e HTTP
tests/integration/ Suíte de integração PostgreSQL/Prisma
e2e/               Testes de interação no navegador
```

Consulte a [arquitetura](ARCHITECTURE.md), [revisão de segurança](SECURITY.md),
[guia de desenvolvimento](docs/pt-BR/DEVELOPMENT.md), [decisões](docs/adr/0001-foundation.md)
e [pesquisa](docs/RESEARCH.md).

## Estado do projeto

A fase 2 está **em andamento, sem aceite**. A validação local do schema Prisma e a
geração do cliente passaram. As migrações de identidade e ledger ainda precisam ser
executadas em PostgreSQL real; repositórios transacionais, fluxos HTTP autenticados,
CRUD financeiro, consultas de saldo e fluxos mobile não foram implementados. Também
faltam ciclo de email, SecureStore, biometria e recursos posteriores de faturas e
relatórios. O projeto ainda não é um serviço financeiro pronto para produção.

As alterações existentes foram commitadas por funcionalidade e publicadas em
`origin/main` em 27/10/2026, após resolver os bloqueios Git e de conexão por operações
autorizadas. Consulte o [registro da publicação](PORTFOLIO_PROGRESS.md).
A execução mais recente de `npm audit fix` removeu o alerta de `node-forge`, mas
reportou oito achados restantes no ferramental Expo (três altos e cinco baixos).
A correção automática restante exige downgrade incompatível do Expo e não foi
aplicada. A validação em banco real também segue pendente. Segredos, dados locais,
caches e arquivos gerados ficam fora do Git.
