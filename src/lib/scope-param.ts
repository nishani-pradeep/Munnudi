export type KpiScope = "current" | "tillNow" | "average";

export function scopeFromParam(raw: string | string[] | undefined): KpiScope {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "tillNow" || value === "average") return value;
  return "current";
}
