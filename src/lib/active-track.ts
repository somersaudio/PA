// Global state for the currently playing track's marker data

type Marker = {
  id: string;
  time: number;
  comments: string[];
};

type ActiveTrackState = {
  filename: string;
  title: string;
  markers: Marker[];
  activeMarkerId: string | null;
  playing: boolean;
} | null;

let activeTrack: ActiveTrackState = null;
const listeners = new Set<() => void>();

// Callbacks for the waveform player to expose its controls
let addCommentCallback: ((markerId: string, comment: string) => void) | null = null;
let deleteCommentCallback: ((markerId: string, idx: number) => void) | null = null;
let deleteMarkerCallback: ((markerId: string) => void) | null = null;
let setActiveMarkerCallback: ((id: string | null) => void) | null = null;
let seekAndPlayCallback: ((time: number) => void) | null = null;

export function setActiveTrack(state: ActiveTrackState) {
  activeTrack = state;
  listeners.forEach((fn) => fn());
}

export function getActiveTrack() {
  return activeTrack;
}

export function subscribeActiveTrack(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function registerCallbacks(cbs: {
  addComment: (markerId: string, comment: string) => void;
  deleteComment: (markerId: string, idx: number) => void;
  deleteMarker: (markerId: string) => void;
  setActiveMarker: (id: string | null) => void;
  seekAndPlay: (time: number) => void;
}) {
  addCommentCallback = cbs.addComment;
  deleteCommentCallback = cbs.deleteComment;
  deleteMarkerCallback = cbs.deleteMarker;
  setActiveMarkerCallback = cbs.setActiveMarker;
  seekAndPlayCallback = cbs.seekAndPlay;
}

export function clearCallbacks() {
  addCommentCallback = null;
  deleteCommentCallback = null;
  deleteMarkerCallback = null;
  setActiveMarkerCallback = null;
  seekAndPlayCallback = null;
}

export function callAddComment(markerId: string, comment: string) {
  addCommentCallback?.(markerId, comment);
}
export function callDeleteComment(markerId: string, idx: number) {
  deleteCommentCallback?.(markerId, idx);
}
export function callDeleteMarker(markerId: string) {
  deleteMarkerCallback?.(markerId);
}
export function callSetActiveMarker(id: string | null) {
  setActiveMarkerCallback?.(id);
}
export function callSeekAndPlay(time: number) {
  seekAndPlayCallback?.(time);
}
