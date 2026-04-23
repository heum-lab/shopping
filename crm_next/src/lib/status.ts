export const STATUS_OPTIONS = [
  "대기", "작업중", "중지", "환불요청", "환불완료", "연장처리", "작업완료", "삭제요청",
] as const;

const STATUS_COLOR: Record<string, string> = {
  "대기":     "#6c757d",
  "작업중":   "#0d6efd",
  "중지":     "#fd7e14",
  "환불요청": "#dc3545",
  "환불완료": "#adb5bd",
  "연장처리": "#198754",
  "작업완료": "#20c997",
  "삭제요청": "#6f42c1",
};

export function statusBadgeStyle(status: string): { background: string; color: string; padding: string; borderRadius: string; fontSize: string } {
  return {
    background: STATUS_COLOR[status] ?? "#6c757d",
    color: "#fff",
    padding: "3px 8px",
    borderRadius: "10px",
    fontSize: "12px",
  };
}

export function statusLabel(status: string, driveDays?: string | null): string {
  if (status === "연장처리" && driveDays && String(driveDays).trim() !== "") {
    return `${status} ${String(driveDays).trim()}일`;
  }
  return status;
}
