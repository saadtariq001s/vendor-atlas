import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { getOverview } from "@/lib/search";
import { DownloadIcon } from "@/components/icons";
import { UploadPanel } from "./UploadPanel";

export const metadata: Metadata = { title: "Upload data" };

const COLUMNS: [string, string][] = [
  ["Company name", "Required. Also matches Name, Vendor, Supplier, Contractor Name."],
  ["What they offer", "Area of Business, Activities, Services, or a Work Group Description. Sectors and comparisons come from this."],
  ["Offering code", "A work-group or category number, kept beside the offering and searchable."],
  ["Email and phone", "Several per cell are fine."],
  ["Address and emirate", "The emirate is read from the address when there's no column for it."],
  ["Associated company", "With its country: a principal or partner the vendor works with. Searchable too."],
  ["Additional notes", "Also matches Notes, Remarks, Comments."],
];

const SHAPES: [string, string][] = [
  ["One row per company", "Each row lists everything the company does, like your vendor sheet."],
  ["One row per offering", "A company repeats on a row for each work group or category, like an approved-contractor list."],
];

const RULES = [
  "A company is matched by its name, so the same vendor in two files becomes one.",
  "Lists that cut long names short are matched to the full name where only one vendor fits.",
  "Offerings from every file are combined. An import never removes an offering.",
  "A blank cell never erases what's already stored.",
  "Notes from a file are added below the notes already written.",
  "An emirate set by hand is kept.",
];

export default async function UploadPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const o = await getOverview();

  return (
    <>
      <div className="wash">
        <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-10 md:px-8 md:pb-10 md:pt-16">
          <h1 className="headline text-[44px] sm:text-[60px] lg:text-[72px]">
            Bring in <em>more vendors</em>
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] text-ink-2">
            Drop one spreadsheet or several at once. The directory holds {fmt(o.total)} vendors today; you&apos;ll see exactly what
            each upload adds before anything is saved.
          </p>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-24 pt-6 md:gap-8 md:px-8 md:pt-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="card p-5 md:p-7">
          <UploadPanel directoryTotal={o.total} />
        </section>

        <aside className="space-y-6 md:space-y-8">
          <section className="card p-5 md:p-7">
            <h2 className="title text-[22px]">Columns it reads</h2>
            <p className="mt-1 text-[14px] text-ink-3">Matched from each sheet&apos;s header row. You can re-point any of them.</p>
            <dl className="mt-4 divide-y divide-line">
              {COLUMNS.map(([name, hint]) => (
                <div key={name} className="py-2.5">
                  <dt className="text-[14px] font-medium">{name}</dt>
                  <dd className="text-[13px] text-ink-3">{hint}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-5 md:p-7">
            <h2 className="title text-[22px]">Lists it understands</h2>
            <p className="mt-1 text-[14px] text-ink-3">The shape of each sheet is worked out for you, and you can switch it.</p>
            <dl className="mt-4 divide-y divide-line">
              {SHAPES.map(([name, hint]) => (
                <div key={name} className="py-2.5">
                  <dt className="text-[14px] font-medium">{name}</dt>
                  <dd className="text-[13px] text-ink-3">{hint}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-5 md:p-7">
            <h2 className="title text-[22px]">When a vendor is already listed</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-2 marker:text-ink-3">
              {RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <a
              href="/api/export?all=1&sort=name"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-[13px] font-semibold transition hover:border-accent hover:text-accent-text"
            >
              <DownloadIcon size={16} /> Keep a copy of the current directory first
            </a>
          </section>
        </aside>
      </main>
    </>
  );
}
