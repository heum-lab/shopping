import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

type Row = RowDataPacket & { id: number; name: string };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const maketer = sp.get("maketer")?.trim() ?? "";
  const agencys = sp.get("agencys")?.trim() ?? "";

  let rows: Row[];
  if (agencys !== "") {
    // 신 모델: 대행사 계정 = level=3 admin
    rows = await query<Row[]>(
      "SELECT idx AS id, name FROM admin WHERE level = 3 ORDER BY name"
    );
  } else if (maketer !== "") {
    rows = await query<Row[]>(
      "SELECT idx AS id, name FROM agency WHERE maketer_idx = ? ORDER BY name",
      [Number(maketer)]
    );
  } else {
    rows = await query<Row[]>("SELECT idx AS id, name FROM agency ORDER BY name");
  }

  return NextResponse.json(rows.map((r) => ({ id: r.id, name: r.name })));
}
