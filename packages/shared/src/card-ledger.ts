import { z } from 'zod';
import { addMonths, calendarDateSchema } from './calendar.ts';
import { minorUnitsSchema } from './money.ts';

export const cardPurchaseInputSchema = z
  .object({
    description: z.string().trim().min(1).max(160),
    categoryId: z.uuid().optional(),
    amountCents: minorUnitsSchema.refine((value) => BigInt(value) > 0n),
    purchasedOn: calendarDateSchema,
    installments: z.number().int().min(1).max(48),
  })
  .strict()
  .refine((value) => BigInt(value.amountCents) >= BigInt(value.installments));
export type CardPurchaseInput = z.infer<typeof cardPurchaseInputSchema>;

export function invoiceMonthFor(date: string, closingDay: number): string {
  calendarDateSchema.parse(date);
  const month = `${date.slice(0, 7)}-01`;
  return Number(date.slice(8)) > closingDay ? addMonths(month, 1).slice(0, 7) : month.slice(0, 7);
}
export function installmentAmounts(total: bigint, count: number): bigint[] {
  if (total < BigInt(count) || count < 1 || count > 48)
    throw new RangeError('Invalid installments');
  const base = total / BigInt(count);
  const remainder = total % BigInt(count);
  return Array.from({ length: count }, (_, index) => base + (BigInt(index) < remainder ? 1n : 0n));
}
export function invoiceDueOn(month: string, closingDay: number, dueDay: number): string {
  const first = `${month}-01`;
  calendarDateSchema.parse(first);
  const dueMonth = dueDay <= closingDay ? addMonths(first, 1) : first;
  return `${dueMonth.slice(0, 7)}-${String(dueDay).padStart(2, '0')}`;
}
