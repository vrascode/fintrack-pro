/** Integer form controls must not silently accept exponent, hex or decimal notation. */
export function parseIntegerInput(value: string, maximum: number): number {
  const trimmed = value.trim();
  if (!/^[0-9]{1,4}$/.test(trimmed)) throw new RangeError('Enter a whole number.');
  const number = Number(trimmed);
  if (number < 1 || number > maximum) throw new RangeError('Number is outside the allowed range.');
  return number;
}
