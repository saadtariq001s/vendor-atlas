import { HttpError } from "@/lib/auth";
import { NOTES_MAX, type VendorInput } from "@/lib/normalize";

const field = (v: unknown, max: number) => {
  if (v == null) return null;
  if (typeof v !== "string") throw new HttpError(400, "Every field must be text.");
  return v.slice(0, max);
};

/** Validate a JSON body from the add/edit form. */
export function vendorInput(body: unknown): VendorInput {
  if (!body || typeof body !== "object") throw new HttpError(400, "Send the vendor as JSON.");
  const b = body as Record<string, unknown>;
  return {
    name: field(b.name, 300) ?? "",
    email: field(b.email, 500),
    phone: field(b.phone, 300),
    address: field(b.address, 1000),
    activities: field(b.activities, 10_000),
    emirate: field(b.emirate, 40),
    notes: field(b.notes, NOTES_MAX + 500),
    // The form shows one offering per line, and each line is kept as written.
    layout: "lines",
  };
}
