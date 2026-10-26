import { z } from 'zod';
export * from './money.ts';
export * from './calendar.ts';

export const preferencesSchema = z
  .object({
    version: z.literal(1),
    theme: z.enum(['system', 'light', 'dark']),
    hideAmounts: z.boolean(),
  })
  .strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: Readonly<Preferences> = Object.freeze({
  version: 1,
  theme: 'system',
  hideAmounts: false,
});
export const healthSchema = z
  .object({
    service: z.literal('fintrack-api'),
    status: z.literal('ok'),
    scope: z.literal('process'),
  })
  .strict();
export type Health = z.infer<typeof healthSchema>;
