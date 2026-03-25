import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Tool definitions for Claude
export const tools: Anthropic.Tool[] = [
  {
    name: "read_emails",
    description: "Read recent emails from the inbox. Returns the latest emails with summaries, categories, and action items.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of emails to return (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "search_contacts",
    description: "Search the producer's contact memory for information about a person by name or email.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Name or email to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_producer_memory",
    description: "Get everything the AI knows about the producer — their profile, active projects, pending actions, important dates, and work patterns.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_sessions",
    description: "Get all recording/mixing sessions. Note: collaborators are stored separately — use get_session_detail for full info.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_session_detail",
    description: "Get full details of a session including notes, collaborators, and audio files. Always use this when the user asks about a specific session.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "number", description: "The session ID" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "add_session_note",
    description: "Add a note to an existing session. Use this when the user wants to write a note, reminder, or any text to a session.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "number", description: "The session ID to add the note to" },
        content: { type: "string", description: "The note content" },
      },
      required: ["sessionId", "content"],
    },
  },
  {
    name: "get_session_notes",
    description: "Get all notes for a session, including their IDs so they can be deleted.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "number", description: "The session ID" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "delete_session_note",
    description: "Delete a specific note from a session by note ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        noteId: { type: "number", description: "The note ID to delete" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "delete_all_session_notes",
    description: "Delete all notes from a session.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "number", description: "The session ID to clear all notes from" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "update_session_status",
    description: "Update the status of a session (scheduled, in-progress, completed, archived).",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "number", description: "The session ID" },
        status: { type: "string", description: "New status: scheduled, in-progress, completed, or archived" },
      },
      required: ["sessionId", "status"],
    },
  },
  {
    name: "add_collaborator",
    description: "Add a collaborator (artist, writer, engineer, etc.) to a session.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "number", description: "The session ID" },
        name: { type: "string", description: "Collaborator name" },
        role: { type: "string", description: "Role: artist, writer, engineer, producer, vocalist, musician, mixer, other" },
      },
      required: ["sessionId", "name"],
    },
  },
  {
    name: "create_session",
    description: "Create a new session for a recording or mixing project.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectName: { type: "string", description: "Name of the project" },
        artistName: { type: "string", description: "Artist name" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
      },
      required: ["projectName", "date"],
    },
  },
  {
    name: "delete_session",
    description: "Delete a session by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "number", description: "Session ID to delete" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "like_song",
    description: "Like or unlike a song in the library.",
    input_schema: {
      type: "object" as const,
      properties: {
        filename: { type: "string", description: "The MP3 filename" },
        liked: { type: "boolean", description: "true to like, false to unlike" },
      },
      required: ["filename", "liked"],
    },
  },
  {
    name: "delete_song",
    description: "Delete a song from the library.",
    input_schema: {
      type: "object" as const,
      properties: {
        filename: { type: "string", description: "The MP3 filename to delete" },
      },
      required: ["filename"],
    },
  },
  {
    name: "play_song",
    description: "Play a song from the library by filename or title. Can also pause, or seek to a time.",
    input_schema: {
      type: "object" as const,
      properties: {
        filename: { type: "string", description: "The MP3 filename to play" },
        action: { type: "string", description: "play, pause, or seek" },
        seekTime: { type: "number", description: "Time in seconds to seek to (only for seek action)" },
      },
      required: ["filename", "action"],
    },
  },
  {
    name: "set_pitch",
    description: "Set the pitch shift in semitones for the currently playing song. Positive = higher, negative = lower, 0 = normal.",
    input_schema: {
      type: "object" as const,
      properties: {
        semitones: { type: "number", description: "Semitones to shift (-12 to 12)" },
      },
      required: ["semitones"],
    },
  },
  {
    name: "add_audio_to_session",
    description: "Add an audio file from the song library to a session.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "number", description: "Session ID" },
        filename: { type: "string", description: "The MP3 filename from the library" },
      },
      required: ["sessionId", "filename"],
    },
  },
  {
    name: "delete_email",
    description: "Delete an email from the inbox by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        emailId: { type: "string", description: "The email ID to delete" },
      },
      required: ["emailId"],
    },
  },
  {
    name: "start_email_monitoring",
    description: "Start monitoring the email inbox for new emails.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "set_theme",
    description: "Change the app theme. Options: default, blue-wave, green-wave.",
    input_schema: {
      type: "object" as const,
      properties: {
        theme: { type: "string", description: "Theme name: default, blue-wave, or green-wave" },
      },
      required: ["theme"],
    },
  },
  {
    name: "create_mix_note",
    description: "Create a mix note that gets parsed into SoundFlow commands for Pro Tools. Use natural language like 'turn the vocal up 2dB'.",
    input_schema: {
      type: "object" as const,
      properties: {
        note: { type: "string", description: "Natural language mix instruction" },
      },
      required: ["note"],
    },
  },
  {
    name: "run_protools_agent",
    description: "Run the agentic Pro Tools mix engineer. It can see Pro Tools (via screenshots), read track info, adjust volumes/pans/mutes/solos, control plugins, and verify changes visually. Use for complex mix tasks.",
    input_schema: {
      type: "object" as const,
      properties: {
        instruction: { type: "string", description: "What to do in Pro Tools (e.g. 'make the vocal sit better' or 'check the levels on all tracks')" },
        mode: { type: "string", enum: ["supervised", "semi-autonomous", "autonomous"], description: "Agent autonomy level. Default: supervised." },
      },
      required: ["instruction"],
    },
  },
  {
    name: "get_song_library",
    description: "Get all songs in the Suno song library with their BPM, key, and weirdness info.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "run_soundflow_command",
    description: "Run a SoundFlow command by name or ID. This executes a pre-registered Pro Tools command via SoundFlow CLI. Use list_soundflow_commands first to find the right command.",
    input_schema: {
      type: "object" as const,
      properties: {
        commandId: { type: "string", description: "The SoundFlow command ID to run" },
        commandName: { type: "string", description: "Optional: the command name (for logging)" },
      },
      required: ["commandId"],
    },
  },
  {
    name: "list_soundflow_commands",
    description: "Search the SoundFlow commands library. Returns matching commands with their IDs. Use this to find the right command ID before running it.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (matches name and description). Leave empty to get all." },
      },
      required: [],
    },
  },
  {
    name: "run_shell_command",
    description: "Run a shell command on the user's Mac. Use for file operations, opening apps, or any system task. Be careful with destructive commands.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "The shell command to run" },
      },
      required: ["command"],
    },
  },
  {
    name: "open_url",
    description: "Open a URL in the user's Chrome browser.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL to open" },
      },
      required: ["url"],
    },
  },
  {
    name: "generate_suno_prompt",
    description: "Generate a Suno AI music prompt from a list of artists or a description. Does NOT launch Suno — use launch_suno_generation after this.",
    input_schema: {
      type: "object" as const,
      properties: {
        artists: { type: "string", description: "Comma-separated artist names or a music style description" },
        extraPrompt: { type: "string", description: "Additional style notes" },
      },
      required: ["artists"],
    },
  },
  {
    name: "launch_suno_generation",
    description: "Queue a Suno generation that the Spotify+Suno form will pick up and execute. Provide artists/style description and count. The form handles prompt generation, numbering, folder creation, polling, and downloads automatically.",
    input_schema: {
      type: "object" as const,
      properties: {
        artists: { type: "string", description: "Artist names or style description (e.g. 'The Weeknd x Drake x PartyNextDoor')" },
        count: { type: "number", description: "Number of songs to generate (default 4)" },
        weirdness1: { type: "number", description: "Weirdness level (0-100) for odd-numbered songs. Default 55." },
        weirdness2: { type: "number", description: "Weirdness level (0-100) for even-numbered songs. Default 55." },
        extraPrompt: { type: "string", description: "Additional style notes to include" },
      },
      required: ["artists"],
    },
  },
];

// Tool execution
export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const { execSync } = await import("child_process");
  const fs = await import("fs");
  const path = await import("path");

  switch (name) {
    case "read_emails": {
      const inboxPath = path.join(process.cwd(), "data", "emails", "inbox.json");
      try {
        const emails = JSON.parse(fs.readFileSync(inboxPath, "utf-8"));
        const limit = (input.limit as number) || 10;
        return JSON.stringify(emails.slice(0, limit).map((e: Record<string, unknown>) => ({
          from: e.fromName, subject: e.subject, date: e.date, summary: e.aiSummary, category: e.category, priority: e.priority, actionItems: e.actionItems,
        })));
      } catch { return "No emails found."; }
    }

    case "search_contacts": {
      const memPath = path.join(process.cwd(), "data", "emails", "memory.json");
      try {
        const memory = JSON.parse(fs.readFileSync(memPath, "utf-8"));
        const query = (input.query as string).toLowerCase();
        const matches = Object.values(memory.contacts || {}).filter((c: unknown) => {
          const contact = c as Record<string, unknown>;
          return (contact.name as string)?.toLowerCase().includes(query) || (contact.email as string)?.toLowerCase().includes(query);
        });
        return matches.length > 0 ? JSON.stringify(matches) : `No contacts found matching "${input.query}".`;
      } catch { return "No contact memory available yet."; }
    }

    case "get_producer_memory": {
      const memPath = path.join(process.cwd(), "data", "emails", "memory.json");
      try {
        const memory = JSON.parse(fs.readFileSync(memPath, "utf-8"));
        return JSON.stringify({
          aboutUser: memory.aboutUser,
          activeProjects: memory.workContext?.activeProjects,
          recentTopics: memory.workContext?.recentTopics,
          pendingActions: memory.workContext?.pendingActions,
          importantDates: memory.workContext?.importantDates,
          patterns: memory.patterns,
          contactCount: Object.keys(memory.contacts || {}).length,
        });
      } catch { return "No memory built yet. It grows as emails are processed."; }
    }

    case "get_sessions": {
      const { db } = await import("@/db");
      const { sessions } = await import("@/db/schema");
      const { desc } = await import("drizzle-orm");
      const all = db.select().from(sessions).orderBy(desc(sessions.date)).all();
      return JSON.stringify(all);
    }

    case "get_session_detail": {
      const { getSession } = await import("@/actions/sessions");
      const session = await getSession(input.sessionId as number);
      if (!session) return "Session not found";

      // Get collaborators
      const collabPath = path.join(process.cwd(), "data", "session-collaborators.json");
      let collabs: Array<{ name: string; role: string }> = [];
      try {
        const allCollabs = JSON.parse(fs.readFileSync(collabPath, "utf-8"));
        collabs = allCollabs[String(input.sessionId)] || [];
      } catch {}

      // Parse audio files
      const audioFiles = ((session.fileReferences as string[]) || []).map((ref: string) => {
        try { return JSON.parse(ref); } catch { return null; }
      }).filter(Boolean);

      return JSON.stringify({
        ...session,
        collaborators: collabs,
        audioFiles,
      });
    }

    case "add_session_note": {
      const { addSessionNote } = await import("@/actions/sessions");
      await addSessionNote(input.sessionId as number, input.content as string);
      return `Note added to session: "${input.content}"`;
    }

    case "get_session_notes": {
      const { db } = await import("@/db");
      const { sessionNotes } = await import("@/db/schema");
      const { eq, desc } = await import("drizzle-orm");
      const notes = db.select().from(sessionNotes).where(eq(sessionNotes.sessionId, input.sessionId as number)).orderBy(desc(sessionNotes.timestamp)).all();
      return JSON.stringify(notes);
    }

    case "delete_session_note": {
      const { deleteSessionNote } = await import("@/actions/sessions");
      await deleteSessionNote(input.noteId as number);
      return `Note ${input.noteId} deleted`;
    }

    case "delete_all_session_notes": {
      const { db } = await import("@/db");
      const { sessionNotes } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      db.delete(sessionNotes).where(eq(sessionNotes.sessionId, input.sessionId as number)).run();
      return `All notes deleted from session ${input.sessionId}`;
    }

    case "update_session_status": {
      const { updateSession } = await import("@/actions/sessions");
      await updateSession(input.sessionId as number, { status: input.status as "scheduled" | "in-progress" | "completed" | "archived" });
      return `Session status updated to "${input.status}"`;
    }

    case "add_collaborator": {
      const fs2 = await import("fs");
      const path2 = await import("path");
      const collabPath = path2.join(process.cwd(), "data", "session-collaborators.json");
      let all: Record<string, Array<{ name: string; role: string }>> = {};
      try { all = JSON.parse(fs2.readFileSync(collabPath, "utf-8")); } catch {}
      const sid = String(input.sessionId);
      if (!all[sid]) all[sid] = [];
      if (!all[sid].some((c) => c.name === input.name)) {
        all[sid].push({ name: input.name as string, role: (input.role as string) || "artist" });
      }
      fs2.mkdirSync(path2.dirname(collabPath), { recursive: true });
      fs2.writeFileSync(collabPath, JSON.stringify(all, null, 2), "utf-8");
      return `Added ${input.name} as ${input.role || "artist"} to session`;
    }

    case "create_session": {
      const { createSession } = await import("@/actions/sessions");
      const session = await createSession({
        projectName: input.projectName as string,
        artistName: input.artistName as string,
        date: input.date as string,
      });
      return `Session created: "${session.projectName}" on ${session.date}`;
    }

    case "delete_session": {
      const { deleteSession } = await import("@/actions/sessions");
      await deleteSession(input.sessionId as number);
      return `Session ${input.sessionId} deleted`;
    }

    case "like_song": {
      await fetch(`http://localhost:3000/api/suno/library/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: input.filename, liked: input.liked }),
      });
      return `Song ${input.liked ? "liked" : "unliked"}: ${input.filename}`;
    }

    case "delete_song": {
      await fetch(`http://localhost:3000/api/suno/library/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: input.filename }),
      });
      return `Song deleted: ${input.filename}`;
    }

    case "play_song": {
      // Return instruction for client — actual playback handled client-side
      return JSON.stringify({ action: input.action, filename: input.filename, seekTime: input.seekTime });
    }

    case "set_pitch": {
      return JSON.stringify({ action: "set_pitch", semitones: input.semitones });
    }

    case "add_audio_to_session": {
      const filePath = path.join("downloads", input.filename as string);
      const res = await fetch("http://localhost:3000/api/sessions/add-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: input.sessionId, filePath, filename: input.filename }),
      });
      const data = await res.json();
      return data.message || data.error || "Done";
    }

    case "delete_email": {
      const inboxPath = path.join(process.cwd(), "data", "emails", "inbox.json");
      try {
        const emails = JSON.parse(fs.readFileSync(inboxPath, "utf-8"));
        const filtered = emails.filter((e: { id: string }) => e.id !== input.emailId);
        fs.writeFileSync(inboxPath, JSON.stringify(filtered, null, 2), "utf-8");
        return `Email deleted`;
      } catch { return "Failed to delete email"; }
    }

    case "start_email_monitoring": {
      try {
        await fetch("http://localhost:3000/api/email/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        return "Email monitoring started";
      } catch { return "Failed to start monitoring"; }
    }

    case "set_theme": {
      // Theme is client-side only — return instruction
      return JSON.stringify({ action: "set_theme", theme: input.theme });
    }

    case "create_mix_note": {
      const { createMixNote } = await import("@/actions/mix-notes");
      const note = await createMixNote(input.note as string);
      return `Mix note created: "${note.rawText}" (ID: ${note.id})`;
    }

    case "run_protools_agent": {
      const { runMixAgent } = await import("@/lib/protools-agent");
      const result = await runMixAgent(
        input.instruction as string,
        (input.mode as "supervised" | "semi-autonomous" | "autonomous") || "supervised"
      );
      return result.summary;
    }

    case "get_song_library": {
      const libPath = path.join(process.cwd(), "downloads");
      try {
        const files = fs.readdirSync(libPath).filter((f: string) => f.endsWith(".mp3"));
        const meta = (() => { try { return JSON.parse(fs.readFileSync(path.join(libPath, "metadata.json"), "utf-8")); } catch { return {}; } })();
        return JSON.stringify(files.map((f: string) => ({
          filename: f,
          title: f.replace(/\s*\([^)]*\)\.mp3$/, "").replace(/\.mp3$/, ""),
          weirdness: meta[f]?.weirdness ?? null,
        })));
      } catch { return "No songs in library."; }
    }

    case "run_soundflow_command": {
      try {
        const result = execSync(`/usr/local/bin/soundflow run ${input.commandId}`, {
          encoding: "utf-8",
          timeout: 10000,
        }).trim();
        return `Command ${input.commandName || input.commandId} executed: ${result || "OK"}`;
      } catch (e: unknown) {
        const err = e as { stderr?: string; message?: string };
        return `Command failed: ${err.stderr?.trim() || err.message || "Unknown error"}`;
      }
    }

    case "list_soundflow_commands": {
      const cmdPath = path.join(process.cwd(), "data", "soundflow-commands.json");
      try {
        const allCmds = JSON.parse(fs.readFileSync(cmdPath, "utf-8")).commands || [];
        const query = ((input.query as string) || "").toLowerCase();
        const matches = query
          ? allCmds.filter((c: { name: string; description: string }) =>
              c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query)
            )
          : allCmds;
        // Limit to 50 for context window
        const limited = matches.slice(0, 50);
        return JSON.stringify(limited.map((c: { id: string; name: string; description: string }) => ({
          id: c.id,
          name: c.name,
          description: c.description.slice(0, 100),
        }))) + (matches.length > 50 ? `\n... and ${matches.length - 50} more. Narrow your search.` : "");
      } catch {
        return "No SoundFlow commands library found.";
      }
    }

    case "run_shell_command": {
      try {
        const output = execSync(input.command as string, { encoding: "utf-8", timeout: 30000 });
        return output || "(command completed with no output)";
      } catch (e: unknown) {
        return `Error: ${(e as Error).message}`;
      }
    }

    case "open_url": {
      try {
        execSync(`open "${input.url}"`, { encoding: "utf-8" });
        return `Opened ${input.url} in browser.`;
      } catch { return "Failed to open URL."; }
    }

    case "generate_suno_prompt": {
      const { callClaude } = await import("@/lib/claude");
      const prompt = await callClaude(
        "Generate a Suno AI music prompt under 1000 characters. Instrumental only. No artist names.",
        `Artists/style: ${input.artists}${input.extraPrompt ? `\nExtra: ${input.extraPrompt}` : ""}`
      );
      return prompt;
    }

    case "launch_suno_generation": {
      const artists = (input.artists as string) || "Playlist";
      const count = (input.count as number) || 4;
      const w1 = (input.weirdness1 as number) ?? 55;
      const w2 = (input.weirdness2 as number) ?? 55;
      const extraPrompt = (input.extraPrompt as string) || "";

      try {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/suno/queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artists, count, weirdness1: w1, weirdness2: w2, extraPrompt }),
        });
        const data = await res.json();
        if (!data.ok) return "Failed to queue Suno generation.";
        return `Queued ${count} songs for "${artists}". The Spotify+Suno form will pick it up and start generating — navigate there to watch progress.`;
      } catch (e: unknown) {
        return `Failed to queue: ${(e as Error).message}`;
      }
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export { client };
