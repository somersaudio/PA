// Persistent UI state for the song library that survives page navigation

let expandedGroups: Set<string> = new Set(["__favorites__"]);

export function getExpandedGroups(): Set<string> {
  return expandedGroups;
}

export function setExpandedGroups(groups: Set<string>) {
  expandedGroups = groups;
}
