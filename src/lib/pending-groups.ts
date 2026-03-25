// Shared state for pending song groups (generating but not yet downloaded)

type PendingGroup = {
  name: string;
  titles: string[];
  createdAt: number;
};

let pendingGroups: PendingGroup[] = [];
const listeners = new Set<() => void>();

// Track all titles we've ever generated (persists to disk)
let allGeneratedTitles: Set<string> = new Set();

export function addPendingGroup(name: string, titles: string[]) {
  pendingGroups = [...pendingGroups, { name, titles, createdAt: Date.now() }];
  titles.forEach((t) => allGeneratedTitles.add(t));
  listeners.forEach((fn) => fn());
}

export function getAllGeneratedTitles(): string[] {
  return Array.from(allGeneratedTitles);
}

export function loadGeneratedTitles(titles: string[]) {
  titles.forEach((t) => allGeneratedTitles.add(t));
}

export function removePendingGroup(name: string) {
  pendingGroups = pendingGroups.filter((g) => g.name !== name);
  listeners.forEach((fn) => fn());
}

export function getPendingGroups(): PendingGroup[] {
  return pendingGroups;
}

export function subscribePendingGroups(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
