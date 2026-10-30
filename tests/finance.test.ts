import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFinancialScenario,
  calculateAccountBalance,
  calculateDailyProjection,
  calculateGoalPlan,
  calculateMonthlySummary,
  calculateObligationRemaining,
  calculateReserveTargets,
  createDemoDataset,
  financialDatasetSchema,
} from '@fintrack/shared';

const cents = (value: bigint | null) => value?.toString() ?? null;

test('demonstration fixture computes the stated monthly budget with exact cents', () => {
  const demo = createDemoDataset();
  const summary = calculateMonthlySummary(demo, demo.referenceMonth, demo.asOfDate);
  assert.equal(summary.expenseBudgetCents, 420000n);
  assert.equal(summary.plannedSurplusCents, 80000n);
  assert.equal(summary.plannedExpenseRatioBps, 8400n);
  assert.equal(summary.plannedSurplusRatioBps, 1600n);
  assert.equal(summary.incomeReceivedCents, 500000n);
  assert.equal(summary.expensesPaidCents, 366000n);
  assert.equal(summary.obligationsRemainingCents, 54000n);
  assert.equal(summary.overdueObligationsCents, 10000n);
  assert.equal(summary.balanceAvailableCents, 734000n);
  assert.equal(summary.balanceProjectedCents, 680000n);
  assert.equal(summary.reservedCents, 350000n);
  assert.equal(summary.freeAfterCommitmentsCents, 330000n);
  assert.equal(summary.plannedEnvelopeContributionsCents, 70000n);
  assert.equal(summary.plannedFreeAfterGoalsCents, 10000n);
  assert.equal(summary.plannedUnallocatedCents, 0n);
  assert.equal(demo.isDemo, true);
  assert.equal(demo.demoLabel, 'fictional');
  assert.equal(new Set(demo.transactions.map(({ date }) => date.slice(0, 7))).size, 7);
});

test('demo reserve selection excludes nonessential categories and calculates 3 and 6 months', () => {
  const demo = createDemoDataset();
  const selected = demo.categories
    .filter((category) => category.essentialForReserve)
    .map(({ id }) => id);
  const targets = calculateReserveTargets(demo.categories, demo.monthlyBudget, selected);
  assert.equal(targets.essentialMonthlyCents, 336000n);
  assert.equal(targets.threeMonthTargetCents, 1008000n);
  assert.equal(targets.sixMonthTargetCents, 2016000n);
  assert.equal(selected.includes('leisure'), false);
});

test('account balances respect opening dates, status and transfer conservation', () => {
  const demo = createDemoDataset();
  const original = demo.accounts[0];
  assert.ok(original);
  assert.equal(calculateAccountBalance(original, demo.transactions, demo.asOfDate), 734000n);
  assert.throws(
    () => calculateAccountBalance(original, demo.transactions, '2026-04-30'),
    /unknown/i,
  );

  const second = { ...original, id: 'savings', name: 'Savings' };
  const transfer = {
    id: 'demo-transfer',
    kind: 'transfer' as const,
    amountCents: '10000',
    date: demo.asOfDate,
    status: 'posted' as const,
    accountId: original.id,
    transferAccountId: second.id,
    description: 'Own-account transfer',
  };
  const withTransfer = financialDatasetSchema.parse({
    ...demo,
    accounts: [...demo.accounts, second],
    transactions: [...demo.transactions, transfer],
  });
  const from = calculateAccountBalance(original, withTransfer.transactions, demo.asOfDate);
  const to = calculateAccountBalance(second, withTransfer.transactions, demo.asOfDate);
  assert.equal(from, 724000n);
  assert.equal(to, 210000n);
  assert.equal(from + to, 934000n);
  assert.equal(734000n + 200000n, from + to);
});

test('partial obligation payment reduces cash and remaining debt once in projection', () => {
  const demo = createDemoDataset();
  const water = demo.obligations.find(({ id }) => id === `water-${demo.referenceMonth}`);
  assert.ok(water);
  const payment = {
    id: 'partial-water-payment',
    kind: 'expense' as const,
    amountCents: '4000',
    date: demo.asOfDate,
    status: 'posted' as const,
    accountId: 'checking',
    categoryId: 'water',
    obligationId: water.id,
    description: 'Partial water payment',
  };
  const updated = financialDatasetSchema.parse({
    ...demo,
    transactions: [...demo.transactions, payment],
  });
  assert.equal(calculateObligationRemaining(water, updated.transactions, demo.asOfDate), 6000n);
  const before = calculateMonthlySummary(demo, demo.referenceMonth, demo.asOfDate);
  const after = calculateMonthlySummary(updated, updated.referenceMonth, updated.asOfDate);
  assert.equal(before.balanceProjectedCents, 680000n);
  assert.equal(after.balanceProjectedCents, 680000n);
  assert.equal(after.expensesPaidCents, 370000n);
});

test('daily projection marks overdue dues and finishes at the month-end projection', () => {
  const demo = createDemoDataset();
  const points = calculateDailyProjection(demo, demo.referenceMonth, demo.asOfDate);
  assert.equal(points[0]?.balanceCents, 734000n);
  assert.equal(points[1]?.date, demo.asOfDate);
  assert.deepEqual(points[1]?.eventLabels, ['Water']);
  assert.deepEqual(
    points.slice(2).map(({ date }) => date),
    ['2026-10-25', '2026-10-28', '2026-10-30'],
  );
  assert.equal(points.at(-1)?.balanceCents, 680000n);
});

test('goal plans and scenarios use exact integer amounts and explicit inputs', () => {
  const reserve = calculateGoalPlan(600000n, 0n, 50000n, 12);
  assert.equal(reserve.remainingCents, 600000n);
  assert.equal(reserve.estimatedMonths, 12);
  assert.equal(reserve.contributionNeededCents, 50000n);
  assert.equal(cents(reserve.progressBps), '0');

  const surplus = { incomeCents: 500000n, expenseCents: 420000n };
  assert.deepEqual(applyFinancialScenario('reduce-subscriptions', surplus), {
    incomeCents: 500000n,
    expenseCents: 417000n,
  });
  assert.deepEqual(applyFinancialScenario('reduce-groceries', surplus), {
    incomeCents: 500000n,
    expenseCents: 410000n,
  });
  assert.equal(applyFinancialScenario('extra-income', surplus).incomeCents, 530000n);
  assert.equal(applyFinancialScenario('unexpected-expense', surplus).expenseCents, 470000n);
});

test('demo reference month is reproducible, supports rollover, and rejects invalid data', () => {
  const october = createDemoDataset();
  const november = createDemoDataset('2026-11');
  assert.deepEqual(createDemoDataset(), october);
  assert.equal(november.asOfDate, '2026-11-20');
  assert.equal(
    november.transactions.some(({ id }) => id === 'salary-2026-12'),
    true,
  );
  assert.throws(() => createDemoDataset('2026-13'), /month/i);
  assert.throws(() => financialDatasetSchema.parse({ ...october, demoLabel: 'real' }));
});
