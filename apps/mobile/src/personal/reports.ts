import {
  addMonths,
  csvCell,
  type FinancialCategory,
  type FinancialTransaction,
} from '@fintrack/shared';

export function personalReport(
  transactions: FinancialTransaction[],
  categories: FinancialCategory[],
  startMonth: string,
  endMonth: string,
  categoryId: string | null,
) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth) ||
    startMonth > endMonth
  )
    throw new RangeError('Invalid report period');
  const rows = transactions
    .filter(
      (row) =>
        row.status === 'posted' &&
        row.date.slice(0, 7) >= startMonth &&
        row.date.slice(0, 7) <= endMonth &&
        (!categoryId || row.categoryId === categoryId),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const months: { month: string; income: bigint; expense: bigint; net: bigint }[] = [];
  for (let month = startMonth; month <= endMonth; month = addMonths(`${month}-01`, 1).slice(0, 7)) {
    const inMonth = rows.filter((row) => row.date.startsWith(month));
    const income = inMonth.reduce(
      (sum, row) => sum + (row.kind === 'income' ? BigInt(row.amountCents) : 0n),
      0n,
    );
    const expense = inMonth.reduce(
      (sum, row) => sum + (row.kind === 'expense' ? BigInt(row.amountCents) : 0n),
      0n,
    );
    months.push({ month, income, expense, net: income - expense });
  }
  const spending = new Map<string, bigint>();
  for (const row of rows)
    if (row.kind === 'expense')
      spending.set(
        row.categoryId ?? '',
        (spending.get(row.categoryId ?? '') ?? 0n) + BigInt(row.amountCents),
      );
  const byCategory = [...spending]
    .map(([id, amount]) => ({
      id,
      name: categories.find((item) => item.id === id)?.name ?? 'Sem categoria',
      amount,
    }))
    .sort((a, b) =>
      a.amount === b.amount ? a.name.localeCompare(b.name) : a.amount > b.amount ? -1 : 1,
    );
  return {
    rows,
    months,
    byCategory,
    income: months.reduce((sum, row) => sum + row.income, 0n),
    expense: months.reduce((sum, row) => sum + row.expense, 0n),
  };
}

export function reportCsv(rows: FinancialTransaction[], categories: FinancialCategory[]): string {
  const names = new Map(categories.map((item) => [item.id, item.name]));
  const lines = ['data;tipo;descricao;categoria;valor_brl'];
  for (const row of rows) {
    const cents = BigInt(row.amountCents);
    const decimal = `${cents / 100n},${String(cents % 100n).padStart(2, '0')}`;
    lines.push(
      [row.date, row.kind, row.description, names.get(row.categoryId ?? '') ?? '', decimal]
        .map(csvCell)
        .join(';'),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
