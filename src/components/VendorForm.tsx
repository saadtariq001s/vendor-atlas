"use client";

import { useState } from "react";
import { EMIRATES, NOTES_MAX } from "@/lib/normalize";

export type VendorFormValues = {
  name: string;
  email: string;
  phone: string;
  address: string;
  activities: string;
  emirate: string; // "" = work it out from address/phone
  notes: string;
};

const input =
  "w-full rounded-lg border border-line-strong bg-panel px-3 text-[15px] text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function VendorForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  focusNotes = false,
}: {
  initial: VendorFormValues;
  focusNotes?: boolean; // opened from "Add a note": start in the notes box
  submitLabel: string;
  onSubmit: (v: VendorFormValues) => Promise<string | null>; // returns an error message
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof VendorFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(await onSubmit(values));
        setSaving(false);
      }}
    >
      <Field label="Company name">
        <input required value={values.name} onChange={set("name")} className={`${input} h-11`} autoFocus={!focusNotes} />
      </Field>
      <Field label="What they offer" hint="One offering per line. Sectors and comparisons are worked out from these.">
        <textarea value={values.activities} onChange={set("activities")} rows={7} className={`${input} py-2.5 leading-relaxed`} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" hint="Several are fine; separate with /">
          <input value={values.email} onChange={set("email")} className={`${input} h-11`} inputMode="email" />
        </Field>
        <Field label="Phone">
          <input value={values.phone} onChange={set("phone")} className={`${input} h-11`} inputMode="tel" />
        </Field>
      </div>
      <Field label="Address">
        <input value={values.address} onChange={set("address")} className={`${input} h-11`} />
      </Field>
      <Field label="Emirate">
        <select value={values.emirate} onChange={set("emirate")} className={`${input} h-11`}>
          <option value="">Work it out from the address or phone</option>
          {EMIRATES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Additional notes"
        hint={`Anything worth remembering about this vendor: pricing, reliability, who to ask for. Everyone signed in can read these; they're hidden while contacts are hidden. ${(NOTES_MAX - values.notes.length).toLocaleString("en-US")} characters left.`}
      >
        <textarea
          value={values.notes}
          onChange={set("notes")}
          rows={5}
          maxLength={NOTES_MAX}
          autoFocus={focusNotes}
          placeholder="e.g. Quoted 12% under the market in March. Ask for Rashid in procurement."
          className={`${input} py-2.5 leading-relaxed placeholder:text-ink-3`}
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[14px] text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-lg bg-accent px-5 text-[15px] font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-lg px-4 text-[15px] font-medium text-ink-2 hover:bg-panel-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
