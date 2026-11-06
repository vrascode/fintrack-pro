import { calendarDateSchema, type FinancialTransaction } from '@fintrack/shared';

export function filterHistory(
  entries: FinancialTransaction[],
  filters: {
    search: string;
    from: string;
    to: string;
    kind: string;
    accountId: string;
    categoryId: string;
    ascending: boolean;
  },
) {
  if (
    (filters.from && !calendarDateSchema.safeParse(filters.from).success) ||
    (filters.to && !calendarDateSchema.safeParse(filters.to).success) ||
    (filters.from && filters.to && filters.from > filters.to)
  )
    return [];
  const search = filters.search.trim().toLocaleLowerCase();
  return entries
    .filter(
      (entry) =>
        entry.description.toLocaleLowerCase().includes(search) &&
        (!filters.from || entry.date >= filters.from) &&
        (!filters.to || entry.date <= filters.to) &&
        (!filters.kind || entry.kind === filters.kind) &&
        (!filters.accountId ||
          entry.accountId === filters.accountId ||
          entry.transferAccountId === filters.accountId) &&
        (!filters.categoryId || entry.categoryId === filters.categoryId),
    )
    .sort((a, b) => {
      const order = a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      return filters.ascending ? order : -order;
    });
}
