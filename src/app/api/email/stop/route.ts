import { NextResponse } from "next/server";
import { stopMonitoring } from "@/lib/email-monitor";

export async function POST() {
  await stopMonitoring();
  return NextResponse.json({ success: true, message: "Email monitoring stopped" });
}
