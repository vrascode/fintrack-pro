import {
  addMonths,
  calculateAccountBalance,
  calendarDateSchema,
  type FinancialAccount,
  type FinancialCategory,
  type FinancialTransaction,
} from '@fintrack/shared';

export function summarizePersonalFinance(
  accounts: FinancialAccount[],
  categories: FinancialCategory[],
  transactions: FinancialTransaction[],
  asOf: string,
) {
  calendarDateSchema.parse(asOf);
  const month = asOf.slice(0, 7);
  const previousMonth = addMonths(`${month}-01`, -1).slice(0, 7);
  const posted = transactions.filter((entry) => entry.status === 'posted' && entry.date <= asOf);
  const monthly = (period: string) => {
    let income = 0n;
    let expense = 0n;
    for (const entry of posted) {
      if (!entry.date.startsWith(period)) continue;
      if (entry.kind === 'income') income += BigInt(entry.amountCents);
      if (entry.kind === 'expense') expense += BigInt(entry.amountCents);
    }
    return { income, expense, net: income - expense };
  };
  const spending = new Map<string, bigint>();
  for (const entry of posted) {
    if (entry.kind !== 'expense' || !entry.date.startsWith(month)) continue;
    const key = entry.categoryId ?? '';
    spending.set(key, (spending.get(key) ?? 0n) + BigInt(entry.amountCents));
  }
  return {
    month,
    previousMonth,
    current: monthly(month),
    previous: monthly(previousMonth),
    balance: accounts
      .filter((account) => account.openingDate <= asOf)
      .reduce((sum, account) => sum + calculateAccountBalance(account, posted, asOf), 0n),
    futureAccounts: accounts.filter((account) => account.openingDate > asOf).length,
    categories: [...spending]
      .map(([id, amount]) => ({
        id,
        name: categories.find((category) => category.id === id)?.name,
        amount,
      }))
      .sort((a, b) =>
        a.amount === b.amount ? a.id.localeCompare(b.id) : a.amount > b.amount ? -1 : 1,
      ),
  };
}
