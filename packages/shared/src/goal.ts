import { z } from 'zod';
import { calendarDateSchema } from './calendar.ts';
import { minorUnitsSchema } from './money.ts';

const positiveCents = minorUnitsSchema.refine((value) => BigInt(value) > 0n, {
  message: 'Goal amount must be positive.',
});

export const savingsGoalInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    targetCents: positiveCents,
    targetOn: calendarDateSchema.nullable(),
  })
  .strict();
export type SavingsGoalInput = z.infer<typeof savingsGoalInputSchema>;

export const savingsGoalUpdateSchema = savingsGoalInputSchema
  .partial()
  .extend({ status: z.enum(['active', 'closed']).optional() })
  .refine((value) => Object.keys(value).length > 0);
export type SavingsGoalUpdate = z.infer<typeof savingsGoalUpdateSchema>;

export const goalContributionInputSchema = z
  .object({
    amountCents: positiveCents,
    contributedOn: calendarDateSchema,
    note: z.string().trim().max(160).nullable(),
  })
  .strict();
export type GoalContributionInput = z.infer<typeof goalContributionInputSchema>;

export const goalContributionSchema = goalContributionInputSchema.extend({ id: z.uuid() }).strict();
export type GoalContribution = z.infer<typeof goalContributionSchema>;

export const savingsGoalSchema = savingsGoalInputSchema
  .extend({
    id: z.uuid(),
    status: z.enum(['active', 'closed']),
    contributedCents: minorUnitsSchema,
    contributions: z.array(goalContributionSchema),
  })
  .strict();
export type SavingsGoal = z.infer<typeof savingsGoalSchema>;
