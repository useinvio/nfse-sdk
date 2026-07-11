/**
 * Helpers minimos de construcao de XML compartilhados entre os builders
 * de DPS (dpsJson.ts) e de eventos (eventoJson.ts).
 */

export function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeAttr(value: string | number): string {
  return escapeXml(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function attrs(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join('');
}

export function el(name: string, content: string, attrValues: Record<string, string> = {}): string {
  return `<${name}${attrs(attrValues)}>${content}</${name}>`;
}

export function textEl(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  return el(name, escapeXml(value));
}

export function requiredTextEl(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Campo obrigatorio ausente: ${name}`);
  }
  return el(name, escapeXml(value));
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function pad(value: string, length: number): string {
  return onlyDigits(value).padStart(length, '0');
}

/** Data/hora local no formato AAAA-MM-DDThh:mm:ssTZD exigido pela SEFIN. */
export function nowOffset(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const abs = Math.abs(tz);
  const offset = `${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}${offset}`
  );
}
