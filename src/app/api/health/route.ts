import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEngine } from "@/lib/engine/manager";

function dbOk(): boolean {
  try {
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM games")
      .get();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const db = dbOk();
  try {
    const { version } = await getEngine().start();
    return NextResponse.json(
      { ok: true, engine: { name: version, ready: true }, db },
      { status: 200 },
    );
  } catch {
    const { version } = getEngine().status();
    return NextResponse.json(
      { ok: false, engine: { name: version, ready: false }, db },
      { status: 200 },
    );
  }
}
