import { todayYmd, daysAgoYmd } from "@/lib/format";

function firstDayOfMonth(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function lastDayOfMonth(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = new Date(y, m + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateShortcut(key: string): [string, string] | null {
  const today = todayYmd();
  switch (key) {
    case "today":           return [today, today];
    case "yesterday":       return [daysAgoYmd(1), daysAgoYmd(1)];
    case "today_yesterday": return [daysAgoYmd(1), today];
    case "7days":           return [daysAgoYmd(7), today];
    case "1m":              return [daysAgoYmd(30),  today];
    case "3m":              return [daysAgoYmd(90),  today];
    case "6m":              return [daysAgoYmd(180), today];
    case "12m":             return [daysAgoYmd(365), today];
    case "this_month": {
      const now = new Date();
      return [firstDayOfMonth(now), lastDayOfMonth(now)];
    }
    case "last_month": {
      const now = new Date();
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return [firstDayOfMonth(lm), lastDayOfMonth(lm)];
    }
    default: return null;
  }
}

export const SHORTCUTS: Record<string, string> = {
  today: "오늘",
  yesterday: "어제",
  today_yesterday: "오늘·어제",
  "7days": "7일전",
  "1m": "1개월",
  "3m": "3개월",
  "6m": "6개월",
  "12m": "12개월",
  this_month: "이번달",
  last_month: "이전달",
};
