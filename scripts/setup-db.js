#!/usr/bin/env node
// Creates the SQLite database and tables on first install

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "pa.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    artist_name TEXT,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    file_references TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS session_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mix_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_text TEXT NOT NULL,
    parsed_commands TEXT,
    soundflow_script TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    session_id INTEGER REFERENCES sessions(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pitches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_title TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT,
    recipient_company TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    date_sent TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pitch_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.close();
console.log("PA database initialized at", dbPath);
