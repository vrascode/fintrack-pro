# FinTrack Pro: Neon + Render + Vercel + Android

Estado em 2026-11-04: esta configuração foi preparada localmente. Nenhum projeto
Neon/Render foi criado por esta entrega, nenhuma URL de API foi confirmada e
nenhum APK foi compilado. O Web publicado em
`https://fintrack-pro-murex-gamma.vercel.app` precisa de um novo build com a URL
HTTPS real da API. `EXPO_PUBLIC_API_URL` é pública no bundle; nunca use nela
segredos ou a URL do PostgreSQL.

## 1. Criar PostgreSQL no Neon

No painel Neon, criar um projeto FinTrack Pro e um banco de produção vazio.
Criar um banco/projeto de staging separado. Selecionar uma região próxima do
Render. Copiar a string de conexão **pooled** fornecida pelo Neon, incluindo
`sslmode=require` ou modo mais forte, diretamente para o segredo `DATABASE_URL`
no Render. Não registrar a string no Git, Vercel, Expo, prints ou logs.
O adaptador Prisma limita o pool da API a cinco conexões por instância e exige
TLS em `NODE_ENV=production`. O Neon fornece conexões agrupadas; antes de
aumentar instâncias ou pools, verificar os limites do plano contratado.

Ativar e verificar a recuperação disponível no plano Neon. Antes de cada
migração, obter backup verificável ou criar uma ramificação de recuperação e
testar a restauração. O período de recuperação do plano gratuito é limitado;
para finanças reais, avaliar backup externo e plano pago. Não transferir dados
locais para produção automaticamente.

Na consulta de 2026-11-04, o [preço oficial Neon](https://neon.com/pricing)
indicava Free a US$ 0 com 1 GB e 100 CU-horas mensais por projeto; Launch é
cobrado por uso. Conferir o painel antes de criar recursos, pois limites e preços
podem mudar.

## 2. Publicar a API no Render

Enviar os commits validados ao GitHub. No Render, **New > Blueprint**, conectar
`vrascode/fintrack-pro` e selecionar `render.yaml`. O Blueprint cria apenas um
serviço Web Docker. Informar `DATABASE_URL` como segredo no painel. Conferir
`NODE_ENV=production`, `HOST=0.0.0.0`,
`CORS_ORIGINS=https://fintrack-pro-murex-gamma.vercel.app` e
`WEB_SESSION_CROSS_SITE=true`. O Render define a porta; a API a lê de `PORT`.
O ingresso Render fornece HTTPS; configurar health check em
`/v1/health/ready`. Confirmar o domínio real atribuído no painel, sem adivinhar.

O plano gratuito Render suspende o serviço após 15 minutos sem tráfego e pode
levar cerca de um minuto para acordar. É adequado a avaliação, mas essa latência
e a ausência de garantia de disponibilidade não são adequadas ao uso financeiro
crítico. O plano gratuito não oferece comando pre-deploy; **não** automatizamos
migrações no início de cada processo.
O Blueprint desativa deploy automático: aplicar e verificar migrações antes do
deploy manual de cada nova versão. No primeiro uso, migrar o banco Neon vazio
antes de criar/acionar o serviço Render.

### Migrações seguras

Antes do primeiro tráfego, em terminal confiável com acesso ao banco Neon:

```powershell
# Defina DATABASE_URL na sessão por mecanismo seguro do provedor.
# Confirme o nome/host do banco e o backup antes de executar.
npm.cmd ci
npm.cmd run db:status
npm.cmd run db:migrate
npm.cmd run db:status
```

`db:migrate` usa Prisma `migrate deploy`; não usa reset nem `db push`. No banco
vazio, aplica as migrações versionadas. Em banco já usado, revisar cada SQL e o
backup antes de executar. Nunca apontar `test:integration` para produção: esse
comando exige um banco local `_test` e cria/apaga registros.

A migração `20261103230000_goal_contribution_idempotency` contém um `UPDATE` que
preenche `idempotencyKey` em contribuições já existentes. Se a produção contiver
esses registros e a migração estiver pendente, interromper o deploy e obter
autorização explícita para essa alteração de dados. Não basta um backup para
autorizar a alteração. Confirmar o estado real com `db:status` e uma inspeção
somente leitura do banco antes de decidir quais migrações executar.

No serviço publicado, verificar `GET https://DOMINIO_REAL/v1/health` e
`GET https://DOMINIO_REAL/v1/health/ready` com HTTP 200. O segundo endpoint
confirma a conexão PostgreSQL. Conferir os logs de deploy sem imprimir
`DATABASE_URL`, cookies, senhas ou tokens. Testar reinício em staging e
persistência de dados por usuários separados antes de usar produção.

## 3. Configurar Vercel

No projeto Vercel existente, verificar **Root Directory = raiz do repositório**,
Framework Preset = Other, build `npm run release:web` e saída
`apps/mobile/dist` (também definidos em `vercel.json`). Em **Settings >
Environment Variables**, definir para Production:

```text
EXPO_PUBLIC_API_URL=https://DOMINIO_REAL_DO_RENDER/v1
```

Usar o domínio HTTPS efetivamente atribuído ao Render. A URL termina em `/v1`
uma vez. Fazer um **novo deploy** após salvar a variável: bundles anteriores
não recebem mudanças de ambiente. O build agora falha se a URL estiver ausente,
local, sem HTTPS ou com caminho incorreto. Verificar `/login`, cadastro, login,
logout e restauração após recarga em navegador real. O cookie de renovação usa
`SameSite=None; Secure; HttpOnly` quando `WEB_SESSION_CROSS_SITE=true`; alguns
navegadores bloqueiam cookies de terceiros entre `vercel.app` e `onrender.com`.
Se a restauração falhar por esse motivo, configurar domínios próprios no mesmo
site ou um proxy de mesma origem e repetir o teste antes de considerar o Web
pronto para produção.
O endpoint de restauração por cookie exige `Origin` permitido. O limitador de
autenticação atual é por processo; antes de escalar para várias instâncias,
adotar armazenamento compartilhado e revisar a política de proxy confiável.

## 4. Android

No ambiente EAS `production`, definir a mesma URL pública
`EXPO_PUBLIC_API_URL`. Conectar a conta Expo e configurar assinatura Android
no fluxo seguro do EAS. Com a API e o Neon online:

```powershell
$env:EXPO_PUBLIC_API_URL = 'https://DOMINIO_REAL_DO_RENDER/v1'
npm.cmd run check
npm.cmd run release:android
```

O comando verifica `/v1/health/ready` e solicita um APK interno assinado. Só
registrar arquivo/link após a conclusão do build. Instalar em Android físico e
validar Wi-Fi, dados móveis, sessão após reinício, contas, lançamentos, contas
mensais e cartões com o PC desligado. Não há modo offline completo.

## 5. Atualizações e diagnóstico

Para uma atualização: validar em staging, revisar SQL incremental, criar backup,
aplicar migrações, publicar API, publicar Web e compilar novo APK quando código
nativo ou URL incorporada mudar. Inspecionar health, CORS, logs sem dados
sensíveis e reconexão. `P1000` indica credenciais inválidas; `P1001`, servidor
inacessível; HTTP 503 em `/health/ready`, banco não pronto. Um erro de
configuração no login indica URL ausente/inválida no bundle; erro de origem
indica CORS; erro de rede indica API inacessível ou suspensão do serviço.

Fontes consultadas em 2026-11-04: [Render Blueprint](https://render.com/docs/blueprint-spec),
[limites Render Free](https://render.com/docs/free),
[pre-deploy pago](https://render.com/docs/deploys),
[variáveis Vercel](https://vercel.com/docs/environment-variables),
[Neon com Prisma](https://neon.com/blog/better-postgres-with-prisma-experience),
[recuperação Neon](https://neon.com/blog/practical-guide-to-database-branching).

## English summary

Create separate Neon production and staging databases, set the pooled TLS URL
only in Render, review and back up before `db:migrate`, deploy the Render
Blueprint, then set the real HTTPS `/v1` API URL in Vercel and EAS and rebuild.
Validate real browser, SQL, and Android flows before using personal finances.
