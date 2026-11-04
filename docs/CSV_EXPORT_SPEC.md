# Exportacao CSV

Definir formato de exportacao de transacoes.

## Criterios de verificacao

- [ ] Definir cabecalhos das colunas
- [ ] Preservar datas e valores monetarios
- [ ] Utilizar codificacao UTF-8
- [ ] Escapar campos com separadores
- [x] Proteger contra formula injection em planilhas nos dois exportadores CSV (teste unitário em 2026-11-04)
- [ ] Exportar apenas dados autorizados

## Evidencias

Registrar ambiente, data, resultado dos testes
e referencias para as alteracoes implementadas.

## Estado

Este documento define criterios de verificacao.
Itens nao marcados ainda precisam ser validados. O teste unitário valida o texto
gerado; abertura em programas de planilha distintos permanece pendente.
