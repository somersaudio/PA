import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "@/lib/claude";

const SUNO_PROMPT_SYSTEM = `You are a music expert and prompt engineer for Suno AI music generation.

The user will give you a list of songs (artist - title). Your job:
1. Analyze the combined musical DNA of ALL songs — genre, tempo, mood, instrumentation, vocal style, production techniques, song structure, and sonic textures.
2. Identify the MOST PROMINENT shared qualities and unique standout elements.
3. Synthesize them into a single Suno-compatible music generation prompt that captures the essence of what you'd get if you fused all these songs together.

CRITICAL RULES:
- NEVER mention any artist names, song titles, or album names in your output
- The prompt must be 800 characters or LESS. This is critical — count carefully
- Focus on: genre/subgenre, tempo/BPM feel, mood/energy, instrumentation, vocal style, production style, sonic textures, song structure hints
- The song MUST be instrumental — NO vocals, NO singing, NO lyrics. Focus purely on instrumentation, production, and sonic textures
- Be vivid and specific — use music production terminology
- The prompt should read as a single cohesive description, not a list
- Output ONLY the Suno prompt text, nothing else — no quotes, no explanation, no preamble`;

export async function POST(req: NextRequest) {
  try {
    const { songs, extraPrompt, forceBpm, forceKey } = await req.json();
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
      return NextResponse.json({ error: "songs array is required" }, { status: 400 });
    }

    const hasArtistsOnly = songs.every((s: { title: string }) => !s.title);

    let userMessage: string;
    if (hasArtistsOnly) {
      const artistList = songs.map((s: { artist: string }, i: number) =>
        `${i + 1}. ${s.artist}`
      ).join("\n");
      userMessage = `Here are the artists to fuse together:\n\n${artistList}\n\nAnalyze the combined musical style, production, and sound of ALL these artists. Generate a Suno prompt that captures the essence of what a song would sound like if these artists collaborated. Remember: NO artist names, and 1000 characters max.`;
    } else {
      const songList = songs.map((s: { artist: string; title: string }, i: number) =>
        `${i + 1}. ${s.artist} - ${s.title}`
      ).join("\n");
      userMessage = `Here are the songs from the playlist:\n\n${songList}\n\nGenerate a Suno prompt that fuses the essence of all these songs into one cohesive description. Remember: NO artist or song names, and 1000 characters max.`;
    }

    // Calculate how many characters the additions will use
    const prepends: string[] = [];
    if (forceKey) prepends.push(`Key of ${forceKey}`);
    if (forceBpm) prepends.push(`${forceBpm} BPM`);
    const prependStr = prepends.length > 0 ? `${prepends.join(". ")}. ` : "";
    const appendStr = extraPrompt ? `. ${extraPrompt.trim()}` : "";
    const reservedChars = prependStr.length + appendStr.length;
    const claudeLimit = Math.max(400, 800 - reservedChars);

    if (forceBpm) {
      userMessage += `\n\nCRITICAL: The BPM MUST be exactly ${forceBpm} BPM. Do NOT include BPM in your output — it will be added automatically.`;
    }
    if (forceKey) {
      userMessage += `\n\nCRITICAL: The musical key MUST be ${forceKey}. Do NOT include the key in your output — it will be added automatically.`;
    }
    if (extraPrompt) {
      userMessage += `\n\nAdditional direction from the user (incorporate the spirit of this but do NOT repeat it verbatim — it will be appended automatically): ${extraPrompt}`;
    }

    userMessage += `\n\nIMPORTANT: Your output must be ${claudeLimit} characters or LESS. Not 1000 — exactly ${claudeLimit} max.`;

    let prompt = await callClaude(SUNO_PROMPT_SYSTEM, userMessage);

    // Assemble final prompt: [Key/BPM] + [Claude output] + [extra prompt]
    prompt = `${prependStr}${prompt.trim()}${appendStr}`;

    // Hard enforce limit (950 to leave buffer for Suno's counting)
    const trimmed = prompt.trim().slice(0, 950);

    return NextResponse.json({
      prompt: trimmed,
      charCount: trimmed.length,
      songCount: songs.length,
    });
  } catch (error) {
    console.error("Suno prompt generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate Suno prompt" },
      { status: 500 }
    );
  }
}
