import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  let available = false;
  try {
    execSync("test -f /usr/local/bin/soundflow");
    available = true;
  } catch {}
  return NextResponse.json({ available });
}
