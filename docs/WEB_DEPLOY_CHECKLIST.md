# Checklist de deploy Web

## Ambiente

- [ ] Selecionar plataforma de hospedagem.
- [ ] Configurar variáveis de ambiente necessárias.
- [ ] Definir URL pública da API.
- [ ] Confirmar que a API utiliza HTTPS.
- [ ] Revisar política de CORS.

## Build

- [ ] Executar verificação de tipos.
- [ ] Executar lint e testes.
- [ ] Gerar build de produção.
- [ ] Verificar referências a localhost.
- [ ] Validar arquivos estáticos.

## Funcionalidades

- [ ] Testar cadastro e login.
- [ ] Confirmar persistência dos dados.
- [ ] Validar criação e edição de transações.
- [ ] Verificar isolamento entre usuários.
- [ ] Testar navegação em diferentes telas.

## Segurança e operação

- [ ] Proteger credenciais e tokens.
- [ ] Revisar cabeçalhos de segurança.
- [ ] Configurar observabilidade de erros.
- [ ] Definir procedimento de rollback.
- [ ] Documentar a versão publicada.

## Estado

A publicação deve ser confirmada por uma URL
funcional e por testes no ambiente de produção.
