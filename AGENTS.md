# FinTrack Pro — Git e commits

Estas instruções complementam o `C:\Projetos\AGENTS.md` e aplicam-se somente
ao repositório FinTrack Pro. Em caso de conflito, siga as instruções do usuário
e as instruções superiores aplicáveis.

## Organização do trabalho

- Antes de editar, leia estas instruções e as instruções superiores aplicáveis;
  confira o estado e a raiz do Git, examine o diff e preserve alterações que já
  existiam.
- Em tarefas grandes, registre um plano curto com etapas e limites de commits.
  Implemente, valide e crie commits durante o trabalho, conforme cada unidade
  estiver completa, em vez de acumular tudo em um commit final genérico.
- Use commits pequenos, profissionais e coerentes. Cada commit deve representar
  uma unidade funcional revisável; inclua os vários arquivos que dependam uns
  dos outros para concluir essa unidade.
- Em tarefas grandes, considere uma faixa de 10 a 20 commits significativos ou
  mais quando o trabalho real justificar. Em tarefas menores, crie somente os
  commits que façam sentido. Nunca divida mudanças artificialmente para atingir
  uma quantidade, nem crie commits vazios.
- Revise o diff e selecione somente os arquivos ou trechos da etapa. Não use
  `git add .` indiscriminadamente. Não inclua credenciais, arquivos `.env`,
  dependências instaladas ou artefatos temporários.
- Execute as verificações adequadas antes de cada commit e não declare como
  aprovadas verificações que não foram executadas.

## Mensagens e histórico

- Use Conventional Commits com descrição específica em português; acrescente
  escopo quando útil. Exemplos:
  - `feat(theme): adicionar temas claro e escuro persistentes`
  - `fix(transactions): preservar filtros após editar lançamento`
  - `test(accounts): cobrir saldos iniciais inválidos`
  - `docs(setup): documentar configuração do banco local`
- Evite mensagens vagas como `updates`, `changes`, `ajustes` ou `final`.
- Use datas e horários reais. Não backdate commits, não crie esperas artificiais
  e não reescreva o histórico para simular uma rotina de desenvolvimento.
- Commits locais não garantem contribuições no gráfico do GitHub; não prometa
  contagens de contribuição.
- Não faça push sem autorização explícita nesta tarefa ou uma instrução aplicável
  que já autorize a publicação. Commits locais não concedem autorização para
  publicar.

## Encerramento

Ao concluir, informe os commits criados, as verificações executadas e as
pendências reais. Se não houver commit por uma razão concreta, informe isso.
