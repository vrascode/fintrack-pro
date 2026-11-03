# Regras de integridade financeira

Este documento descreve invariantes que devem ser
verificados no código e nos testes do FinTrack Pro.

## Valores monetários

- Evitar cálculos financeiros com arredondamento impreciso.
- Validar valores antes de persistir transações.
- Não aceitar valores inválidos ou não finitos.
- Definir explicitamente as regras de arredondamento.

## Saldos

- Considerar o saldo inicial de cada conta.
- Aplicar receitas e despesas conforme seus tipos.
- Evitar duplicação de lançamentos.
- Recalcular totais após alterações financeiras.
- Não incluir transações excluídas nos totais ativos.

## Idempotência

Operações repetidas com a mesma chave de idempotência
não devem gerar lançamentos duplicados.

## Concorrência

Alterações concorrentes devem respeitar o controle
de revisão implementado pela aplicação.

## Auditoria

- Preservar informações necessárias ao histórico.
- Registrar alterações relevantes de transações.
- Garantir que usuários não acessem registros alheios.

## Verificação

Estas regras representam critérios de validação.
Sua implementação deve ser confirmada pelos testes.
