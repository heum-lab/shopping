export type SearchMap = Record<string, string | number | undefined | null>;

export function buildQs(base: SearchMap, overrides: SearchMap = {}): string {
  const merged: SearchMap = { ...base, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === "" || v === null || v === undefined) continue;
    params.set(k, String(v));
  }
  return params.toString();
}
