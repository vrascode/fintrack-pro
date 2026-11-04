import { z } from 'zod';
import { calendarDateSchema } from './calendar.ts';
import { minorUnitsSchema } from './money.ts';

export const budgetMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .refine((month) => calendarDateSchema.safeParse(`${month}-01`).success, 'Invalid month.');

const positiveCents = minorUnitsSchema.refine((value) => BigInt(value) > 0n, {
  message: 'Budget limit must be positive.',
});

export const monthlyBudgetInputSchema = z
  .object({
    categoryId: z.uuid(),
    month: budgetMonthSchema,
    limitCents: positiveCents,
  })
  .strict();
export type MonthlyBudgetInput = z.infer<typeof monthlyBudgetInputSchema>;

export const monthlyBudgetSchema = monthlyBudgetInputSchema
  .extend({
    id: z.uuid(),
    categoryName: z.string().min(1).max(60),
    spentCents: minorUnitsSchema,
  })
  .strict();
export type MonthlyBudget = z.infer<typeof monthlyBudgetSchema>;
