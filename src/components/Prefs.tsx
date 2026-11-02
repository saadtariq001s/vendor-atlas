"use client";

import { useSyncExternalStore } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";

// "Hide contacts" lives on <html> as a data attribute (set before first paint
// by the script in the root layout) and in localStorage. The toggle reads the
// attribute as an external store, so it stays in step wherever it's rendered.

const html = () => document.documentElement;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(html(), { attributes: true, attributeFilter: ["data-private"] });
  return () => observer.disconnect();
}

const isPrivate = () => html().dataset.private === "on";

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing: the preference simply won't persist.
  }
}

export function PrivacyToggle() {
  const on = useSyncExternalStore(subscribe, isPrivate, () => false);

  const toggle = () => {
    if (on) delete html().dataset.private;
    else html().dataset.private = "on";
    save("atlas-private", on ? "off" : "on");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? "Show contact details" : "Hide contact details while presenting"}
      className={`flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition ${
        on ? "bg-ink text-panel" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
      }`}
    >
      {on ? <EyeOffIcon /> : <EyeIcon />}
      <span className={on ? "" : "sr-only lg:not-sr-only"}>{on ? "Contacts hidden" : "Hide contacts"}</span>
    </button>
  );
}
