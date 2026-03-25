// Inject messages into the chat panel from other components

type PendingChat = {
  userMessage: string;
} | null;

let pending: PendingChat = null;
const listeners = new Set<() => void>();

export function injectChatMessage(message: string) {
  pending = { userMessage: message };
  listeners.forEach((fn) => fn());
}

export function getPendingChat(): PendingChat {
  return pending;
}

export function clearPendingChat() {
  pending = null;
}

export function subscribePendingChat(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
