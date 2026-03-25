import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { callClaude } from "./claude";
import { getMemory, updateMemoryFromAnalysis } from "./email-memory";

const emailsDir = path.join(process.cwd(), "data", "emails");
const scannedPath = path.join(emailsDir, "scanned-accounts.json");

function getScannedAccounts(): Record<string, string> {
  try { return JSON.parse(readFileSync(scannedPath, "utf-8")); } catch { return {}; }
}

function markAccountScanned(email: string) {
  const scanned = getScannedAccounts();
  scanned[email] = new Date().toISOString();
  mkdirSync(emailsDir, { recursive: true });
  writeFileSync(scannedPath, JSON.stringify(scanned, null, 2), "utf-8");
}
const attachmentsDir = path.join(emailsDir, "attachments");
const inboxPath = path.join(emailsDir, "inbox.json");

export type EmailMessage = {
  id: string;
  uid: number;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  attachments: Array<{
    filename: string;
    size: number;
    contentType: string;
    savedPath: string;
  }>;
  aiSummary: string | null;
  category: "work" | "personal" | "newsletter" | "notification" | "spam" | null;
  priority: "high" | "medium" | "low" | null;
  actionItems: string[];
  read: boolean;
};

// Singleton state — use globalThis to survive Next.js module reloads
const g = globalThis as unknown as {
  __emailClient?: ImapFlow | null;
  __emailMonitoring?: boolean;
  __emailLock?: { release: () => void } | null;
};

const statePath = path.join(emailsDir, "monitor-state.json");

function getMonitoringState(): boolean {
  // Check both in-memory and disk
  if (g.__emailMonitoring) return true;
  try {
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    return state.monitoring === true;
  } catch {
    return false;
  }
}

function setMonitoringState(val: boolean) {
  g.__emailMonitoring = val;
  mkdirSync(emailsDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify({ monitoring: val }), "utf-8");
}

function getInbox(): EmailMessage[] {
  try {
    return JSON.parse(readFileSync(inboxPath, "utf-8"));
  } catch {
    return [];
  }
}

function saveInbox(emails: EmailMessage[]) {
  mkdirSync(emailsDir, { recursive: true });
  writeFileSync(inboxPath, JSON.stringify(emails, null, 2), "utf-8");
}

function addEmail(email: EmailMessage) {
  const inbox = getInbox();
  // Avoid duplicates
  if (inbox.some((e) => e.id === email.id)) return;
  inbox.unshift(email);
  saveInbox(inbox);
}

export function getEmails(): EmailMessage[] {
  return getInbox();
}

export function markRead(id: string) {
  const inbox = getInbox();
  const email = inbox.find((e) => e.id === id);
  if (email) {
    email.read = true;
    saveInbox(inbox);
  }
}

export function deleteEmail(id: string) {
  const inbox = getInbox();
  saveInbox(inbox.filter((e) => e.id !== id));
}

export function getUnreadCount(): number {
  return getInbox().filter((e) => !e.read).length;
}

export function isMonitoring(): boolean {
  // Check actual client health, not just the state file
  if (g.__emailClient && g.__emailClient.usable && g.__emailMonitoring) return true;
  // If state file says monitoring but client is dead, correct it
  if (!g.__emailClient || !g.__emailClient.usable) {
    if (g.__emailMonitoring) {
      g.__emailMonitoring = false;
      try { writeFileSync(statePath, JSON.stringify({ monitoring: false }), "utf-8"); } catch {}
    }
    return false;
  }
  return getMonitoringState();
}

async function processEmail(uid: number, imapClient: ImapFlow) {
  try {
    // First fetch just the envelope to check size/subject
    const messages = imapClient.fetch(
      { uid },
      { source: true, envelope: true }
    );

    for await (const msg of messages) {
      if (!msg.source) continue;
      const parsed = await simpleParser(msg.source);
      const messageId = msg.envelope.messageId || `uid-${uid}-${Date.now()}`;

      // Check if already processed
      const existing = getInbox();
      if (existing.some((e) => e.id === messageId)) continue;

      // Save attachments
      mkdirSync(attachmentsDir, { recursive: true });
      const savedAttachments: EmailMessage["attachments"] = [];

      for (const att of parsed.attachments || []) {
        const safeName = (att.filename || `attachment-${Date.now()}`).replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );
        const savePath = path.join(attachmentsDir, `${uid}-${safeName}`);
        writeFileSync(savePath, att.content);
        savedAttachments.push({
          filename: att.filename || safeName,
          size: att.size,
          contentType: att.contentType,
          savedPath: savePath,
        });
      }

      const body = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>/g, " ").slice(0, 5000) : "");

      // AI analysis with memory
      let aiSummary: string | null = null;
      let category: EmailMessage["category"] = null;
      let priority: EmailMessage["priority"] = null;
      let actionItems: string[] = [];

      try {
        const memory = getMemory();
        const attachmentInfo = savedAttachments.length > 0
          ? `\nAttachments: ${savedAttachments.map((a) => `${a.filename} (${a.contentType}, ${Math.round(a.size / 1024)}KB)`).join(", ")}`
          : "";

        const fromAddr = msg.envelope.from?.[0]?.address || "unknown";
        const fromName = msg.envelope.from?.[0]?.name || fromAddr;
        const knownContact = memory.contacts[fromAddr];
        const contactContext = knownContact
          ? `\nKnown contact: ${knownContact.name} (${knownContact.relationship}). Previous topics: ${knownContact.topics.join(", ")}. Notes: ${knownContact.notes}`
          : "";

        const memoryContext = `
WHAT I KNOW ABOUT THE USER:
${memory.aboutUser || "Nothing yet — this is a new user. Learn about them from this email."}

ACTIVE PROJECTS: ${memory.workContext.activeProjects.join(", ") || "None known yet"}
RECENT TOPICS: ${memory.workContext.recentTopics.join(", ") || "None yet"}
PENDING ACTIONS: ${memory.workContext.pendingActions.join(", ") || "None"}
KNOWN PATTERNS: ${memory.patterns.join(". ") || "None yet"}
${contactContext}`;

        const analysisPrompt = `You are a Producer's Assistant — an AI built for music producers. You're building a long-term understanding of this producer, their sessions, clients, collaborators, and career. Analyze this email through the lens of music production and the music industry. Analyze this email and return a JSON response.

${memoryContext}

EMAIL:
From: ${fromName} <${fromAddr}>
Subject: ${msg.envelope.subject || "No subject"}
Date: ${msg.envelope.date?.toISOString() || "unknown"}
${attachmentInfo}

Body:
${body.slice(0, 4000)}

Return ONLY valid JSON with this exact structure:
{
  "summary": "A concise summary of ONLY what the email actually says. Do NOT add suggestions, recommendations, or next steps that aren't explicitly stated in the email. Just summarize the actual content. Example: 'John says there's a session on 5/4 with Brandy and Chris Brown.'",
  "category": "work" | "personal" | "newsletter" | "notification" | "spam",
  "priority": "high" | "medium" | "low" — PRIORITY RULES: HIGH = has a specific date/deadline within 7 days, session booking, time-sensitive request, or urgent revision. MEDIUM = has a date/deadline further out, ongoing project discussion, or general work request. LOW = informational, no deadline, or FYI emails. Calendar dates and deadlines are the #1 factor in priority.,
  "actionItems": ["ONLY actions explicitly requested or clearly implied in the email. Do NOT invent or suggest actions that aren't in the message. If the email is just informational, return an empty array."],
  "aboutUser": "Updated comprehensive description of who this producer is — their genre specialties, DAW, studio setup, clients, rates, workflow preferences, career stage, and work style. Build on what you already know and add new info from this email. If nothing new, return the existing description unchanged.",
  "contactUpdate": {
    "email": "${fromAddr}",
    "name": "${fromName}",
    "relationship": "their relationship to the producer (artist, client, A&R, manager, engineer, songwriter, label rep, publisher, studio, booking agent, collaborator, friend, service, etc.) — use 'unknown' if unclear. IMPORTANT: this is about the PERSON who sent the email, NOT about attachments or files",
    "topics": ["topics discussed in this email"],
    "notes": "relevant context about this person"
  },
  "workContext": {
    "newProjects": ["any new projects/sessions/songs/albums mentioned"],
    "newTopics": ["new work topics — sessions, mixes, masters, placements, pitches, releases, etc."],
    "newActions": ["action items — mix revisions, session prep, file delivery, follow-ups, etc."],
    "completedActions": ["any previously pending actions that this email resolves"],
    "newDates": ["session dates, deadlines, release dates, meetings — formatted as 'event - date'"]
  },
  "newPatterns": ["any observations about the producer's workflow, communication style, client preferences, or business patterns"]
}`;

        const result = await callClaude(
          "You are a Producer's Assistant — an intelligent email analyst for a music producer. Your expertise covers the entire music industry: production, mixing, mastering, engineering, songwriting, beat-making, recording sessions, A&R, artist management, label relations, publishing, sync licensing, distribution, royalties, booking, touring, and all related business. You understand industry terminology, workflows, and relationships (artists, engineers, managers, A&R reps, publishers, labels, studios, etc.). Analyze emails through this lens — prioritize industry-related emails, identify session bookings, mix revision requests, pitch opportunities, contract/deal discussions, and creative deadlines. For non-music emails (spam, newsletters, personal), still categorize them but keep analysis brief. Return ONLY valid JSON, no markdown, no explanation.",
          analysisPrompt
        );

        const analysis = JSON.parse(result);

        aiSummary = analysis.summary || null;
        category = analysis.category || null;
        priority = analysis.priority || null;
        actionItems = analysis.actionItems || [];

        // Update persistent memory
        updateMemoryFromAnalysis({
          aboutUser: analysis.aboutUser,
          contactUpdates: analysis.contactUpdate ? [analysis.contactUpdate] : [],
          workContext: analysis.workContext,
          newPatterns: analysis.newPatterns,
        });

      } catch (err) {
        console.error("[Email Monitor] AI analysis failed:", err);
      }

      const email: EmailMessage = {
        id: messageId,
        uid,
        from: msg.envelope.from?.[0]?.address || "unknown",
        fromName: msg.envelope.from?.[0]?.name || msg.envelope.from?.[0]?.address || "Unknown",
        to: msg.envelope.to?.[0]?.address || "unknown",
        subject: msg.envelope.subject || "(No subject)",
        date: msg.envelope.date?.toISOString() || new Date().toISOString(),
        body: body.slice(0, 10000),
        attachments: savedAttachments,
        aiSummary,
        category,
        priority,
        actionItems,
        read: false,
      };

      // Save work emails + anything that mentions sessions, artists, or music industry terms
      // (Claude sometimes miscategorizes casual-tone work emails as "personal")
      const bodyLower = body.toLowerCase();
      const subjectLower = (msg.envelope.subject || "").toLowerCase();
      const textToCheck = bodyLower + " " + subjectLower;
      const musicKeywords = /\b(session|studio|mix|master|track|beat|vocal|record|album|ep|single|feature|collab|verse|hook|chorus|stems|bounce|a&r|label|publish|sync|placement|pitch|song|demo|sample|loop|melody|instrumental|producer|artist|release|camp|writing|songwriter|gig|show|tour|rehearsal)\b/i;
      const hasAudioAttachment = savedAttachments.some((a) => a.contentType.startsWith("audio/"));
      const isLikelyWork = category === "work" || musicKeywords.test(textToCheck) || hasAudioAttachment;

      if (isLikelyWork) {
        if (category !== "work") email.category = "work";
        addEmail(email);
        console.log(`[Email Monitor] New email from ${email.fromName}: ${email.subject} (category: ${category}${category !== "work" ? " → promoted to work" : ""})`);
      } else {
        console.log(`[Email Monitor] Skipped non-work email (${category}): ${email.subject}`);
      }

      // Mark as seen on server
      try {
        await imapClient.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      } catch {}
    }
  } catch (err) {
    console.error("[Email Monitor] Error processing email:", err);
  }
}

export async function startMonitoring(config: {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure?: boolean;
}) {
  if (g.__emailMonitoring && g.__emailClient) {
    console.log("[Email Monitor] Already monitoring");
    return;
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure ?? true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  try {
    await client.connect();
    console.log("[Email Monitor] Connected to IMAP server");

    g.__emailLock = await client.getMailboxLock("INBOX");
    g.__emailClient = client;
    setMonitoringState(true);

    // Check if first scan for this account
    const isFirstScan = !getScannedAccounts()[config.user];
    let searchSince: Date;

    if (isFirstScan) {
      searchSince = new Date();
      searchSince.setDate(searchSince.getDate() - 14);
      searchSince.setHours(0, 0, 0, 0);
      console.log(`[Email Monitor] First scan for ${config.user} — checking 2 weeks back`);
    } else {
      searchSince = new Date();
      searchSince.setHours(0, 0, 0, 0);
    }

    const initialEmails = await client.search({ since: searchSince }, { uid: true });
    console.log(`[Email Monitor] Found ${initialEmails.length} emails to process`);

    for (const uid of initialEmails) {
      await processEmail(uid, client);
    }

    if (isFirstScan) {
      markAccountScanned(config.user);
      console.log(`[Email Monitor] Initial scan complete for ${config.user}`);
    }

    // Start IDLE loop — waits for new emails
    idleLoop(client);
  } catch (err) {
    console.error("[Email Monitor] Connection failed:", err);
    setMonitoringState(false);
    throw err;
  }
}

async function idleLoop(imapClient: ImapFlow) {
  // Listen for new emails via IDLE
  imapClient.on("exists", async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recent = await imapClient.search({ since: today }, { uid: true });
      for (const uid of recent) {
        await processEmail(uid, imapClient);
      }
    } catch (err) {
      console.error("[Email Monitor] Error on new email:", err);
    }
  });

  // Polling fallback — check every 60s in case IDLE misses something
  const pollInterval = setInterval(async () => {
    if (!g.__emailMonitoring || !imapClient.usable) {
      clearInterval(pollInterval);
      return;
    }
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recent = await imapClient.search({ since: today }, { uid: true });
      for (const uid of recent) {
        await processEmail(uid, imapClient);
      }
    } catch (err) {
      console.error("[Email Monitor] Poll error:", err);
    }
  }, 15000);

  while (g.__emailMonitoring && imapClient.usable) {
    try {
      await imapClient.idle();
    } catch (err) {
      if (!g.__emailMonitoring) break;
      console.error("[Email Monitor] IDLE error, reconnecting in 10s:", err);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  clearInterval(pollInterval);
}

export async function stopMonitoring() {
  setMonitoringState(false);
  if (g.__emailLock) {
    try { g.__emailLock.release(); } catch {}
    g.__emailLock = null;
  }
  if (g.__emailClient) {
    try { await g.__emailClient.logout(); } catch {}
    g.__emailClient = null;
  }
  console.log("[Email Monitor] Stopped");
}
