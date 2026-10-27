# FinTrack Pro

**Aplicativo de finanças pessoais desenvolvido com Expo, React Native, TypeScript e NestJS.**

[English](README.md) · [Roteiro](ROADMAP.md) · [Registro de validação](PORTFOLIO_PROGRESS.md)

O FinTrack Pro está sendo desenvolvido para dispositivos móveis, com contratos
compartilhados, cálculos monetários exatos e limites explícitos de segurança. O app
atual oferece navegação e preferências funcionais. A fase 2 começou com o modelo
de identidade e primitivas de segurança testadas; login com persistência em banco
e operações financeiras ainda não estão disponíveis.

## O que funciona hoje

| Área                 | Comportamento implementado                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App                  | Abas de visão geral, movimentações, contas, cartões e ajustes; layouts responsivos e estados vazios explícitos                                                |
| Preferências         | Tema claro/escuro/automático, privacidade, persistência, recuperação de corrupção e tratamento de falhas                                                      |
| Domínio              | Dinheiro em inteiros exatos, datas civis validadas e contratos Zod compartilhados                                                                             |
| API                  | NestJS `GET /v1/health`, loopback por padrão, somente saúde do processo                                                                                       |
| Núcleo de identidade | Derivação/verificação de senha, tokens opacos, expiração, rotação/reutilização e transições de revogação por dispositivo, testadas independentemente do banco |
| Preparação do banco  | Configuração PostgreSQL no Compose, schema Prisma 7, migração SQL inicial e suíte para banco real; execução ainda bloqueada                                   |

O núcleo de identidade ainda não está conectado ao HTTP nem à persistência.
Nenhum banco simulado é usado para declarar integração. Veja a
[configuração do banco e pendências](DATABASE.md).

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

E2E exige bundle atualizado e Microsoft Edge instalado, inicia seu próprio servidor
na porta 4173 e o encerra ao final. Preview manual: `node scripts/serve.mjs`.
Exports e testes de navegador não validam funcionamento nativo, biometria nem
assinatura de releases.

Siga [DATABASE.md](DATABASE.md): instale as dependências Prisma ainda ausentes,
configure bancos distintos de desenvolvimento/teste e execute:

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

A fase 2 está **em andamento, sem aceite**. Faltam instalar Prisma e validar as
migrações, implementar o repositório transacional, cadastro/login HTTP, verificação
e recuperação por email, exclusão de conta, SecureStore e biometria. Operações
financeiras, faturas, relatórios, notificações e IA pertencem às fases seguintes.
O projeto ainda não é um serviço financeiro pronto para produção.

O ambiente atual não acessa npm/GitHub pelo terminal nem permite gravar metadados
Git. A nova auditoria npm não foi concluída; alertas transitivos do Expo continuam
em revisão. Não se afirma nova correção de dependências, integração com banco,
commit ou push. Segredos, dados locais, caches e arquivos gerados ficam fora do Git.
