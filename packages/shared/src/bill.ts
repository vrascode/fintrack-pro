import { z } from 'zod';
import { addMonths, calendarDateSchema } from './calendar.ts';
import { minorUnitsSchema } from './money.ts';

export const billInputSchema = z
  .object({
    description: z.string().trim().min(1).max(160),
    kind: z.enum(['income', 'expense']),
    amountCents: minorUnitsSchema.refine((value) => BigInt(value) > 0n),
    accountId: z.uuid(),
    categoryId: z.uuid().optional(),
    firstDueOn: calendarDateSchema,
    frequency: z.enum(['once', 'weekly', 'monthly']),
  })
  .strict();
export type BillInput = z.infer<typeof billInputSchema>;

export const billPaymentSchema = z
  .object({
    id: z.uuid(),
    occurrenceOn: calendarDateSchema,
    amountCents: minorUnitsSchema,
    transactionId: z.uuid(),
    createdAt: z.string(),
  })
  .strict();
export const billSchema = billInputSchema
  .extend({
    id: z.uuid(),
    canceledAt: z.string().nullable(),
    payments: z.array(billPaymentSchema),
  })
  .strict();
export type Bill = z.infer<typeof billSchema>;

export function billDueOn(
  firstDueOn: string,
  frequency: BillInput['frequency'],
  index: number,
): string {
  if (!Number.isInteger(index) || index < 0 || index > 1200)
    throw new RangeError('Invalid occurrence');
  if (frequency === 'once') {
    if (index !== 0) throw new RangeError('One-time bill has one occurrence');
    return firstDueOn;
  }
  if (frequency === 'monthly') return addMonths(firstDueOn, index);
  const date = new Date(`${firstDueOn}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + index * 7);
  return date.toISOString().slice(0, 10);
}
