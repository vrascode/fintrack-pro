# Checklist de configuração do PostgreSQL

## Desenvolvimento

- [ ] Confirmar que o serviço PostgreSQL está ativo.
- [ ] Configurar DATABASE_URL no arquivo .env local.
- [ ] Validar as credenciais da aplicação.
- [ ] Verificar as migrations do Prisma.
- [ ] Confirmar conexão da API com o banco.

## Testes

- [ ] Utilizar banco separado do desenvolvimento.
- [ ] Configurar TEST_DATABASE_URL.
- [ ] Verificar permissões do usuário de testes.
- [ ] Executar os testes de integração.
- [ ] Garantir que testes não alterem dados pessoais.

## Segurança

- Nunca publicar senhas ou arquivos .env.
- Não utilizar contas administrativas na aplicação.
- Não executar migrations destrutivas sem backup.
- Manter as credenciais de produção separadas.

## Validação

Execute os scripts de validação de banco definidos no package.json.
Consulte DATABASE.md para os detalhes do projeto.
