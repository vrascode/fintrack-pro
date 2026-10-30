# Security / Segurança

The foundation exposes only process liveness on loopback by default. There are no
identity, financial-write or upload endpoints. Mobile preferences are non-sensitive
and schema-validated; tokens must never enter AsyncStorage.

A fundação expõe apenas saúde do processo, em loopback por padrão. Não há endpoints
de identidade, movimentação ou upload. Preferências são não sensíveis e validadas;
tokens nunca devem ser gravados no AsyncStorage.

## Identity core — 2026-10-27 / Núcleo de identidade

Server-only primitives are implemented and locally tested; they are not exposed
as HTTP authentication or connected to a database yet.

- Passwords: asynchronous scrypt (`N=131072`, `r=8`, `p=1`), random 16-byte salts,
  32-byte derived keys and constant-time comparison. The default hasher allows two
  concurrent derivations and rejects excess work without an unbounded queue.
- Inputs: 15–128 Unicode code points, preserved exactly; strict identity objects,
  normalized email and no client-supplied owner/role. Missing users perform dummy
  scrypt work. Stored hashes cannot select arbitrary work factors.
- Tokens: 32 random bytes, canonical base64url, purpose-specific prefixes and
  SHA-256 digests. Persist digests, never bearer credentials. SHA-256 here protects
  random high-entropy tokens; passwords use scrypt.
- Session transitions: 15-minute access, 7-day idle and 30-day absolute expiry,
  refresh rotation, consumed-token replay detection, idempotent device revocation.
  These are pure transitions; persistence, locking and HTTP authorization are pending.

The scrypt configuration follows the fallback described in the
[OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
consulted 2026-10-27. Before mounting auth routes, add transactional PostgreSQL
storage, per-account/IP throttling, bounded request bodies, generic errors, TLS,
secret-redacted logging, email flows and native secure storage. Use one shared
hasher per process: its concurrency cap is not a distributed rate limiter.

O núcleo foi implementado e testado localmente, sem endpoints de autenticação.
Senhas usam scrypt com salt aleatório e comparação em tempo constante; tokens
aleatórios guardam apenas hashes. Expiração, rotação, reutilização e revogação
foram testadas como transições. Banco, transações, limites por conta/IP, HTTP,
email e armazenamento nativo ainda são necessários. O limite do hasher vale por
instância e não substitui rate limiting distribuído.

## Current dependency review — 2026-10-27 / Revisão atual

`npm.cmd audit --json --fetch-retries=0 --fetch-timeout=15000` failed to reach npm.
No fresh vulnerability count or clean audit is claimed. Dependency versions and
the lockfile were preserved; installing Prisma failed with EACCES before a change.
No forced major override or Expo downgrade was applied.

Installed versions were rechecked with `npm.cmd ls multer node-forge zod --all`.
Advisory pages were consulted separately on 2026-10-27; this is not a full npm audit:

| Package    | Installed / Instalado                          | Advisory assessment / Avaliação                                                                                                                                      |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| multer     | 2.5.0 (existing override)                      | Meets the patched version for [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m) / Correção existente preservada                               |
| node-forge | 1.4.0 in Expo tooling                          | Affected; advisory lists no patched version / Afetado, sem versão corrigida listada: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)        |
| zod        | 3.25.76 in Expo CLI; 4.6.7 in shared contracts | CLI version affected; app version exceeds 4.6.6 patch / CLI afetado, app acima da correção: [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |

A auditoria npm atual falhou por conexão. A conferência das versões e dos avisos
confirma os limites acima, mas não substitui auditoria completa. O lockfile não
mudou; nenhuma correção nova de dependência foi instalada. A revisão segue aberta.

## Historical dependency review — 2026-10-26

Publication is suspended. The current `npm.cmd audit --json` attempt failed to
reach the registry advisory endpoint; it did not produce a passing audit. The
previous local report contains eight high findings before the multer override.
The existing notes below describe the subsequent dependency changes, but the
reported reduction to five findings could not be independently revalidated in
this run. Installed versions were checked with `npm.cmd ls multer node-forge zod
--all`. Resolve or explicitly assess the findings with a fresh audit before push.

Publicação suspensa: a auditoria atual falhou ao acessar o registro npm. O relatório
local anterior contém oito alertas altos, antes do override de multer. As notas
abaixo descrevem as mudanças anteriores; a redução relatada para cinco alertas
não foi revalidada nesta execução. As versões instaladas foram conferidas, mas
isso não substitui uma nova auditoria e avaliação dos alertas antes do push.

`npm audit` initially reported eight high findings. The NestJS Express adapter
pinned multer 2.4.0. A scoped root override and `npm update multer` installed 2.5.0,
removing that advisory and two dependent findings. Recheck the override when NestJS
updates its dependency. [Multer advisory](https://github.com/advisories/GHSA-q7qp-rjg7-q26m).

The previous review recorded five remaining high findings in Expo development tooling (two underlying advisories
and three dependent package findings): node-forge 1.4.0 and Zod 3.25.76 used by
`@expo/cli`. At inspection, node-forge's latest published version was 1.4.0 and
Zod 3's was 3.25.76. The application uses Zod 4.6.7. Do not force a major Zod
override into CLI code or downgrade Expo solely to silence the audit.
[Forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv),
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

No Expo update signing, untrusted certificate verification or public dev server is
configured. This limits the current exposure; it does not resolve the advisories.
Release/signing readiness remains open until dependency remediation and review.
Keep dev servers local and reevaluate the advisories before adding remote workflows.

A auditoria começou com oito alertas altos. O override de multer 2.5.0 corrigiu
três alertas da cadeia NestJS segundo a revisão anterior, que registrou cinco
alertas restantes no ferramental Expo, originados
em node-forge e Zod 3; o aplicativo usa Zod 4.6.7. Não há assinatura de atualizações
nem servidor público de desenvolvimento configurados. Essa limitação de exposição
não elimina as vulnerabilidades. Reavaliar antes de preparar assinatura/publicação.

## Dependency audit — 2026-10-29

`npm audit fix` updated compatible dependencies and removed the `node-forge`
advisory. Its final audit report still lists eight Expo-tooling findings: three
high and five low. The remaining issues trace to Expo's transitive `deepmerge`
and Zod 3 dependencies; the application itself uses Zod 4.6.7. npm only offers
an automatic fix that downgrades Expo to 54.0.38, a breaking major change, so it
was not applied. Do not treat the dependency audit as clean; assess a compatible
Expo upgrade path before release. A subsequent direct audit request could not
reach the registry, so this count is the report emitted by `npm audit fix`.

## Auditoria de dependências — 29/10/2026

`npm audit fix` atualizou dependências compatíveis e removeu o alerta de
`node-forge`. O relatório final ainda lista oito achados no ferramental Expo:
três altos e cinco baixos. As ocorrências restantes vêm das dependências
transitivas `deepmerge` e Zod 3 do Expo; o aplicativo usa Zod 4.6.7. O npm só
oferece uma correção automática que reduz o Expo para a versão incompatível
54.0.38, uma mudança major, então ela não foi aplicada. A auditoria não está
limpa; avaliar uma atualização compatível do Expo antes do release. Uma tentativa
posterior de consulta direta não alcançou o registro; a contagem acima é do
relatório emitido por `npm audit fix`.

## Next boundaries / Próximos limites

Identity requires expiring single-use verification/recovery tokens, password
hashing, rotating/revocable refresh sessions, rate limits, explicit ownership,
SecureStore and device validation. Financial operations require transaction-level
authorization and atomicity; exports/AI need explicit minimization and consent.

Identidade exige expiração e uso único de tokens, derivação de senha, rotação e
revogação de sessões, limites de tentativas, SecureStore e testes em aparelho.
Operações exigem autorização e atomicidade; exportação/IA exigem minimização e consentimento.

## Source and sensitive-file inspection / Inspeção de arquivos sensíveis

The 2026-10-26 review covered all 56 tracked/untracked non-ignored files and the
49 file contents in the existing commit. Pattern checks and manual review found
no credentials, private keys, tokens, personal contacts, personal directory paths
or financial exports in that scope. `.env.example` contains loopback host/port
only; `.npmrc` contains cache/install preferences, without authentication. Git
ignores local environments, dependencies, caches, bundles and test outputs.
This limited source review is not a substitute for dependency auditing or a
dedicated secret scanner; gitleaks is unavailable in this environment.

A inspeção cobriu os 56 arquivos versionados/novos não ignorados e o conteúdo dos
49 arquivos do commit existente. Não foram identificados segredos, contatos
pessoais ou exportações financeiras nesse escopo. `.env.example` contém apenas
host/porta locais, e `.npmrc` não contém autenticação. Ambientes locais, caches,
dependências e resultados gerados estão ignorados. A revisão por padrões e
inspeção manual não substitui auditoria de dependências nem scanner especializado.
