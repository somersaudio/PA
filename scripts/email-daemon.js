#!/usr/bin/env node

/**
 * Standalone email monitoring daemon.
 * Runs outside Next.js so it doesn't get killed by hot-reloads.
 * Saves emails to data/emails/inbox.json for the app to read.
 */

const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) env[match[1]] = match[2].replace(/^"|"$/g, "");
}

const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
const IMAP_HOST = env.IMAP_HOST || "imap.mail.me.com";
const IMAP_PORT = parseInt(env.IMAP_PORT || "993");
const IMAP_USER = env.IMAP_USER;
const IMAP_PASS = env.IMAP_PASS;

const emailsDir = path.join(__dirname, "..", "data", "emails");
const attachmentsDir = path.join(emailsDir, "attachments");
const inboxPath = path.join(emailsDir, "inbox.json");
const memoryPath = path.join(emailsDir, "memory.json");
const statePath = path.join(emailsDir, "monitor-state.json");
const scannedPath = path.join(emailsDir, "scanned-accounts.json");

fs.mkdirSync(attachmentsDir, { recursive: true });

function getScannedAccounts() {
  try { return JSON.parse(fs.readFileSync(scannedPath, "utf-8")); } catch { return {}; }
}

function markAccountScanned(email) {
  const scanned = getScannedAccounts();
  scanned[email] = new Date().toISOString();
  fs.writeFileSync(scannedPath, JSON.stringify(scanned, null, 2), "utf-8");
}

function getInbox() {
  try { return JSON.parse(fs.readFileSync(inboxPath, "utf-8")); } catch { return []; }
}

function saveInbox(emails) {
  fs.writeFileSync(inboxPath, JSON.stringify(emails, null, 2), "utf-8");
}

function getMemory() {
  try { return JSON.parse(fs.readFileSync(memoryPath, "utf-8")); }
  catch { return { aboutUser: "", contacts: {}, workContext: { activeProjects: [], recentTopics: [], pendingActions: [], importantDates: [] }, patterns: [], lastUpdated: "" }; }
}

function saveMemory(memory) {
  memory.lastUpdated = new Date().toISOString();
  fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2), "utf-8");
}

function setState(monitoring) {
  fs.writeFileSync(statePath, JSON.stringify({ monitoring }), "utf-8");
}

async function callClaude(systemPrompt, userMessage) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function processEmail(uid, client) {
  try {
    for await (const msg of client.fetch({ uid }, { source: true, envelope: true })) {
      if (!msg.source) continue;
      const parsed = await simpleParser(msg.source);
      const messageId = msg.envelope.messageId || `uid-${uid}-${Date.now()}`;

      const existing = getInbox();
      if (existing.some(e => e.id === messageId)) continue;

      // Save attachments
      const savedAttachments = [];
      for (const att of parsed.attachments || []) {
        const safeName = (att.filename || `attachment-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "_");
        const savePath = path.join(attachmentsDir, `${uid}-${safeName}`);
        fs.writeFileSync(savePath, att.content);
        savedAttachments.push({
          filename: att.filename || safeName,
          size: att.size,
          contentType: att.contentType,
          savedPath: savePath,
        });
      }

      const body = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>/g, " ").slice(0, 5000) : "");
      const fromAddr = msg.envelope.from?.[0]?.address || "unknown";
      const fromName = msg.envelope.from?.[0]?.name || fromAddr;

      // AI analysis
      let aiSummary = null;
      let category = null;
      let priority = null;
      let actionItems = [];

      try {
        const memory = getMemory();
        const attachmentInfo = savedAttachments.length > 0
          ? `\nAttachments: ${savedAttachments.map(a => `${a.filename} (${a.contentType}, ${Math.round(a.size / 1024)}KB)`).join(", ")}`
          : "";

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

        const result = await callClaude(
          "You are a Producer's Assistant — an intelligent email analyst for a music producer. Your expertise covers the entire music industry: production, mixing, mastering, engineering, songwriting, beat-making, recording sessions, A&R, artist management, label relations, publishing, sync licensing, distribution, royalties, booking, touring, and all related business. You understand industry terminology, workflows, and relationships (artists, engineers, managers, A&R reps, publishers, labels, studios, etc.). Analyze emails through this lens — prioritize industry-related emails, identify session bookings, mix revision requests, pitch opportunities, contract/deal discussions, and creative deadlines. For non-music emails (spam, newsletters, personal), still categorize them but keep analysis brief. Return ONLY valid JSON, no markdown, no explanation.",
          `You are a Producer's Assistant — an AI built for music producers. You're building a long-term understanding of this producer, their sessions, clients, collaborators, and career. Analyze this email through the lens of music production and the music industry. Analyze this email and return a JSON response.

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
  "summary": "A concise producer-focused summary: WHO is this from and what's their role, WHAT do they need, WHEN is the deadline if any, and WHAT should the producer do next. Be direct and skip pleasantries. Example: 'Artist Jake needs vocal stems bounced for the Summer EP by Friday. Wants 24-bit WAV with no processing.'",
  "category": "work" | "personal" | "newsletter" | "notification" | "spam",
  "priority": "high" | "medium" | "low" — PRIORITY RULES: HIGH = has a specific date/deadline within 7 days, session booking, time-sensitive request, or urgent revision. MEDIUM = has a date/deadline further out, ongoing project discussion, or general work request. LOW = informational, no deadline, or FYI emails. Calendar dates and deadlines are the #1 factor in priority.,
  "actionItems": [],
  "aboutUser": "Updated description of the producer...",
  "contactUpdate": { "email": "${fromAddr}", "name": "${fromName}", "relationship": "relationship to the producer (artist, client, A&R, engineer, manager, label, publisher, etc.) — use 'unknown' if unclear. IMPORTANT: this is about the PERSON who sent the email, NOT about attachments or files", "topics": ["topics discussed"], "notes": "relevant context about this person" },
  "workContext": { "newProjects": [], "newTopics": [], "newActions": [], "completedActions": [], "newDates": [] },
  "newPatterns": []
}`
        );

        const analysis = JSON.parse(result);
        aiSummary = analysis.summary || null;
        category = analysis.category || null;
        priority = analysis.priority || null;
        actionItems = analysis.actionItems || [];

        // Update memory
        const mem = getMemory();
        if (analysis.aboutUser) mem.aboutUser = analysis.aboutUser;
        if (analysis.contactUpdate) {
          const cu = analysis.contactUpdate;
          const existing = mem.contacts[cu.email];
          if (existing) {
            existing.name = cu.name || existing.name;
            existing.relationship = cu.relationship || existing.relationship;
            if (cu.topics) existing.topics = [...new Set([...existing.topics, ...cu.topics])].slice(-20);
            if (cu.notes) existing.notes = cu.notes;
            existing.lastSeen = new Date().toISOString();
          } else {
            mem.contacts[cu.email] = { ...cu, lastSeen: new Date().toISOString(), topics: cu.topics || [] };
          }
        }
        if (analysis.workContext) {
          const wc = mem.workContext;
          if (analysis.workContext.newProjects) wc.activeProjects = [...new Set([...wc.activeProjects, ...analysis.workContext.newProjects])].slice(-20);
          if (analysis.workContext.newTopics) wc.recentTopics = [...new Set([...analysis.workContext.newTopics, ...wc.recentTopics])].slice(0, 30);
          if (analysis.workContext.newActions) wc.pendingActions = [...wc.pendingActions, ...analysis.workContext.newActions].slice(-30);
          if (analysis.workContext.newDates) wc.importantDates = [...wc.importantDates, ...analysis.workContext.newDates].slice(-20);
        }
        if (analysis.newPatterns) mem.patterns = [...new Set([...mem.patterns, ...analysis.newPatterns])].slice(-20);
        saveMemory(mem);

      } catch (err) {
        console.error("[Email Daemon] AI analysis failed:", err.message);
      }

      // Only save work emails
      if (category !== "work") {
        console.log(`  Skipped (${category}): ${msg.envelope.subject}`);
        continue;
      }

      const email = {
        id: messageId,
        uid,
        from: fromAddr,
        fromName,
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

      const inbox = getInbox();
      inbox.unshift(email);
      saveInbox(inbox);
      console.log(`  ✓ Saved: ${email.subject} (${priority} priority)`);
    }
  } catch (err) {
    console.error(`[Email Daemon] Error processing UID ${uid}:`, err.message);
  }
}

async function main() {
  if (!IMAP_USER || !IMAP_PASS) {
    console.error("Set IMAP_USER and IMAP_PASS in .env.local");
    process.exit(1);
  }

  console.log(`[Email Daemon] Connecting to ${IMAP_HOST} as ${IMAP_USER}...`);

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
  });

  await client.connect();
  console.log("[Email Daemon] Connected");

  const lock = await client.getMailboxLock("INBOX");
  setState(true);

  // Check if this is the first time scanning this account
  const scannedAccounts = getScannedAccounts();
  const isFirstScan = !scannedAccounts[IMAP_USER];

  let searchSince;
  if (isFirstScan) {
    // First time: scan 2 weeks back
    searchSince = new Date();
    searchSince.setDate(searchSince.getDate() - 14);
    searchSince.setHours(0, 0, 0, 0);
    console.log(`[Email Daemon] First scan for ${IMAP_USER} — checking 2 weeks back`);
  } else {
    // Subsequent: today only
    searchSince = new Date();
    searchSince.setHours(0, 0, 0, 0);
  }

  const initialEmails = await client.search({ since: searchSince }, { uid: true });
  console.log(`[Email Daemon] ${initialEmails.length} emails to process`);

  for (const uid of initialEmails) {
    await processEmail(uid, client);
  }

  if (isFirstScan) {
    markAccountScanned(IMAP_USER);
    console.log(`[Email Daemon] Initial scan complete for ${IMAP_USER}`);
  }

  console.log("[Email Daemon] Now listening for new emails...");

  // Listen for new emails
  client.on("exists", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recent = await client.search({ since: today }, { uid: true });
    for (const uid of recent) {
      await processEmail(uid, client);
    }
  });

  // IDLE loop
  while (true) {
    try {
      await client.idle();
    } catch (err) {
      console.error("[Email Daemon] IDLE error:", err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Cleanup on exit
process.on("SIGINT", () => {
  setState(false);
  console.log("\n[Email Daemon] Stopped");
  process.exit(0);
});

process.on("SIGTERM", () => {
  setState(false);
  process.exit(0);
});

main().catch(err => {
  console.error("[Email Daemon] Fatal:", err.message);
  setState(false);
  process.exit(1);
});
