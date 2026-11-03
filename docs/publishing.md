# Publish pending work / Publicar o trabalho pendente

The publisher operates only on `C:\Projetos\fintrack-pro`, branch `main`, with
the exact `vrascode/fintrack-pro` HTTPS fetch/push remote. It uses the original Git
index and configured author identity. It never creates a replacement repository,
changes permissions, stashes work, discards files or rewrites history.

O publicador trabalha no repositório original e não altera interface, READMEs,
banco, senhas, HBA, autores ou datas. Precisa de escrita Git e HTTPS disponíveis
no PowerShell normal; não usa privilégios administrativos nem modifica a política
de execução do PowerShell.

## Review the exact plan / Revisar o plano exato

The existing pending changes are assigned to **19 functional units**, including
earlier rate limiting, safe database errors, account archive/metadata, transaction
search, PostgreSQL tooling and CI. The twelve earlier proposals were reorganized
to account for their dependencies and the additional pending work. No source change
was invented to reach a count. Do not manufacture the remaining six commits.

The manifest is `scripts/publish-pending-plan.json`. Every planned working file has
a SHA256 fingerprint, except the manifest's own recursive digest. Seven complete-file
patches split the shared `apps/api/src/app.ts`, root `package.json`, browser-fixture imports and CI fixture-URL changes.
Their exact before/after digests are verified; Git additionally checks each patch
against the real index. All other changes are assigned as complete functional files.
Unknown files, changed fingerprints, unmerged paths and a pre-existing staged diff
stop publication. No fuzzy or automatic interactive hunk selection is used.

No terminal normal, primeiro revise os grupos, os novos arquivos e os patches:

```powershell
Set-Location C:\Projetos\fintrack-pro
powershell.exe -NoProfile -File .\scripts\publish-pending-commits.ps1 -ReviewOnly -ShowDiff -ValidatePlan
```

This mode performs no staging, commit, fetch or push. `-ValidatePlan` typechecks
each successive candidate in memory against Git HEAD, with installed dependency
types and generated Prisma files. Unstaged application source is excluded. No
candidate checkout or alternate Git object store is created.

O modo de revisão não grava Git. A validação monta cada candidato em memória,
sem usar alterações futuras do código da aplicação para esconder dependências
ausentes. As dependências instaladas e o Prisma gerado continuam sendo pré-requisitos.

## Publish / Publicar

After reviewing, approve exactly the current manifest digest and run:

```powershell
$planHash = (Get-FileHash -LiteralPath .\scripts\publish-pending-plan.json -Algorithm SHA256).Hash.ToLowerInvariant()
powershell.exe -NoProfile -File .\scripts\publish-pending-commits.ps1 -Publish -PlanHash $planHash
```

The script verifies branch/root/fetch and push URLs, configured Git identity,
absence of artificial date overrides and an empty index. It fetches origin, checks
the advertised hash independently and requires local HEAD, origin/main and the
remote branch to match the original plan base. A changed remote stops execution;
no merge/rebase or new plan is inferred.

Before the first commit it runs build, lint, typecheck, unit tests and formatting,
exports fresh web/Android/iOS bundles with a public fixture API URL, and runs all
desktop/mobile browser tests. Each unit then gets selective staging, secret and
fingerprint checks, exact staged TypeScript validation, staged diff review, build
and its targeted tests. A final fetch guards against concurrent remote updates.
Behavioral/build gates run in the preserved working tree; the separate candidate
TypeScript check reads the actual index and excludes future application source.
This is not a claim of isolated runtime/SQL testing of every intermediate tree.

For each real commit it immediately runs `git push origin main`, fetches again,
compares HEAD with `git ls-remote origin refs/heads/main` and checks `0 0` divergence.
Only confirmed remote equality marks a commit published. Commit-hook changes to
the reviewed tree/message stop publication before pushing; hooks are not bypassed.
The next unit starts only after confirmation of the previous one.

O fluxo é revisar → testar → commit → push → confirmar → próxima unidade. A meta
é publicar os 19 commits coerentes, sem commits vazios ou divisões artificiais.

SQL integration is **not silently treated as passing**: the configured test target
previously rejected authentication. To require current integration acceptance too,
append `-RunIntegration`; any failure stops before publication. The default does
not run database migrations, the main-database smoke, administrative recovery or
the isolated cluster helpers. It adds no synthetic user records.

## Reports and stopped runs / Relatórios e interrupções

Reports are written only under ignored `.local/publication/`, as JSON and Markdown.
They contain actual commit numbers/hashes/messages/files, tests and timestamps,
push attempts, confirmed remote hashes and failures. Secret values are not included.
CI is reported as unverified; a successful local push is not a successful Actions run.

If any command fails, all working files, staged changes and local commits remain.
No reset, unstaging, cleanup or automatic push retry occurs. Inspect the report and
fix the external condition before resuming the same immutable plan:

```powershell
powershell.exe -NoProfile -File .\scripts\publish-pending-commits.ps1 -Publish -PlanHash $planHash -ResumeReport .\.local\publication\<RUN>.json
```

A commit whose push failed is retained. Resume first verifies the recorded commit
and remote; it confirms an already accepted push or retries that pending commit
before creating anything else. Unexpected local/remote commits stop the run.

If a failure happened before commit and the index is nonempty, first inspect
`git diff --cached`. To unstage only the script's failed unit without losing its
working files, use `git restore --staged -- <the explicit unit paths>`. This is a
manual recovery step, never automated. Do not unstage unrelated user work.

If files need edits, existing fingerprints intentionally reject them. Review a new
snapshot with `node scripts/prepare-pending-plan.mjs` only after understanding any
already-created commits; this generator always uses the documented original base,
never discards work or stages files. A changed plan cannot resume an old report.
Do not use the generator to reconcile an advanced remote automatically.

## Prerequisites / Pré-requisitos

- Windows PowerShell 5.1+, Git, Node 24, npm, installed workspace dependencies and
  Microsoft Edge for the existing browser suite.
- Write access to the original `.git` and authenticated GitHub HTTPS push access.
  Read-only `ls-remote` access alone does not establish push authorization.
- Existing tests and generated Prisma artifacts. No new npm scripts or dependencies
  are required; this publisher invokes the repository's actual scripts.

If local PowerShell policy rejects script execution, follow the machine's approved
policy; this workflow does not bypass or change it. The sandbox cannot grant the
normal terminal's permissions. The UI and bilingual READMEs are preserved as supplied.
