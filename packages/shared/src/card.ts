import { z } from 'zod';
import { minorUnitsSchema } from './money.ts';

export const creditCardInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    institution: z.string().trim().min(1).max(80),
    lastFour: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
    limitCents: minorUnitsSchema.refine((value) => BigInt(value) > 0n),
    closingDay: z.number().int().min(1).max(28),
    dueDay: z.number().int().min(1).max(28),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
export const creditCardSchema = creditCardInputSchema
  .extend({ id: z.uuid(), archived: z.boolean() })
  .strict();
export type CreditCardInput = z.infer<typeof creditCardInputSchema>;
export type CreditCard = z.infer<typeof creditCardSchema>;
