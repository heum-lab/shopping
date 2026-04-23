// 경량 CSV 파서/라이터 (RFC 4180 호환, 헤더/쿼트된 필드 지원)

export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",") + "\r\n";
}

export function toCsvWithBom(rows: unknown[][]): string {
  const body = rows.map(toCsvRow).join("");
  return "﻿" + body;
}

// RFC 4180 파서: 따옴표 안의 쉼표/개행 처리
export function parseCsv(text: string): string[][] {
  // BOM 제거
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") { field += "\""; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === "\"") { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // 마지막 필드/행 flush
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
