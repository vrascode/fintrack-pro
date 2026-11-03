# Executando o FinTrack Pro no Windows

## Preparação

Instale as ferramentas necessárias:

- Git
- Node.js e npm
- PostgreSQL 17
- Visual Studio Code

## Abrir o projeto

No PowerShell:

```powershell
cd C:\Projetos\fintrack-pro
```

## Instalar dependências

```powershell
npm.cmd install
```

## Configurar o ambiente

Consulte `.env.example` para identificar as variáveis
necessárias.

Configure a conexão com PostgreSQL e utilize
credenciais locais, sem publicá-las no GitHub.

## Executar a aplicação

Consulte os scripts disponíveis no projeto:

```powershell
npm.cmd run
```

Para iniciar o Expo no diretório mobile:

```powershell
cd apps/mobile
npx.cmd expo start --clear
```

O aplicativo poderá ser aberto no navegador ou
em um dispositivo compatível, dependendo da
configuração do ambiente.

## Verificar qualidade

Na raiz do repositório:

```powershell
npm.cmd run check
```

## Solução de problemas

### npm.ps1 bloqueado

No PowerShell, utilize `npm.cmd` e `npx.cmd`
para executar os comandos sem depender do
arquivo npm.ps1.

### PostgreSQL indisponível

Verifique se o serviço está iniciado e se
as credenciais da aplicação estão corretas.

### Porta ocupada

Verifique os processos que utilizam a porta
e configure uma porta alternativa, se necessário.

## Segurança

Não publique arquivos `.env`, senhas,
tokens de autenticação ou backups contendo
dados pessoais.
