import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectName: text("project_name").notNull(),
  artistName: text("artist_name"),
  date: text("date").notNull(),
  status: text("status", {
    enum: ["scheduled", "in-progress", "completed", "archived"],
  }).notNull().default("scheduled"),
  fileReferences: text("file_references", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const sessionNotes = sqliteTable("session_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull().default(sql`(datetime('now'))`),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const mixNotes = sqliteTable("mix_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rawText: text("raw_text").notNull(),
  parsedCommands: text("parsed_commands", { mode: "json" }).$type<ParsedCommand[]>(),
  soundflowScript: text("soundflow_script"),
  status: text("status", {
    enum: ["pending", "parsed", "approved", "executing", "done", "failed"],
  }).notNull().default("pending"),
  errorMessage: text("error_message"),
  sessionId: integer("session_id").references(() => sessions.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const pitches = sqliteTable("pitches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  songTitle: text("song_title").notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientEmail: text("recipient_email"),
  recipientCompany: text("recipient_company"),
  status: text("status", {
    enum: ["new", "pitched", "follow-up", "closed-won", "closed-lost"],
  }).notNull().default("new"),
  dateSent: text("date_sent"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const pitchActivities = sqliteTable("pitch_activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pitchId: integer("pitch_id").notNull().references(() => pitches.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["sent", "follow-up", "response", "note"],
  }).notNull(),
  content: text("content"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Types
export type ParsedCommand = {
  action: string;
  trackName: string;
  parameter: string;
  value: string;
  description: string;
};

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionNote = typeof sessionNotes.$inferSelect;
export type MixNote = typeof mixNotes.$inferSelect;
export type NewMixNote = typeof mixNotes.$inferInsert;
export type Pitch = typeof pitches.$inferSelect;
export type NewPitch = typeof pitches.$inferInsert;
export type PitchActivity = typeof pitchActivities.$inferSelect;
