# Communication repair / Correção da comunicação

1. Confirm CORS failure, inspect existing changes and preserve occupied services.
   Centralize origin validation shared by CORS and authentication; commit with regression tests.
2. Verify Expo environment loading, API URL resolution and HTTP error handling.
   Commit only necessary client changes with behavioral tests.
3. Validate synthetic registration, login, cookie restoration and real owner-scoped
   finance in the main local PostgreSQL without deleting existing records.
   Run build, lint, typecheck, unit, integration, browser tests and doctor; report failures separately.
4. Document bilingual configuration and exact validation results; commit documentation.
   Review each staged diff; exclude all pre-existing edits, secrets and local artifacts.

Confirmar o CORS, corrigir a política compartilhada, verificar cliente/ambiente,
validar autenticação e finanças reais e documentar resultados em commits coerentes.
Preservar os serviços existentes e todos os dados. Não recuperar senhas administrativas,
alterar HBA ou executar reset. Publicar somente se autenticação e permissões permitirem.

Local implementation and main-database browser acceptance are complete. Test-database
integration, Git writes and publication remain blocked by the environment.
See [validation](validation-2026-11-02.md) and [commit units](../COMMITS.md).

Implementação local e aceite real concluídos; integração do banco de testes e
publicação permanecem pendentes pelos bloqueios documentados.
