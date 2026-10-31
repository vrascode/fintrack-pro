# Local persistence implementation — 2026-10-31

Existing registration, password hashing, session rotation, owner-scoped ledger,
onboarding and real PostgreSQL acceptance must be reused. Preserve pre-existing
changes in package.json, recovery scripts/tests and tsconfig.json.

Commit boundaries, each after relevant validation:

1. Diagnose environment safely and orchestrate API/web startup without duplicates.
2. Bound database/request timeouts and report unavailable infrastructure clearly.
3. Add missing authenticated identity and native refresh endpoints.
4. Validate restored sessions and renew active sessions through existing rotation.
5. Add bounded authentication abuse protection.
6. Complete registration confirmation and premium lime/graphite login preferences.
7. Complete account editing/archive and owner-scoped validation where feasible.
8. Extend real PostgreSQL/browser coverage and CI, then update bilingual runbooks.

Target 20–30 commits only if actual independent changes justify it. Do not split
working units artificially. Local 5432/5433 both reject configured credentials
(28P01); do not reset administrative credentials or alter HBA. Await secure local
credential provisioning while validating independent work on isolated PostgreSQL.
