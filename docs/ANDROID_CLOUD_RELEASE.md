# Android APK with hosted API / APK Android com API hospedada

## Estado verificado em 2026-11-04

O site usa `apps/mobile/assets/brand/web/favicon.png` em `app.json` e no cabeçalho
Web. O gerador `scripts/generate-brand-assets.mjs` deriva esse favicon, o ícone
Android e o primeiro plano adaptativo do mesmo `apps/mobile/assets/brand/mark.svg`.
O identificador existente é `com.fintrackpro.app`; preservá-lo evita trocar a
identidade de instalações anteriores. O perfil `preview` produz APK de distribuição
interna, sem Expo Go ou Metro. O ícone e o APK ainda precisam de inspeção em um
dispositivo físico após um build assinado.

The Web favicon, launcher icon, adaptive foreground, and monochrome icon already
derive from the same FinTrack brand artwork. The existing Android package is
`com.fintrackpro.app`. A native signed APK and physical-device acceptance are
still required.

## Infraestrutura necessária / Required infrastructure

1. Provisionar PostgreSQL gerenciado e uma API HTTPS em um provedor escolhido.
   Manter um banco de staging separado. Não copiar dados locais automaticamente.
2. Guardar `DATABASE_URL` no cofre de segredos do provedor. Exigir TLS e validar
   certificado conforme o provedor. Ativar backups automáticos e testar restauração
   antes de usar dados reais. Nunca colocar a URL do banco no Expo ou no Git.
3. Construir a imagem da API a partir do `Dockerfile`, com `NODE_ENV=production`,
   `HOST=0.0.0.0`, `PORT=3000` (ou porta fornecida pelo provedor) e
   `CORS_ORIGINS` contendo somente a origem Web HTTPS autorizada. Terminar TLS no
   ingresso do provedor e exigir HTTPS externamente.
4. Antes de cada deploy, conferir status das migrações, criar backup verificável
   no banco hospedado e executar `npm run db:migrate` com a `DATABASE_URL` desse
   banco. Nunca usar `migrate reset` nem testes destrutivos em produção.
5. Expor `/v1/health` para vida do processo e `/v1/health/ready` para prontidão
   do PostgreSQL. Configurar o provedor para reiniciar instâncias sem prontidão.
   Validar cadastro, login, isolamento e persistência após reinício em staging.
6. Configurar no ambiente EAS `production` a variável **pública**
   `EXPO_PUBLIC_API_URL=https://SEU_DOMINIO_REAL/v1`. Esta URL não contém segredo.
   Associar o projeto Expo e configurar assinatura Android pelo fluxo seguro EAS.

The Dockerfile provides a non-root Node process and database-aware health check.
Hosting, TLS, PostgreSQL, backups, Expo project access, and signing need provider
accounts and credentials supplied outside this repository.

## Build / Compilação

Após a API estar online e o ambiente EAS configurado, no PowerShell normal:

```powershell
$env:EXPO_PUBLIC_API_URL = 'https://SEU_DOMINIO_REAL/v1'
npm.cmd run check
npm.cmd run release:android
```

`release:android` verifica domínio HTTPS e resposta real do banco antes de chamar
`eas build --platform android --profile preview --wait`. O arquivo e o link só
existem se o EAS concluir o build. O APK deve ser instalado no dispositivo e
validado em Wi-Fi e dados móveis com o PC desligado. Testar cadastro, sessão após
reinício, dados financeiros, conexão interrompida, ícone na tela inicial e na
gaveta. A comunicação com a API precisa de internet; não há sincronização offline.

`release:android` checks the live API and PostgreSQL before starting EAS. A
successful JavaScript export is not an APK. Record the actual EAS build URL, APK
version, signing identity, and device results only after they exist.

## Bloqueios atuais / Current blockers

Nenhum domínio de API, banco ou provedor de hospedagem foi fornecido. A consulta
`eas whoami` falhou por indisponibilidade de `api.expo.dev` neste ambiente; a conta
Expo e a assinatura não foram verificadas. Nenhum APK foi gerado ou instalado.
O PostgreSQL isolado de testes na porta 5433 continua com falha de autenticação;
nenhum teste SQL destrutivo foi direcionado ao banco principal.
