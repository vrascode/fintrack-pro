import { addMonths, daysInMonth } from './calendar.ts';
import { financialDatasetSchema, type FinancialDataset } from './finance.ts';

export const DEMO_REFERENCE_MONTH = '2026-10';
export const DEMO_AS_OF_DAY = 20;

const expenses = [
  { id: 'rent', name: 'Rent', cents: 130000, dueDay: 5, paidDay: 5, essential: true },
  { id: 'condominium', name: 'Condominium', cents: 20000, dueDay: 5, paidDay: 5, essential: true },
  { id: 'water', name: 'Water', cents: 10000, dueDay: 18, paidDay: 18, essential: true },
  {
    id: 'electricity',
    name: 'Electricity',
    cents: 20000,
    dueDay: 25,
    paidDay: 25,
    essential: true,
  },
  { id: 'internet', name: 'Internet', cents: 10000, dueDay: 8, paidDay: 6, essential: true },
  { id: 'phone', name: 'Phone', cents: 6000, dueDay: 8, paidDay: 6, essential: true },
  { id: 'groceries', name: 'Groceries', cents: 85000, dueDay: 10, paidDay: 10, essential: true },
  { id: 'transport', name: 'Transport', cents: 35000, dueDay: 15, paidDay: 12, essential: true },
  { id: 'health', name: 'Health', cents: 20000, dueDay: 15, paidDay: 13, essential: true },
  { id: 'education', name: 'Education', cents: 15000, dueDay: 28, paidDay: 28, essential: false },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    cents: 9000,
    dueDay: 30,
    paidDay: 30,
    essential: false,
  },
  { id: 'leisure', name: 'Leisure', cents: 30000, dueDay: 20, paidDay: 14, essential: false },
  { id: 'other', name: 'Other', cents: 30000, dueDay: 25, paidDay: 15, essential: false },
] as const;

const paidInSnapshot = new Set([
  'rent',
  'condominium',
  'internet',
  'phone',
  'groceries',
  'transport',
  'health',
  'leisure',
  'other',
]);

function shiftMonth(month: string, amount: number): string {
  return addMonths(`${month}-01`, amount).slice(0, 7);
}

function dateAt(month: string, day: number): string {
  const [year = 0, monthNumber = 0] = month.split('-').map(Number);
  const validDay = Math.min(day, daysInMonth(year, monthNumber));
  return `${month}-${String(validDay).padStart(2, '0')}`;
}

/** A reproducible, explicitly fictional six-month data set. It never reads or writes real records. */
export function createDemoDataset(referenceMonth = DEMO_REFERENCE_MONTH): FinancialDataset {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth))
    throw new RangeError('Invalid demo reference month.');
  const asOfDate = dateAt(referenceMonth, DEMO_AS_OF_DAY);
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(referenceMonth, index - 5));
  const categories = [
    { id: 'salary', name: 'Salary', kind: 'income' as const, essentialForReserve: false },
    ...expenses.map(({ id, name, essential }) => ({
      id,
      name,
      kind: 'expense' as const,
      essentialForReserve: essential,
    })),
  ];
  const transactions: Array<Record<string, unknown>> = [];
  const obligations: Array<Record<string, unknown>> = [];
  const envelopeEvents: Array<Record<string, unknown>> = [];
  const current = months.at(-1);
  if (!current) throw new Error('Demo history must have six months.');

  for (const [monthIndex, month] of months.entries()) {
    const isSnapshotMonth = monthIndex === months.length - 1;
    transactions.push({
      id: `salary-${month}`,
      kind: 'income',
      amountCents: '500000',
      date: dateAt(month, 5),
      status: 'posted',
      accountId: 'checking',
      categoryId: 'salary',
      description: 'Monthly salary',
    });

    for (const item of expenses) {
      const obligationId = `${item.id}-${month}`;
      obligations.push({
        id: obligationId,
        description: item.name,
        categoryId: item.id,
        amountCents: String(item.cents),
        dueOn: dateAt(month, item.dueDay),
        recurrence: 'monthly',
      });
      const paid = !isSnapshotMonth || paidInSnapshot.has(item.id);
      if (!paid) continue;
      const paymentDate = isSnapshotMonth
        ? dateAt(month, item.paidDay)
        : dateAt(month, item.dueDay);
      transactions.push({
        id: `payment-${item.id}-${month}`,
        kind: 'expense',
        amountCents: String(item.cents),
        date: paymentDate,
        status: 'posted',
        accountId: 'checking',
        categoryId: item.id,
        obligationId,
        description: item.name,
      });
    }

    if (!isSnapshotMonth) {
      const eventDate = dateAt(
        month,
        daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7))),
      );
      envelopeEvents.push(
        {
          id: `reserve-emergency-${month}`,
          envelopeId: 'emergency',
          kind: 'contribute',
          amountCents: '50000',
          date: eventDate,
        },
        {
          id: `reserve-personal-${month}`,
          envelopeId: 'personal',
          kind: 'contribute',
          amountCents: '20000',
          date: eventDate,
        },
      );
    }
  }

  const nextMonth = shiftMonth(referenceMonth, 1);
  transactions.push({
    id: `salary-${nextMonth}`,
    kind: 'income',
    amountCents: '500000',
    date: dateAt(nextMonth, 5),
    status: 'planned',
    accountId: 'checking',
    categoryId: 'salary',
    description: 'Expected monthly salary',
  });

  return financialDatasetSchema.parse({
    referenceMonth,
    asOfDate,
    accounts: [
      {
        id: 'checking',
        name: 'Everyday account',
        type: 'checking',
        openingBalanceCents: '200000',
        openingDate: dateAt(months[0] ?? referenceMonth, 1),
        includeInPlan: true,
      },
      {
        id: 'savings',
        name: 'Savings account',
        type: 'savings',
        openingBalanceCents: '0',
        openingDate: dateAt(months[0] ?? referenceMonth, 1),
        includeInPlan: true,
      },
    ],
    categories,
    transactions,
    obligations,
    envelopes: [
      {
        id: 'emergency',
        name: 'Emergency reserve',
        icon: 'shield',
        color: '#C84A01',
        targetCents: '1008000',
        plannedMonthlyCents: '50000',
        essentialCategoryIds: expenses.filter(({ essential }) => essential).map(({ id }) => id),
        model: 'virtual',
      },
      {
        id: 'personal',
        name: 'Personal goal',
        icon: 'target',
        color: '#C84A01',
        targetCents: '600000',
        plannedMonthlyCents: '20000',
        essentialCategoryIds: [],
        deadline: dateAt(shiftMonth(referenceMonth, 12), 20),
        model: 'virtual',
      },
    ],
    envelopeEvents,
    monthlyIncomePlanCents: '500000',
    monthlyBufferPlanCents: '10000',
    monthlyBudget: expenses.map(({ id, cents }) => ({
      categoryId: id,
      amountCents: String(cents),
    })),
    isDemo: true,
    demoLabel: 'fictional',
  });
}
