# Checklist de segurança da aplicação

## Autenticação

- [ ] Validar credenciais no servidor.
- [ ] Proteger endpoints que exigem autenticação.
- [ ] Invalidar sessões conforme a política adotada.
- [ ] Evitar exposição de tokens em logs.

## Autorização

- [ ] Verificar propriedade de contas financeiras.
- [ ] Verificar propriedade de categorias.
- [ ] Verificar propriedade de transações.
- [ ] Impedir acesso cruzado entre usuários.

## Banco de dados

- [ ] Utilizar credenciais com privilégios mínimos.
- [ ] Separar bancos de desenvolvimento e testes.
- [ ] Proteger backups e credenciais.
- [ ] Revisar migrations antes da aplicação.

## API

- [ ] Validar entradas recebidas.
- [ ] Tratar erros sem expor informações internas.
- [ ] Revisar configurações de CORS.
- [ ] Aplicar HTTPS em produção.
- [ ] Avaliar limites de requisições.

## Dependências

- [ ] Executar verificações de vulnerabilidades.
- [ ] Revisar atualizações antes de aplicá-las.
- [ ] Não publicar segredos no repositório.

## Revisão

Este checklist não representa uma auditoria concluída.
Cada controle deve ser testado antes da publicação.
