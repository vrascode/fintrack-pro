import { z } from 'zod';

export const MIN_MINOR = -9223372036854775808n;
export const MAX_MINOR = 9223372036854775807n;
export const minorUnitsSchema = z
  .string()
  .max(20)
  .regex(/^(0|-?[1-9]\d*)$/)
  .refine((value) => {
    try {
      const amount = BigInt(value);
      return amount >= MIN_MINOR && amount <= MAX_MINOR;
    } catch {
      return false;
    }
  }, 'Amount exceeds signed 64-bit storage');

export function minorUnits(value: string): bigint {
  return BigInt(minorUnitsSchema.parse(value));
}

export function serializeMoney(value: bigint): string {
  return minorUnitsSchema.parse(value.toString());
}

/** Decimal input uses a dot; no float conversion or silent rounding. */
export function parseDecimal(value: string): bigint {
  if (!/^-?(0|[1-9]\d*)(\.\d{1,2})?$/.test(value) || value.length > 24) {
    throw new RangeError('Expected decimal amount with at most two fractional digits');
  }
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.');
  const result = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * (negative ? -1n : 1n);
  return minorUnits(serializeMoney(result));
}

export function addMoney(...amounts: bigint[]): bigint {
  return minorUnits(serializeMoney(amounts.reduce((sum, amount) => sum + amount, 0n)));
}

/** Round half away from zero, including negative adjustments. */
export function multiplyRatio(amount: bigint, numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('Denominator must be positive');
  const product = amount * numerator;
  const magnitude = product < 0n ? -product : product;
  const rounded = (magnitude + denominator / 2n) / denominator;
  return minorUnits(serializeMoney(product < 0n ? -rounded : rounded));
}

export function splitMoney(amount: bigint, count: number): bigint[] {
  serializeMoney(amount);
  if (!Number.isInteger(count) || count < 1 || count > 1200)
    throw new RangeError('Invalid installment count');
  const divisor = BigInt(count);
  const remainder = amount % divisor;
  const magnitude = remainder < 0n ? -remainder : remainder;
  return Array.from(
    { length: count },
    (_, index) => amount / divisor + (BigInt(index) < magnitude ? (amount < 0n ? -1n : 1n) : 0n),
  );
}

export function formatBRL(amount: bigint, hidden = false): string {
  if (hidden) return '••••';
  serializeMoney(amount);
  const magnitude = amount < 0n ? -amount : amount;
  const whole = (magnitude / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${amount < 0n ? '-' : ''}R$ ${whole},${(magnitude % 100n).toString().padStart(2, '0')}`;
}
