import type { MenuPage } from '@/types/canvas';

const MAX_HISTORY = 50;

export interface PageHistoryState {
  states: MenuPage[];
  index: number;
}

export function cloneMenuPage(page: MenuPage): MenuPage {
  return JSON.parse(JSON.stringify(page)) as MenuPage;
}

export function createPageHistory(initial?: MenuPage): PageHistoryState {
  if (!initial) {
    return { states: [], index: -1 };
  }
  return {
    states: [cloneMenuPage(initial)],
    index: 0,
  };
}

export function canUndoHistory(history: PageHistoryState): boolean {
  return history.index > 0;
}

export function canRedoHistory(history: PageHistoryState): boolean {
  return history.index >= 0 && history.index < history.states.length - 1;
}

export function pushHistoryState(
  history: PageHistoryState,
  snapshot: MenuPage,
): PageHistoryState {
  const cloned = cloneMenuPage(snapshot);

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

export function undoHistory(
  history: PageHistoryState,
): { history: PageHistoryState; state: MenuPage | null } {
  if (!canUndoHistory(history)) {
    return { history, state: null };
  }

  const index = history.index - 1;
  return {
    history: { ...history, index },
    state: cloneMenuPage(history.states[index]),
  };
}

export function redoHistory(
  history: PageHistoryState,
): { history: PageHistoryState; state: MenuPage | null } {
  if (!canRedoHistory(history)) {
    return { history, state: null };
  }

  const index = history.index + 1;
  return {
    history: { ...history, index },
    state: cloneMenuPage(history.states[index]),
  };
}
