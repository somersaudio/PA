import { NextRequest, NextResponse } from "next/server";
import { getEmails, getUnreadCount, markRead, deleteEmail, isMonitoring, startMonitoring } from "@/lib/email-monitor";

export async function GET() {
  // Auto-start monitor if env vars are set and monitor isn't running
  if (!isMonitoring() && process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS) {
    startMonitoring({
      host: process.env.IMAP_HOST,
      port: parseInt(process.env.IMAP_PORT || "993"),
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS,
      secure: true,
    }).catch((err) => console.error("[Email Inbox] Auto-start failed:", err));
  }

  return NextResponse.json({
    emails: getEmails(),
    unreadCount: getUnreadCount(),
    monitoring: isMonitoring(),
  });
}

export async function POST(req: NextRequest) {
  const { action, id } = await req.json();
  if (action === "markRead" && id) {
    markRead(id);
    return NextResponse.json({ success: true });
  }
  if (action === "delete" && id) {
    deleteEmail(id);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
