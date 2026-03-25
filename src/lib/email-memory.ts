import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const memoryDir = path.join(process.cwd(), "data", "emails");
const memoryPath = path.join(memoryDir, "memory.json");

export type Contact = {
  email: string;
  name: string;
  relationship: string; // e.g. "client", "collaborator", "artist", "label rep", "friend"
  topics: string[]; // what you discuss with them
  lastSeen: string;
  notes: string;
};

export type WorkContext = {
  activeProjects: string[];
  recentTopics: string[];
  pendingActions: string[];
  importantDates: string[];
};

export type EmailMemory = {
  aboutUser: string; // accumulated knowledge about the user
  contacts: Record<string, Contact>; // keyed by email address
  workContext: WorkContext;
  patterns: string[]; // observed patterns about the user's email habits
  lastUpdated: string;
};

function defaultMemory(): EmailMemory {
  return {
    aboutUser: "",
    contacts: {},
    workContext: {
      activeProjects: [],
      recentTopics: [],
      pendingActions: [],
      importantDates: [],
    },
    patterns: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function getMemory(): EmailMemory {
  try {
    return JSON.parse(readFileSync(memoryPath, "utf-8"));
  } catch {
    return defaultMemory();
  }
}

export function saveMemory(memory: EmailMemory) {
  mkdirSync(memoryDir, { recursive: true });
  memory.lastUpdated = new Date().toISOString();
  writeFileSync(memoryPath, JSON.stringify(memory, null, 2), "utf-8");
}

export function updateMemoryFromAnalysis(analysis: {
  aboutUser?: string;
  contactUpdates?: Array<{
    email: string;
    name: string;
    relationship?: string;
    topics?: string[];
    notes?: string;
  }>;
  workContext?: {
    newProjects?: string[];
    newTopics?: string[];
    newActions?: string[];
    newDates?: string[];
    completedActions?: string[];
  };
  newPatterns?: string[];
}) {
  const memory = getMemory();

  // Update user knowledge (append, don't replace)
  if (analysis.aboutUser) {
    memory.aboutUser = analysis.aboutUser;
  }

  // Update contacts
  if (analysis.contactUpdates) {
    for (const cu of analysis.contactUpdates) {
      const existing = memory.contacts[cu.email];
      if (existing) {
        existing.name = cu.name || existing.name;
        existing.relationship = cu.relationship || existing.relationship;
        if (cu.topics) {
          existing.topics = [...new Set([...existing.topics, ...cu.topics])].slice(-20);
        }
        if (cu.notes) existing.notes = cu.notes;
        existing.lastSeen = new Date().toISOString();
      } else {
        memory.contacts[cu.email] = {
          email: cu.email,
          name: cu.name,
          relationship: cu.relationship || "unknown",
          topics: cu.topics || [],
          lastSeen: new Date().toISOString(),
          notes: cu.notes || "",
        };
      }
    }
  }

  // Update work context
  if (analysis.workContext) {
    const wc = memory.workContext;
    if (analysis.workContext.newProjects) {
      wc.activeProjects = [...new Set([...wc.activeProjects, ...analysis.workContext.newProjects])].slice(-20);
    }
    if (analysis.workContext.newTopics) {
      wc.recentTopics = [...new Set([...analysis.workContext.newTopics, ...wc.recentTopics])].slice(0, 30);
    }
    if (analysis.workContext.newActions) {
      wc.pendingActions = [...wc.pendingActions, ...analysis.workContext.newActions].slice(-30);
    }
    if (analysis.workContext.completedActions) {
      wc.pendingActions = wc.pendingActions.filter(
        (a) => !analysis.workContext!.completedActions!.some((c) => a.toLowerCase().includes(c.toLowerCase()))
      );
    }
    if (analysis.workContext.newDates) {
      wc.importantDates = [...wc.importantDates, ...analysis.workContext.newDates].slice(-20);
    }
  }

  if (analysis.newPatterns) {
    memory.patterns = [...new Set([...memory.patterns, ...analysis.newPatterns])].slice(-20);
  }

  saveMemory(memory);
  return memory;
}
