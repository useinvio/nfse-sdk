/** Minimal XML builders shared by the DPS (dpsJson.ts) and event (eventoJson.ts) layouts. */

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

/** Current time as AAAA-MM-DDThh:mm:ss-03:00 (America/Sao_Paulo), the format SEFIN expects. */
export function nowSaoPauloOffset(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}
