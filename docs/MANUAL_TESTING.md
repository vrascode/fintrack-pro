# Checklist de testes manuais

Este documento orienta a validação funcional do FinTrack Pro.
Marque cada item somente depois de executar o teste.

## Autenticação

- [ ] Criar uma conta com dados válidos.
- [ ] Rejeitar um cadastro inválido.
- [ ] Entrar com credenciais corretas.
- [ ] Rejeitar credenciais incorretas.
- [ ] Recuperar a sessão após reiniciar o aplicativo.
- [ ] Encerrar a sessão corretamente.

## Contas financeiras

- [ ] Criar uma conta financeira.
- [ ] Consultar contas do usuário autenticado.
- [ ] Atualizar os dados de uma conta.
- [ ] Verificar isolamento entre usuários.

## Transações

- [ ] Registrar uma receita.
- [ ] Registrar uma despesa.
- [ ] Validar valores e datas.
- [ ] Editar uma transação.
- [ ] Verificar o histórico de alterações.
- [ ] Excluir logicamente uma transação.
- [ ] Confirmar atualização dos saldos.

## Interface

- [ ] Verificar layout no navegador.
- [ ] Verificar navegação em dispositivo móvel.
- [ ] Testar formulários com campos inválidos.
- [ ] Verificar mensagens de erro.
- [ ] Verificar comportamento durante falhas da API.

## Resultado

Registrar a data, o ambiente, o resultado e
eventuais problemas encontrados durante os testes.
