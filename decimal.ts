/** Decimal arithmetic shared by validation and serialization; no binary float math. */
export function decimalParts(value: string | number): { integer: bigint; scale: number } {
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`Decimal invalido: ${text}`);
  const [whole, fraction = ''] = text.split('.');
  return { integer: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

function fixedFromInteger(integer: bigint, scale: number, decimals = 2): string {
  const divisor = 10n ** BigInt(Math.max(0, scale - decimals));
  const scaled = scale > decimals ? (integer + divisor / 2n) / divisor : integer * 10n ** BigInt(decimals - scale);
  const text = scaled.toString().padStart(decimals + 1, '0');
  return `${text.slice(0, -decimals)}.${text.slice(-decimals)}`;
}

export function fixedDecimal(value: string | number): string {
  const { integer, scale } = decimalParts(value);
  return fixedFromInteger(integer, scale);
}

export function mulDecimal(a: string, b: number): string {
  const left = decimalParts(a);
  const right = decimalParts(b);
  return fixedFromInteger(left.integer * right.integer, left.scale + right.scale);
}
