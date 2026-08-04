import type { MobileMenuDocument } from '@shared/mobile-menu';

const MAX_HISTORY = 50;

export interface MobileDocHistoryState {
  states: MobileMenuDocument[];
  index: number;
}

export function cloneMobileDocument(doc: MobileMenuDocument): MobileMenuDocument {
  return JSON.parse(JSON.stringify(doc)) as MobileMenuDocument;
}

export function createMobileDocHistory(initial?: MobileMenuDocument): MobileDocHistoryState {
  if (!initial) {
    return { states: [], index: -1 };
  }
  return {
    states: [cloneMobileDocument(initial)],
    index: 0,
  };
}

export function canUndoMobileDoc(history: MobileDocHistoryState): boolean {
  return history.index > 0;
}

export function canRedoMobileDoc(history: MobileDocHistoryState): boolean {
  return history.index >= 0 && history.index < history.states.length - 1;
}

export function pushMobileDocHistory(
  history: MobileDocHistoryState,
  snapshot: MobileMenuDocument,
): MobileDocHistoryState {
  const cloned = cloneMobileDocument(snapshot);

  if (history.states.length === 0) {
    return { states: [cloned], index: 0 };
  }

  const current = history.states[history.index];
  if (current && JSON.stringify(current) === JSON.stringify(cloned)) {
    return history;
  }

  let states = history.states.slice(0, history.index + 1);
  states.push(cloned);

  let index = states.length - 1;
  if (states.length > MAX_HISTORY) {
    states = states.slice(states.length - MAX_HISTORY);
    index = states.length - 1;
  }

  return { states, index };
}

/** Sustituye el estado actual (útil al arrastrar color / debounce). */
export function replaceMobileDocHistory(
  history: MobileDocHistoryState,
  snapshot: MobileMenuDocument,
): MobileDocHistoryState {
  if (history.index < 0 || history.states.length === 0) {
    return pushMobileDocHistory(history, snapshot);
  }
  const cloned = cloneMobileDocument(snapshot);
  const current = history.states[history.index];
  if (current && JSON.stringify(current) === JSON.stringify(cloned)) {
    return history;
  }
  const states = history.states.slice();
  states[history.index] = cloned;
  return { ...history, states };
}

export function undoMobileDoc(
  history: MobileDocHistoryState,
): { history: MobileDocHistoryState; state: MobileMenuDocument | null } {
  if (!canUndoMobileDoc(history)) {
    return { history, state: null };
  }
  const index = history.index - 1;
  return {
    history: { ...history, index },
    state: cloneMobileDocument(history.states[index]),
  };
}

export function redoMobileDoc(
  history: MobileDocHistoryState,
): { history: MobileDocHistoryState; state: MobileMenuDocument | null } {
  if (!canRedoMobileDoc(history)) {
    return { history, state: null };
  }
  const index = history.index + 1;
  return {
    history: { ...history, index },
    state: cloneMobileDocument(history.states[index]),
  };
}
