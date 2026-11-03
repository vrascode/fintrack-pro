# Recovery approval plan / Plano para autorização da recuperação

Status: prepared, **not executed**. No credential, HBA, service, ACL or database
was changed. No old password was retried. Existing pending changes and the four
published commits through `22f7e30` are preserved.

## Observed facts / Fatos observados

| Service           | State   | Data directory                      |
| ----------------- | ------- | ----------------------------------- |
| postgresql-x64-17 | Running | C:\Program Files\PostgreSQL\17\data |
| postgresql-x64-18 | Running | C:\Program Files\PostgreSQL\18\data |

At inspection time, netstat showed listeners on 5432 (PID 8428) and 5433 (PID 9104).
Service-control PIDs were 6744 and 6668; those are service wrapper processes,
not necessarily listener PIDs. **Do not equate service version with port yet.**
CIM/TCP queries and data-directory reads are denied to the sandbox identity.
Use the read-only inspector below to correlate service → child process → PID
file → listener and report the effective HBA path and authentication methods.
PIDs can change; they must be checked again at execution time.

Git: no `.git/index.lock` exists and no Git process was observed. The index is
not read-only by its file attribute. `.git` ACL explicitly denies write/delete
to restricted SIDs; this session also grants only read access to `.git`.
This is a sandbox/permission boundary implemented through Windows ACLs, not a
stale lock. Do not delete locks, change ownership or remove deny entries.

## Step 1 — read-only elevated inspection / Inspeção elevada somente leitura

Open PowerShell using **Run as administrator**, then execute:

```powershell
Set-Location C:\Projetos\fintrack-pro
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\inspect-local-blockers.ps1
```

RemoteSigned above applies only to the child process, not global Windows policy;
if organization policy blocks it, stop and use the approved local execution method.
The inspector never loads `.env`, attempts SQL login or changes authentication,
ACLs, files or services. It outputs only service/PID/path/method/ACL metadata.
Raw HBA contents are omitted because some authentication options can hold secrets.
Its PowerShell syntax was validated, but privileged runtime results are pending.

A legitimate alternative may already exist: a still-open authorized pgAdmin SQL
session, or a configured SSPI/certificate/mapped administrator login. Review the
inspector's methods and any applicable includes/user maps locally. A method name
alone does not establish that your Windows identity is mapped to an administrator.
Do not change HBA to invent such access or search/export saved passwords.
An existing authorized SQL session can inspect `current_user` and superuser status
without retrying the forgotten password. No such access has been confirmed here.

## Step 2 — proposed scope requiring explicit approval / Escopo proposto

Only if inspection proves PostgreSQL 17 owns **5432**, the reviewed helper
`scripts/recover-postgres-admin.mjs` can recover its `postgres` role interactively.
It deliberately refuses other ports, data/HBA paths and service/PID mismatches.
It cannot recover PostgreSQL 18 or 5433, and must not be repointed blindly.

Affected resources:

- PostgreSQL 17's effective `pg_hba.conf`, expected at
  `C:\Program Files\PostgreSQL\17\data\pg_hba.conf`, changed temporarily in place.
- Local ignored `.local\postgres17-recovery-*`: byte-exact backup, SHA-256,
  recovery state and restoration marker; keep these local.
- `postgres` password verifier in the **17 cluster's system catalog**, affecting
  subsequent password logins for this role across that cluster. Clients using
  the old admin password will need their own credentials updated locally.
- A psql process and restoration watchdog; no service stop/restart is planned.

The helper briefly prepends **only**:

```text
host postgres postgres 127.0.0.1/32 trust
```

This is an administrative bypass for a short local recovery window, not a final
configuration. Other local processes could connect as `postgres` during that
window, so perform it on a controlled workstation without concurrent recovery
or HBA edits. Do not authorize this approach if that temporary exposure is not
acceptable; an offline recovery would require a separate reviewed downtime plan.

After psql connects, Node restores the original bytes, and PostgreSQL independently
checks the SHA-256 of the effective HBA **before** any password change. A mismatch
aborts. Then psql `\password postgres` collects the new secret with hidden input,
using SCRAM; no plaintext password enters Node, arguments, SQL history or scripts.
Finally it tests one password connection with the newly entered secret.

Restoration also runs in `finally`, with an independent 30-second watchdog if the
parent fails before restoration. These safeguards do not survive a whole-machine
power failure. Keep the printed backup directory; if interrupted, restore the
original HBA and verify its checksum before resuming use. Do not leave trust active.
No existing database, table, migration, application user or financial row is deleted.
No global Windows security policy/ACL change or PostgreSQL 18 change is proposed.

## Step 3 — commands reserved until approval / Comandos após autorização

The first command below is still read-only. **Do not run the second command until
the above scope has been explicitly authorized and instance mapping is confirmed.**

```powershell
Set-Location C:\Projetos\fintrack-pro
node scripts/recover-postgres-admin.mjs --inspect
# Only after approval and a matching inspection:
node scripts/recover-postgres-admin.mjs
```

Use elevated interactive PowerShell. Choose and save the new admin secret in your
local password manager; never put it in `.env`, chat, arguments or GitHub. Recovery
prompts twice for the new password and once more to verify password authentication.
If it aborts, keep the message and backup path; never retry the forgotten password.

Emergency restoration uses the exact state path printed by that run, not an
arbitrary/older backup. Inspect that state/backup provenance locally first:

```powershell
node scripts/recover-postgres-admin.mjs --restore '<printed recovery directory>\state.json'
```

## Step 4 — application credentials and acceptance / Aplicação e aceite

After successful admin recovery, audit the dedicated development role first:

```powershell
node scripts/setup-local-postgres.mjs --development --audit
```

Configure a separate application secret only in ignored `.env`. Provision absent
dedicated resources with `--development`; use `--reconcile-password` only if you
choose to align the existing isolated application role to that local secret.
The helper refuses privileged/shared roles and another database owner.

Treat 5433 separately: identify its actual instance, then audit with a legitimate
admin credential for that instance. Recovery of PostgreSQL 17 does not recover
another cluster's password. If that password is also unavailable, prepare and
approve a separate instance-specific recovery; do not reuse the 17/5432 helper.
See [local credential configuration](postgresql-local-credentials.md).

Only after both URLs authenticate, run doctor, versioned migrations/status,
integration and real browser acceptance. Restart existing API processes after
`.env` changes so old pools do not keep invalid credentials. The project remains
incomplete until real local registration, login, sessions and finance pass.

## Git resolution / Solução Git

Use a normal terminal under the repository owner's Windows account, outside this
restricted tool identity. First confirm identity, worktree and ACLs:

```powershell
Set-Location C:\Projetos\fintrack-pro
whoami
git status --short
icacls.exe .git
```

If normal Git succeeds there, no repository repair or ACL change is needed.
To let the agent commit, an execution environment that explicitly permits Git
metadata writes is required; this session cannot grant itself that access.
If the normal owner also fails, inspect that owner's effective permissions before
any ACL repair. Do not disable security or remove sandbox deny rules.
Pending changes must be reviewed, tested and staged by coherent file/hunk groups;
do not use `git add .`, reset, force push or synthetic commits.

## Sources reviewed / Fontes consultadas

Official PostgreSQL 17 documentation, consulted 2026-10-31:

- [Windows HBA behavior and matching rules](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html)
- [psql password handling](https://www.postgresql.org/docs/17/app-psql.html)
- [Authentication methods including SSPI](https://www.postgresql.org/docs/17/auth-methods.html)
- [Offline single-user recovery mode](https://www.postgresql.org/docs/17/app-postgres.html)

Single-user mode is an alternative requiring exclusive data-directory access and
a separate service-stop/restart plan; it is not authorized or scheduled here.
