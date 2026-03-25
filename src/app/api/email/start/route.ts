import { NextRequest, NextResponse } from "next/server";
import { startMonitoring } from "@/lib/email-monitor";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Use request body or fall back to env vars
    const host = body.host || process.env.IMAP_HOST;
    const port = body.port || parseInt(process.env.IMAP_PORT || "993");
    const user = body.user || process.env.IMAP_USER;
    const pass = body.pass || process.env.IMAP_PASS;
    const secure = body.secure ?? true;

    if (!host || !user || !pass) {
      return NextResponse.json({ error: "IMAP credentials required" }, { status: 400 });
    }

    // Start monitoring in background — don't block the response
    startMonitoring({ host, port, user, pass, secure }).catch((err) => {
      console.error("[Email Start] Background monitoring failed:", err);
    });

    return NextResponse.json({ success: true, message: "Email monitoring started" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start monitoring";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
