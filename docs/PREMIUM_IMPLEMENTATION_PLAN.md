# FinTrack Pro premium implementation plan / Plano de implementação premium

Date / Data: 2026-11-03

## Boundaries / Limites

1. **Budget foundation / Base de orçamentos:** additive table and migration, owner-scoped API, exact-cent spent calculation, tests. One coherent commit if Git writes become available.
2. **Budget experience / Experiência de orçamentos:** personal screen, dashboard connection and navigation, browser tests. One commit.
3. **Goals / Metas:** virtual goal and contribution tables, owner-scoped API, personal screen and tests. Split API and UI commits when each is validated.
4. **Reports and dashboard / Relatórios e dashboard:** derive reports and charts from posted transactions; improve explanation of balance versus monthly result, category drilldown and responsive states. Separate commits by working flow.
5. **Acceptance / Aceite:** run unit, lint, typecheck, export, browser tests and isolated PostgreSQL tests where credentials permit; record actual results and blockers. Push each validated commit only if Git/network access permits.

## Initial evidence / Evidência inicial

- Clean `main`, cached `origin/main...main` at `0 0`; `git fetch origin` denied writing `.git/FETCH_HEAD`, so live remote synchronization is unverified.
- `npm.cmd test` 121/121, `npm.cmd run lint` and `npm.cmd run typecheck` passed.
- `npm.cmd run doctor` found application PostgreSQL ready and isolated test credentials rejected (`28P01`). No database mutation was performed during audit.
- Prisma has persisted users, accounts, categories and transactions; budgets and goals exist only in shared/demo code. Card screen explicitly says under development.

## Product research / Pesquisa de produto

Observed from primary product documentation on 2026-11-03: [Copilot dashboard](https://help.copilot.money/en/articles/6045480-dashboard-tab-overview) emphasizes monthly spending progress and budget remaining; [Monarch tracking](https://www.monarchmoney.com/features/tracking) emphasizes a consolidated view and drilldown reports; [YNAB basics](https://support.ynab.com/en_us/getting-started-ynab-basics-and-key-terms-BJCaIHaTZe) distinguishes money available in a category from account balances. FinTrack Pro will keep cash balance, monthly result and optional budget remaining visibly distinct. These are design references, not evidence that FinTrack already provides their features.
