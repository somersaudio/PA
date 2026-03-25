# PA — Producer's Assistant

AI-powered music production toolkit for macOS (Apple Silicon). Controls Pro Tools via SoundFlow, manages sessions, monitors email, generates music with Suno AI, and puts an intelligent assistant at your fingertips.

> **macOS Apple Silicon only** (M1/M2/M3/M4)

## Features

- **Mix Agent** — Natural language Pro Tools control. Say "turn the vocal up 2dB" and it happens. Uses Claude AI + SoundFlow + Vision to see and control Pro Tools.
- **360+ SoundFlow Commands** — Pre-registered command library (transport, faders, mute/solo, plugins, editing). Searchable, testable, expandable.
- **AI Chat Assistant** — Persistent sidebar chat that can control every part of the app. Manages sessions, runs SoundFlow commands, reads emails, generates Suno prompts.
- **Sessions** — Track recording/mixing projects with notes, collaborators (with Spotify artist photos), and audio files.
- **Spotify + Suno** — Paste a playlist URL, generate AI instrumental tracks inspired by the style.
- **Inbox** — IMAP email monitoring with AI analysis, contact memory, and audio attachment playback.
- **Pitch Tracker** — Track song pitches to supervisors, labels, and publishers.

## Requirements

- macOS 12+ on Apple Silicon (M1/M2/M3/M4)
- [SoundFlow](https://soundflow.org) installed (for Pro Tools control)
- [Claude API key](https://console.anthropic.com/) (Anthropic)

## Install (from Release)

1. Download the latest `PA-*-arm64.dmg` from [Releases](../../releases)
2. Open the DMG and drag **PA** to Applications
3. Launch PA, go to **Settings**, and add your Claude API key
4. Set your SoundFlow User ID in Settings

## Install (from Source)

```bash
git clone https://github.com/somersaudio/PA.git
cd PA
npm install
cp .env.example .env.local   # Add your API keys
npm run dev                   # Web dev server at localhost:3000
```

### Run as Electron app

```bash
npm run electron:dev          # Dev mode with hot reload
npm run electron:build        # Build DMG for Apple Silicon
```

### SoundFlow Setup

1. Open SoundFlow and go to **Settings > Command Line**
2. Copy your **User ID** (looks like `ckp49i4j60000a2100yfwywgf`)
3. Paste it in PA **Settings > SoundFlow > User ID**
4. Your 360 pre-registered commands will update to use your ID

## Project Structure

```
PA/
├── electron/           # Electron main process
├── src/
│   ├── app/            # Next.js pages and API routes
│   │   ├── api/
│   │   │   ├── chat/           # AI assistant backend
│   │   │   ├── mix-agent/      # Pro Tools agent (parse, execute, run)
│   │   │   ├── soundflow/      # Commands CRUD, run, status, user-id
│   │   │   ├── sessions/       # Session management
│   │   │   ├── suno/           # Suno AI generation
│   │   │   ├── email/          # IMAP inbox
│   │   │   └── settings/       # API keys, config
│   │   ├── mix-agent/          # Mix Agent UI
│   │   ├── sessions/           # Sessions UI
│   │   ├── inbox/              # Email inbox UI
│   │   ├── playlist-parser/    # Spotify + Suno UI
│   │   └── settings/           # Settings UI
│   ├── components/     # React components
│   ├── lib/            # Core logic (SoundFlow, Claude, Pro Tools agent)
│   └── db/             # SQLite schema (Drizzle ORM)
├── data/               # Runtime data (DB, commands, config)
├── soundflow-scripts/  # SoundFlow bridge scripts
└── public/             # Static assets
```

## Tech Stack

- **Electron** — Native macOS app shell
- **Next.js 16** — React framework with API routes
- **Claude AI** (Anthropic) — LLM for chat, mix notes, email analysis
- **SoundFlow** — Pro Tools automation bridge
- **SQLite** (better-sqlite3 + Drizzle ORM) — Local database
- **Tailwind CSS + shadcn/ui** — UI components

## License

MIT
