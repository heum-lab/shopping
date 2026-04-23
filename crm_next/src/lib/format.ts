export function numberFormat(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("ko-KR");
}

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
