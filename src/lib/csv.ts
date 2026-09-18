export function toCsvValue(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values.map(toCsvValue).join(",");
}

export function buildCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join("\n");
}
