# Referência de funcionalidades da API

## Autenticação

Responsável pelo cadastro, login, renovação de sessão,
logout e proteção de recursos autenticados.

## Contas financeiras

Gerencia criação, consulta, atualização e arquivamento
de contas pertencentes ao usuário autenticado.

## Categorias

Organiza receitas e despesas por categoria,
respeitando o isolamento entre usuários.

## Transações

Gerencia receitas, despesas e transferências.

Inclui validação de valores monetários, datas,
idempotência, edição com controle de revisão,
exclusão lógica e histórico de alterações.

## Segurança

- Autenticação obrigatória para dados pessoais.
- Verificação de propriedade dos recursos.
- Validação de entradas.
- Tratamento seguro de erros.
- Proteção contra alterações concorrentes.

## Documentação das rotas

Os caminhos HTTP, métodos e formatos de resposta
devem ser consultados nos controllers e contratos
existentes em apps/api/src.

Este documento descreve responsabilidades,
não substitui a especificação das rotas.
