import { z } from 'zod';
import { calendarDateSchema, daysInMonth } from './calendar.ts';
import { addMoney, minorUnitsSchema, multiplyRatio, serializeMoney } from './money.ts';

export const financialTransactionSchema = z
  .object({
    id: z.string().min(1).max(100),
    kind: z.enum(['income', 'expense', 'transfer']),
    amountCents: minorUnitsSchema,
    date: calendarDateSchema,
    status: z.enum(['planned', 'posted']),
    accountId: z.string().min(1).max(100),
    transferAccountId: z.string().min(1).max(100).optional(),
    categoryId: z.string().min(1).max(100).optional(),
    obligationId: z.string().min(1).max(100).optional(),
    description: z.string().trim().min(1).max(160),
  })
  .strict()
  .superRefine((transaction, context) => {
    if (BigInt(transaction.amountCents) <= 0n) {
      context.addIssue({
        code: 'custom',
        path: ['amountCents'],
        message: 'Amount must be positive.',
      });
    }
    if (transaction.kind === 'transfer') {
      if (
        !transaction.transferAccountId ||
        transaction.transferAccountId === transaction.accountId
      ) {
        context.addIssue({
          code: 'custom',
          path: ['transferAccountId'],
          message: 'Transfer requires two different accounts.',
        });
      }
      if (transaction.categoryId || transaction.obligationId) {
        context.addIssue({
          code: 'custom',
          path: ['categoryId'],
          message: 'Transfers are not categorized expenses.',
        });
      }
    } else if (transaction.transferAccountId) {
      context.addIssue({
        code: 'custom',
        path: ['transferAccountId'],
        message: 'Only transfers have a destination account.',
      });
    }
    if (transaction.kind === 'income' && transaction.obligationId) {
      context.addIssue({
        code: 'custom',
        path: ['obligationId'],
        message: 'Income cannot pay an expense obligation.',
      });
    }
  });

export type FinancialTransaction = z.infer<typeof financialTransactionSchema>;

export const financialAccountSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    type: z.enum(['checking', 'savings', 'wallet', 'cash']),
    openingBalanceCents: minorUnitsSchema,
    openingDate: calendarDateSchema,
    includeInPlan: z.boolean(),
  })
  .strict();
export type FinancialAccount = z.infer<typeof financialAccountSchema>;
export const financialAccountInputSchema = financialAccountSchema.omit({ id: true });
export type FinancialAccountInput = z.infer<typeof financialAccountInputSchema>;

export const financialCategorySchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(60),
    kind: z.enum(['income', 'expense']),
    essentialForReserve: z.boolean(),
  })
  .strict();
export type FinancialCategory = z.infer<typeof financialCategorySchema>;
export const financialCategoryInputSchema = financialCategorySchema.omit({ id: true });
export type FinancialCategoryInput = z.infer<typeof financialCategoryInputSchema>;

export const financialObligationSchema = z
  .object({
    id: z.string().min(1).max(100),
    description: z.string().trim().min(1).max(160),
    categoryId: z.string().min(1).max(100),
    amountCents: minorUnitsSchema,
    dueOn: calendarDateSchema,
    recurrence: z.enum(['once', 'monthly']),
  })
  .strict()
  .superRefine((obligation, context) => {
    if (BigInt(obligation.amountCents) <= 0n) {
      context.addIssue({
        code: 'custom',
        path: ['amountCents'],
        message: 'Amount must be positive.',
      });
    }
  });
export type FinancialObligation = z.infer<typeof financialObligationSchema>;

export const financialEnvelopeSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    icon: z.string().min(1).max(16),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    targetCents: minorUnitsSchema,
    plannedMonthlyCents: minorUnitsSchema,
    essentialCategoryIds: z.array(z.string().min(1).max(100)).max(100),
    deadline: calendarDateSchema.optional(),
    model: z.literal('virtual'),
  })
  .strict()
  .superRefine((envelope, context) => {
    if (BigInt(envelope.targetCents) < 0n || BigInt(envelope.plannedMonthlyCents) < 0n) {
      context.addIssue({
        code: 'custom',
        path: ['targetCents'],
        message: 'Envelope amounts cannot be negative.',
      });
    }
  });
export type FinancialEnvelope = z.infer<typeof financialEnvelopeSchema>;

export const envelopeEventSchema = z
  .object({
    id: z.string().min(1).max(100),
    envelopeId: z.string().min(1).max(100),
    kind: z.enum(['contribute', 'withdraw']),
    amountCents: minorUnitsSchema,
    date: calendarDateSchema,
  })
  .strict()
  .superRefine((event, context) => {
    if (BigInt(event.amountCents) <= 0n) {
      context.addIssue({
        code: 'custom',
        path: ['amountCents'],
        message: 'Amount must be positive.',
      });
    }
  });
export type EnvelopeEvent = z.infer<typeof envelopeEventSchema>;

export const monthlyBudgetItemSchema = z
  .object({
    categoryId: z.string().min(1).max(100),
    amountCents: minorUnitsSchema,
  })
  .strict();
export type MonthlyBudgetItem = z.infer<typeof monthlyBudgetItemSchema>;

export const financialDatasetSchema = z
  .object({
    referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    asOfDate: calendarDateSchema,
    accounts: z.array(financialAccountSchema).min(1).max(100),
    categories: z.array(financialCategorySchema).max(200),
    transactions: z.array(financialTransactionSchema).max(10000),
    obligations: z.array(financialObligationSchema).max(1000),
    envelopes: z.array(financialEnvelopeSchema).max(100),
    envelopeEvents: z.array(envelopeEventSchema).max(10000),
    monthlyIncomePlanCents: minorUnitsSchema,
    monthlyBufferPlanCents: minorUnitsSchema,
    monthlyBudget: z.array(monthlyBudgetItemSchema).max(200),
    isDemo: z.literal(true),
    demoLabel: z.literal('fictional'),
  })
  .strict()
  .superRefine((dataset, context) => {
    const checkUniqueIds = (items: { id: string }[], section: string) => {
      const seen = new Set<string>();
      items.forEach(({ id }, index) => {
        if (seen.has(id)) {
          context.addIssue({
            code: 'custom',
            path: [section, index, 'id'],
            message: `${section} IDs must be unique.`,
          });
        }
        seen.add(id);
      });
    };
    checkUniqueIds(dataset.accounts, 'accounts');
    checkUniqueIds(dataset.categories, 'categories');
    checkUniqueIds(dataset.obligations, 'obligations');
    checkUniqueIds(dataset.envelopes, 'envelopes');
    checkUniqueIds(dataset.envelopeEvents, 'envelopeEvents');
    const accountIds = new Set(dataset.accounts.map(({ id }) => id));
    const categoryIds = new Set(dataset.categories.map(({ id }) => id));
    const obligationIds = new Set(dataset.obligations.map(({ id }) => id));
    const obligationById = new Map(dataset.obligations.map((item) => [item.id, item]));
    const envelopeIds = new Set(dataset.envelopes.map(({ id }) => id));
    const seenTransactions = new Set<string>();
    const seenBudgetCategories = new Set<string>();
    for (const [index, account] of dataset.accounts.entries()) {
      if (account.openingDate > dataset.asOfDate) {
        context.addIssue({
          code: 'custom',
          path: ['accounts', index, 'openingDate'],
          message: 'Opening date must be on or before the demo snapshot.',
        });
      }
    }
    for (const [index, transaction] of dataset.transactions.entries()) {
      if (seenTransactions.has(transaction.id)) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'id'],
          message: 'Transaction IDs must be unique.',
        });
      }
      seenTransactions.add(transaction.id);
      if (!accountIds.has(transaction.accountId)) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'accountId'],
          message: 'Transaction account does not exist.',
        });
      }
      if (transaction.transferAccountId && !accountIds.has(transaction.transferAccountId)) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'transferAccountId'],
          message: 'Transfer destination does not exist.',
        });
      }
      if (transaction.categoryId && !categoryIds.has(transaction.categoryId)) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'categoryId'],
          message: 'Transaction category does not exist.',
        });
      }
      if (transaction.obligationId && !obligationIds.has(transaction.obligationId)) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'obligationId'],
          message: 'Paid obligation does not exist.',
        });
      }
      if (transaction.date > dataset.asOfDate && transaction.status === 'posted') {
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'date'],
          message: 'A future transaction cannot already be posted.',
        });
      }
      const sourceAccount = dataset.accounts.find(({ id }) => id === transaction.accountId);
      const targetAccount = dataset.accounts.find(({ id }) => id === transaction.transferAccountId);
      if (sourceAccount && transaction.date < sourceAccount.openingDate) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'date'],
          message: 'Transaction predates its source account.',
        });
      }
      if (targetAccount && transaction.date < targetAccount.openingDate) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'date'],
          message: 'Transfer predates its destination account.',
        });
      }
      const linkedObligation = transaction.obligationId
        ? obligationById.get(transaction.obligationId)
        : undefined;
      if (linkedObligation && transaction.categoryId !== linkedObligation.categoryId) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', index, 'categoryId'],
          message: 'Payment category must match its obligation.',
        });
      }
    }
    for (const [index, item] of dataset.monthlyBudget.entries()) {
      if (!categoryIds.has(item.categoryId)) {
        context.addIssue({
          code: 'custom',
          path: ['monthlyBudget', index, 'categoryId'],
          message: 'Budget category does not exist.',
        });
      }
      if (BigInt(item.amountCents) < 0n) {
        context.addIssue({
          code: 'custom',
          path: ['monthlyBudget', index, 'amountCents'],
          message: 'Budget cannot be negative.',
        });
      }
      if (seenBudgetCategories.has(item.categoryId)) {
        context.addIssue({
          code: 'custom',
          path: ['monthlyBudget', index, 'categoryId'],
          message: 'A category can appear only once in the monthly budget.',
        });
      }
      seenBudgetCategories.add(item.categoryId);
    }
    for (const [index, obligation] of dataset.obligations.entries()) {
      if (!categoryIds.has(obligation.categoryId)) {
        context.addIssue({
          code: 'custom',
          path: ['obligations', index, 'categoryId'],
          message: 'Obligation category does not exist.',
        });
      }
      if (
        dataset.transactions.some(
          (transaction) =>
            transaction.obligationId === obligation.id && transaction.kind !== 'expense',
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['obligations', index, 'id'],
          message: 'Only expenses may pay an obligation.',
        });
      }
    }
    for (const [index, event] of dataset.envelopeEvents.entries()) {
      if (!envelopeIds.has(event.envelopeId)) {
        context.addIssue({
          code: 'custom',
          path: ['envelopeEvents', index, 'envelopeId'],
          message: 'Envelope does not exist.',
        });
      }
      if (event.date > dataset.asOfDate) {
        context.addIssue({
          code: 'custom',
          path: ['envelopeEvents', index, 'date'],
          message: 'A future envelope event cannot already be recorded.',
        });
      }
    }
    for (const envelope of dataset.envelopes) {
      const balance = dataset.envelopeEvents
        .filter(({ envelopeId }) => envelopeId === envelope.id)
        .reduce(
          (sum, event) =>
            sum + BigInt(event.kind === 'contribute' ? event.amountCents : `-${event.amountCents}`),
          0n,
        );
      if (balance < 0n) {
        context.addIssue({
          code: 'custom',
          path: ['envelopes'],
          message: `Envelope ${envelope.id} cannot be overdrawn.`,
        });
      }
    }
    for (const obligation of dataset.obligations) {
      const paid = dataset.transactions
        .filter(
          (transaction) =>
            transaction.obligationId === obligation.id && transaction.status === 'posted',
        )
        .reduce((sum, transaction) => sum + BigInt(transaction.amountCents), 0n);
      if (paid > BigInt(obligation.amountCents)) {
        context.addIssue({
          code: 'custom',
          path: ['obligations'],
          message: `Payments exceed obligation ${obligation.id}.`,
        });
      }
    }
    if (dataset.asOfDate.slice(0, 7) !== dataset.referenceMonth) {
      context.addIssue({
        code: 'custom',
        path: ['referenceMonth'],
        message: 'Snapshot date must be in the reference month.',
      });
    }
    if (
      BigInt(dataset.monthlyIncomePlanCents) < 0n ||
      BigInt(dataset.monthlyBufferPlanCents) < 0n
    ) {
      context.addIssue({
        code: 'custom',
        path: ['monthlyIncomePlanCents'],
        message: 'Plan values cannot be negative.',
      });
    }
  });
export type FinancialDataset = z.infer<typeof financialDatasetSchema>;

function toMoney(value: string): bigint {
  return BigInt(minorUnitsSchema.parse(value));
}

function sumAmounts(values: bigint[]): bigint {
  return addMoney(...values);
}

export function calculateAccountBalance(
  account: FinancialAccount,
  transactions: FinancialTransaction[],
  asOfDate: string,
): bigint {
  calendarDateSchema.parse(asOfDate);
  if (asOfDate < account.openingDate) {
    throw new RangeError('Balance is unknown before the account opening date.');
  }
  const effects: bigint[] = [toMoney(account.openingBalanceCents)];
  for (const transaction of transactions) {
    if (transaction.status !== 'posted' || transaction.date > asOfDate) continue;
    const amount = toMoney(transaction.amountCents);
    if (transaction.kind === 'income' && transaction.accountId === account.id) effects.push(amount);
    if (transaction.kind === 'expense' && transaction.accountId === account.id)
      effects.push(-amount);
    if (transaction.kind === 'transfer') {
      if (transaction.accountId === account.id) effects.push(-amount);
      if (transaction.transferAccountId === account.id) effects.push(amount);
    }
  }
  return sumAmounts(effects);
}

export function calculateObligationPaid(
  obligation: FinancialObligation,
  transactions: FinancialTransaction[],
  asOfDate: string,
): bigint {
  const payments = transactions
    .filter(
      (transaction) =>
        transaction.kind === 'expense' &&
        transaction.status === 'posted' &&
        transaction.obligationId === obligation.id &&
        transaction.date <= asOfDate,
    )
    .map((transaction) => toMoney(transaction.amountCents));
  const paid = sumAmounts(payments);
  if (paid > toMoney(obligation.amountCents)) {
    throw new RangeError(`Payments exceed obligation ${obligation.id}.`);
  }
  return paid;
}

export function calculateObligationRemaining(
  obligation: FinancialObligation,
  transactions: FinancialTransaction[],
  asOfDate: string,
): bigint {
  return (
    toMoney(obligation.amountCents) - calculateObligationPaid(obligation, transactions, asOfDate)
  );
}

export function calculateEnvelopeBalance(
  envelope: FinancialEnvelope,
  events: EnvelopeEvent[],
  asOfDate: string,
): bigint {
  const changes = events
    .filter((event) => event.envelopeId === envelope.id && event.date <= asOfDate)
    .map((event) =>
      event.kind === 'contribute' ? toMoney(event.amountCents) : -toMoney(event.amountCents),
    );
  const balance = sumAmounts(changes);
  if (balance < 0n) throw new RangeError(`Envelope ${envelope.id} cannot have a negative balance.`);
  return balance;
}

export interface MonthlyFinancialSummary {
  incomeReceivedCents: bigint;
  incomeExpectedCents: bigint;
  expensesPaidCents: bigint;
  expenseBudgetCents: bigint;
  budgetRemainingCents: bigint;
  obligationsRemainingCents: bigint;
  overdueObligationsCents: bigint;
  scheduledExpensesCents: bigint;
  balanceAvailableCents: bigint;
  balanceProjectedCents: bigint;
  reservedCents: bigint;
  freeAfterCommitmentsCents: bigint;
  plannedSurplusCents: bigint;
  plannedEnvelopeContributionsCents: bigint;
  plannedFreeAfterGoalsCents: bigint;
  plannedUnallocatedCents: bigint;
  plannedExpenseRatioBps: bigint | null;
  plannedSurplusRatioBps: bigint | null;
}

function withinMonth(date: string, month: string): boolean {
  return date.startsWith(`${month}-`);
}

export function calculateMonthlySummary(
  dataset: FinancialDataset,
  month: string,
  asOfDate: string,
): MonthlyFinancialSummary {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError('Invalid month.');
  calendarDateSchema.parse(asOfDate);
  const incomeReceivedCents = sumAmounts(
    dataset.transactions
      .filter(
        (transaction) =>
          transaction.kind === 'income' &&
          transaction.status === 'posted' &&
          withinMonth(transaction.date, month) &&
          transaction.date <= asOfDate,
      )
      .map((transaction) => toMoney(transaction.amountCents)),
  );
  const incomeExpectedCents = sumAmounts(
    dataset.transactions
      .filter(
        (transaction) =>
          transaction.kind === 'income' &&
          transaction.status === 'planned' &&
          withinMonth(transaction.date, month),
      )
      .map((transaction) => toMoney(transaction.amountCents)),
  );
  const expensesPaidCents = sumAmounts(
    dataset.transactions
      .filter(
        (transaction) =>
          transaction.kind === 'expense' &&
          transaction.status === 'posted' &&
          withinMonth(transaction.date, month) &&
          transaction.date <= asOfDate,
      )
      .map((transaction) => toMoney(transaction.amountCents)),
  );
  const monthObligations = dataset.obligations.filter((obligation) =>
    withinMonth(obligation.dueOn, month),
  );
  const outstanding = monthObligations.map((obligation) => ({
    obligation,
    remaining: calculateObligationRemaining(obligation, dataset.transactions, asOfDate),
  }));
  const obligationsRemainingCents = sumAmounts(outstanding.map(({ remaining }) => remaining));
  const overdueObligationsCents = sumAmounts(
    outstanding
      .filter(({ obligation, remaining }) => obligation.dueOn < asOfDate && remaining > 0n)
      .map(({ remaining }) => remaining),
  );
  const scheduledExpensesCents = sumAmounts(
    dataset.transactions
      .filter(
        (transaction) =>
          transaction.kind === 'expense' &&
          transaction.status === 'planned' &&
          withinMonth(transaction.date, month) &&
          transaction.date > asOfDate &&
          !transaction.obligationId,
      )
      .map((transaction) => toMoney(transaction.amountCents)),
  );
  const accountBalances = dataset.accounts
    .filter((account) => account.includeInPlan && account.openingDate <= asOfDate)
    .map((account) => calculateAccountBalance(account, dataset.transactions, asOfDate));
  const balanceAvailableCents = sumAmounts(accountBalances);
  const expectedIncomeNotYetReceivedCents = sumAmounts(
    dataset.transactions
      .filter(
        (transaction) =>
          transaction.kind === 'income' &&
          transaction.status === 'planned' &&
          withinMonth(transaction.date, month) &&
          transaction.date > asOfDate,
      )
      .map((transaction) => toMoney(transaction.amountCents)),
  );
  const balanceProjectedCents = addMoney(
    balanceAvailableCents,
    expectedIncomeNotYetReceivedCents,
    -obligationsRemainingCents,
    -scheduledExpensesCents,
  );
  const reservedCents = sumAmounts(
    dataset.envelopes.map((envelope) =>
      calculateEnvelopeBalance(envelope, dataset.envelopeEvents, asOfDate),
    ),
  );
  const freeAfterCommitmentsCents = addMoney(
    balanceAvailableCents,
    -obligationsRemainingCents,
    -scheduledExpensesCents,
    -reservedCents,
  );
  const expenseBudgetCents = sumAmounts(
    dataset.monthlyBudget.map((item) => toMoney(item.amountCents)),
  );
  const plannedSurplusCents = addMoney(
    toMoney(dataset.monthlyIncomePlanCents),
    -expenseBudgetCents,
  );
  const plannedEnvelopeContributionsCents = sumAmounts(
    dataset.envelopes.map((envelope) => toMoney(envelope.plannedMonthlyCents)),
  );
  const plannedFreeAfterGoalsCents = addMoney(
    plannedSurplusCents,
    -plannedEnvelopeContributionsCents,
  );
  const plannedUnallocatedCents = addMoney(
    plannedFreeAfterGoalsCents,
    -toMoney(dataset.monthlyBufferPlanCents),
  );
  const plannedExpenseRatioBps =
    toMoney(dataset.monthlyIncomePlanCents) > 0n
      ? multiplyRatio(expenseBudgetCents, 10000n, toMoney(dataset.monthlyIncomePlanCents))
      : null;
  const plannedSurplusRatioBps =
    toMoney(dataset.monthlyIncomePlanCents) > 0n
      ? multiplyRatio(plannedSurplusCents, 10000n, toMoney(dataset.monthlyIncomePlanCents))
      : null;
  return {
    incomeReceivedCents,
    incomeExpectedCents,
    expensesPaidCents,
    expenseBudgetCents,
    budgetRemainingCents: addMoney(expenseBudgetCents, -expensesPaidCents),
    obligationsRemainingCents,
    overdueObligationsCents,
    scheduledExpensesCents,
    balanceAvailableCents,
    balanceProjectedCents,
    reservedCents,
    freeAfterCommitmentsCents,
    plannedSurplusCents,
    plannedEnvelopeContributionsCents,
    plannedFreeAfterGoalsCents,
    plannedUnallocatedCents,
    plannedExpenseRatioBps,
    plannedSurplusRatioBps,
  };
}

export interface DailyProjectionPoint {
  date: string;
  balanceCents: bigint;
  eventLabels: string[];
}

export function calculateDailyProjection(
  dataset: FinancialDataset,
  month: string,
  asOfDate: string,
): DailyProjectionPoint[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !asOfDate.startsWith(`${month}-`)) {
    throw new RangeError('Projection month and snapshot date must match.');
  }
  const start = dataset.accounts
    .filter((account) => account.includeInPlan && account.openingDate <= asOfDate)
    .map((account) => calculateAccountBalance(account, dataset.transactions, asOfDate));
  let balance = sumAmounts(start);
  const events = new Map<string, { delta: bigint; labels: string[] }>();
  const addEvent = (date: string, delta: bigint, label: string) => {
    const existing = events.get(date) ?? { delta: 0n, labels: [] };
    existing.delta = addMoney(existing.delta, delta);
    existing.labels.push(label);
    events.set(date, existing);
  };
  for (const transaction of dataset.transactions) {
    if (
      transaction.status !== 'planned' ||
      transaction.date <= asOfDate ||
      !withinMonth(transaction.date, month)
    )
      continue;
    if (transaction.kind === 'income')
      addEvent(transaction.date, toMoney(transaction.amountCents), transaction.description);
    if (transaction.kind === 'expense' && !transaction.obligationId)
      addEvent(transaction.date, -toMoney(transaction.amountCents), transaction.description);
  }
  for (const obligation of dataset.obligations) {
    if (!withinMonth(obligation.dueOn, month)) continue;
    const remaining = calculateObligationRemaining(obligation, dataset.transactions, asOfDate);
    if (remaining <= 0n) continue;
    addEvent(
      obligation.dueOn <= asOfDate ? asOfDate : obligation.dueOn,
      -remaining,
      obligation.description,
    );
  }
  const lastDay = `${month}-${String(
    daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)))
      .toString()
      .padStart(2, '0'),
  )}`;
  const points: DailyProjectionPoint[] = [
    { date: asOfDate, balanceCents: balance, eventLabels: [] },
  ];
  const futureDates = [...events.keys()]
    .filter((date) => date >= asOfDate && date <= lastDay)
    .sort();
  for (const date of futureDates) {
    const event = events.get(date);
    if (!event) continue;
    balance = addMoney(balance, event.delta);
    points.push({ date, balanceCents: balance, eventLabels: event.labels });
  }
  return points;
}

export function calculateReserveTargets(
  categories: FinancialCategory[],
  budget: MonthlyBudgetItem[],
  selectedCategoryIds: string[],
): { essentialMonthlyCents: bigint; threeMonthTargetCents: bigint; sixMonthTargetCents: bigint } {
  const selected = new Set(selectedCategoryIds);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const essentialMonthlyCents = sumAmounts(
    budget
      .filter(
        (item) =>
          selected.has(item.categoryId) && categoryMap.get(item.categoryId)?.kind === 'expense',
      )
      .map((item) => toMoney(item.amountCents)),
  );
  return {
    essentialMonthlyCents,
    threeMonthTargetCents: addMoney(
      essentialMonthlyCents,
      essentialMonthlyCents,
      essentialMonthlyCents,
    ),
    sixMonthTargetCents: addMoney(...Array.from({ length: 6 }, () => essentialMonthlyCents)),
  };
}

export function calculateGoalPlan(
  targetCents: bigint,
  savedCents: bigint,
  monthlyContributionCents: bigint,
  desiredMonths?: number,
): {
  remainingCents: bigint;
  progressBps: bigint;
  estimatedMonths: number | null;
  contributionNeededCents: bigint | null;
} {
  if (targetCents < 0n || savedCents < 0n || monthlyContributionCents < 0n) {
    throw new RangeError('Goal values cannot be negative.');
  }
  if (
    desiredMonths !== undefined &&
    (!Number.isInteger(desiredMonths) || desiredMonths < 1 || desiredMonths > 1200)
  ) {
    throw new RangeError('Desired period must be between 1 and 1200 months.');
  }
  const remainingCents = targetCents > savedCents ? targetCents - savedCents : 0n;
  const progressBps =
    targetCents === 0n
      ? 10000n
      : multiplyRatio(savedCents > targetCents ? targetCents : savedCents, 10000n, targetCents);
  const estimatedMonths =
    remainingCents === 0n
      ? 0
      : monthlyContributionCents === 0n
        ? null
        : Number((remainingCents + monthlyContributionCents - 1n) / monthlyContributionCents);
  const contributionNeededCents =
    desiredMonths === undefined
      ? null
      : remainingCents === 0n
        ? 0n
        : (remainingCents + BigInt(desiredMonths) - 1n) / BigInt(desiredMonths);
  return { remainingCents, progressBps, estimatedMonths, contributionNeededCents };
}

export interface SavingsSimulation {
  monthlySurplusCents: bigint;
  goalContributionsCents: bigint;
  freeAfterGoalsCents: bigint;
  meetsBufferTarget: boolean;
  estimatedMonths: number | null;
}

export function simulateSavingsPlan(input: {
  incomeCents: bigint;
  expensesCents: bigint;
  reserveContributionCents: bigint;
  goalContributionCents: bigint;
  bufferTargetCents: bigint;
  goalRemainingCents: bigint;
}): SavingsSimulation {
  const {
    incomeCents,
    expensesCents,
    reserveContributionCents,
    goalContributionCents,
    bufferTargetCents,
    goalRemainingCents,
  } = input;
  if (
    [
      incomeCents,
      expensesCents,
      reserveContributionCents,
      goalContributionCents,
      bufferTargetCents,
      goalRemainingCents,
    ].some((value) => value < 0n)
  ) {
    throw new RangeError('Simulation values cannot be negative.');
  }
  const monthlySurplusCents = incomeCents - expensesCents;
  const goalContributionsCents = addMoney(reserveContributionCents, goalContributionCents);
  const freeAfterGoalsCents = addMoney(monthlySurplusCents, -goalContributionsCents);
  const estimatedMonths =
    goalRemainingCents === 0n
      ? 0
      : goalContributionsCents <= 0n
        ? null
        : Number((goalRemainingCents + goalContributionsCents - 1n) / goalContributionsCents);
  return {
    monthlySurplusCents,
    goalContributionsCents,
    freeAfterGoalsCents,
    meetsBufferTarget: freeAfterGoalsCents >= bufferTargetCents,
    estimatedMonths,
  };
}

export type FinancialScenario =
  'reduce-subscriptions' | 'reduce-groceries' | 'extra-income' | 'unexpected-expense';

export function applyFinancialScenario(
  scenario: FinancialScenario,
  current: { incomeCents: bigint; expenseCents: bigint },
): { incomeCents: bigint; expenseCents: bigint } {
  if (current.incomeCents < 0n || current.expenseCents < 0n)
    throw new RangeError('Scenario values cannot be negative.');
  switch (scenario) {
    case 'reduce-subscriptions':
    case 'reduce-groceries':
      return {
        ...current,
        expenseCents:
          current.expenseCents > 0n
            ? current.expenseCents - (scenario === 'reduce-subscriptions' ? 3000n : 10000n)
            : 0n,
      };
    case 'extra-income':
      return { ...current, incomeCents: addMoney(current.incomeCents, 30000n) };
    case 'unexpected-expense':
      return { ...current, expenseCents: addMoney(current.expenseCents, 50000n) };
  }
}

export function serializeFinancialDataset(dataset: FinancialDataset): string {
  return JSON.stringify(financialDatasetSchema.parse(dataset));
}

export function parseFinancialDataset(value: string): FinancialDataset {
  return financialDatasetSchema.parse(JSON.parse(value));
}

export function serializeCents(value: bigint): string {
  return serializeMoney(value);
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Export an already-filtered transaction list without allowing spreadsheet formulas. */
export function exportTransactionsCsv(
  transactions: FinancialTransaction[],
  labels: { category: Map<string, string>; account: Map<string, string> },
  language: 'pt-BR' | 'en',
): string {
  const headers =
    language === 'pt-BR'
      ? ['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Valor (centavos)', 'Status']
      : ['Date', 'Type', 'Description', 'Category', 'Account', 'Amount (cents)', 'Status'];
  const kind = (value: FinancialTransaction['kind']) =>
    language === 'pt-BR'
      ? { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' }[value]
      : value;
  const status = (value: FinancialTransaction['status']) =>
    language === 'pt-BR' ? { posted: 'Realizada', planned: 'Prevista' }[value] : value;
  const rows = transactions.map((transaction) => [
    transaction.date,
    kind(transaction.kind),
    transaction.description,
    labels.category.get(transaction.categoryId ?? '') ?? '',
    labels.account.get(transaction.accountId) ?? transaction.accountId,
    transaction.amountCents,
    status(transaction.status),
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}
