import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

// Preserve spaces and Unicode exactly; never silently normalize a password.
export const passwordSchema = z.string().refine(
  (value) => {
    if (value.length < 15 || value.length > 256) return false;
    // UTF-8 replaces lone surrogates; reject them to avoid distinct inputs hashing alike.
    if (/[\uD800-\uDFFF]/u.test(value)) return false;
    const length = Array.from(value).length;
    return length >= 15 && length <= 128;
  },
  { message: 'Password must contain between 15 and 128 characters.' },
);

export const registerSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
export const loginSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    deviceName: z.string().trim().min(1).max(100),
  })
  .strict();

export type Registration = z.infer<typeof registerSchema>;
export type Login = z.infer<typeof loginSchema>;

export const authSessionSchema = z
  .object({
    userId: z.uuid(),
    sessionId: z.uuid(),
    accessToken: z.string().regex(/^ft_a_[A-Za-z0-9_-]{43}$/),
    refreshToken: z.string().regex(/^ft_r_[A-Za-z0-9_-]{43}$/),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type AuthSession = z.infer<typeof authSessionSchema>;
