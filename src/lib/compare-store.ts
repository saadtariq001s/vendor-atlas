"use client";

import { useSyncExternalStore } from "react";

// The vendors picked for comparison, kept in localStorage so a selection
// made from several searches survives navigation. Up to four. Read through
// useCompare(); changed through add/remove/clear, which notify every
// subscriber on the page.

export const COMPARE_MAX = 4;
const KEY = "atlas-compare";
const EVENT = "atlas:compare";

export type Pick = { id: number; name: string };

let snapshot: Pick[] = [];
let loaded = false;

function read(): Pick[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.filter((p): p is Pick => typeof p?.id === "number" && typeof p?.name === "string").slice(0, COMPARE_MAX)
      : [];
  } catch {
    return [];
  }
}

function write(next: Pick[]) {
  snapshot = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing: the selection lives for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function getSnapshot(): Pick[] {
  if (!loaded) {
    snapshot = read();
    loaded = true;
  }
  return snapshot;
}

const EMPTY: Pick[] = [];
const getServerSnapshot = () => EMPTY;

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = read();
      onChange();
    }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCompare(): Pick[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const compare = {
  has: (id: number) => getSnapshot().some((p) => p.id === id),
  /** Returns false when the tray is already full. */
  add(p: Pick): boolean {
    const cur = getSnapshot();
    if (cur.some((x) => x.id === p.id)) return true;
    if (cur.length >= COMPARE_MAX) return false;
    write([...cur, p]);
    return true;
  },
  remove(id: number) {
    write(getSnapshot().filter((p) => p.id !== id));
  },
  toggle(p: Pick): boolean {
    if (compare.has(p.id)) {
      compare.remove(p.id);
      return true;
    }
    return compare.add(p);
  },
  clear() {
    write([]);
  },
};

export const compareHref = (ids: number[]) => `/compare?ids=${ids.join(",")}`;
