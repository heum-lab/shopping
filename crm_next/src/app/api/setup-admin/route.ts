import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne, execute } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

type IdxRow = RowDataPacket & { idx: number };

const DEFAULT_ID = "admin";
const DEFAULT_PW = "admin1234";
const DEFAULT_NAME = "슈퍼관리자";

export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SETUP_ADMIN !== "1") {
    return NextResponse.json(
      { error: "disabled in production. set ALLOW_SETUP_ADMIN=1 to enable temporarily." },
      { status: 403 }
    );
  }

  const existing = await queryOne<IdxRow>(
    "SELECT idx FROM admin WHERE id = ? LIMIT 1",
    [DEFAULT_ID]
  );
  if (existing) {
    return NextResponse.json({
      ok: true,
      created: false,
      message: `'${DEFAULT_ID}' account already exists. No action taken.`,
    });
  }

  const hash = await bcrypt.hash(DEFAULT_PW, 10);
  await execute(
    "INSERT INTO admin (id, pw, name, level) VALUES (?, ?, ?, 1)",
    [DEFAULT_ID, hash, DEFAULT_NAME]
  );

  return NextResponse.json({
    ok: true,
    created: true,
    id: DEFAULT_ID,
    pw: DEFAULT_PW,
    message: "Super admin created. Delete or disable this route after first use.",
  });
}
