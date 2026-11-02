"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "./icons";

type Toast = { id: number; text: string; tone: "ok" | "error" };

/** Show a short confirmation at the bottom of the screen. */
export function toast(text: string, tone: Toast["tone"] = "ok") {
  window.dispatchEvent(new CustomEvent("atlas:toast", { detail: { text, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    let next = 0;
    const onToast = (e: Event) => {
      const { text, tone } = (e as CustomEvent<Omit<Toast, "id">>).detail;
      const id = ++next;
      setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3200);
    };
    window.addEventListener("atlas:toast", onToast);
    return () => window.removeEventListener("atlas:toast", onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`pop pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium shadow-[var(--shadow-pop)] ${
            t.tone === "error" ? "bg-danger text-white" : "bg-ink text-panel"
          }`}
        >
          {t.tone === "ok" && <CheckIcon size={16} />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
