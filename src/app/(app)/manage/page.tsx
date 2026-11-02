import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { fmt, fmtDateTime, pct } from "@/lib/format";
import { getOverview } from "@/lib/search";
import { recentAudit } from "@/lib/vendors";
import { DownloadIcon, UploadIcon } from "@/components/icons";
import { UsersPanel } from "./UsersPanel";

export const metadata: Metadata = { title: "Manage" };

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 md:p-7">
      <h2 className="title text-[24px]">{title}</h2>
      {note && <p className="mt-1 text-[14px] text-ink-3">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function ManagePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const [o, log, users] = await Promise.all([
    getOverview(),
    recentAudit(15),
    query<{ id: string; email: string; name: string | null; role: string }>(
      `select id::text, email, name, role from public.app_users order by role, email`,
    ),
  ]);

  const gaps = [
    { key: "email", label: "No email", n: o.missingEmail },
    { key: "phone", label: "No phone number", n: o.missingPhone },
    { key: "emirate", label: "No emirate", n: o.missingEmirate },
  ];

  return (
    <>
      <div className="wash">
        <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-10 md:px-8 md:pb-10 md:pt-16">
          <h1 className="headline text-[44px] sm:text-[60px] lg:text-[72px]">
            Manage the <em>directory</em>
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] text-ink-2">
            {fmt(o.total)} vendors. To change a single vendor, open it from any search and choose Edit.
          </p>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-24 pt-6 md:gap-8 md:px-8 md:pt-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6 md:space-y-8">
          <Panel title="Upload spreadsheets" note="Add or update vendors in bulk from one or more Excel or CSV files.">
            <Link
              href="/upload"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-accent-ink transition hover:bg-accent-hover"
            >
              <UploadIcon size={17} /> Upload data
            </Link>
          </Panel>

          <Panel title="Recent changes">
            {log.length === 0 ? (
              <p className="text-[14px] text-ink-3">Nothing has changed yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {log.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5">
                    <span className="min-w-0 flex-1 text-[14px]">{e.summary}</span>
                    <span className="text-[12px] text-ink-3">
                      {e.user_email}, {fmtDateTime(e.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6 md:space-y-8">
          <Panel title="Download" note="The full directory as an Excel file, in the same columns it was imported with.">
            <a
              href="/api/export?all=1&sort=name"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong px-4 text-[14px] font-semibold transition hover:border-accent hover:text-accent-text"
            >
              <DownloadIcon size={17} /> Download {fmt(o.total)} vendors
            </a>
          </Panel>

          <Panel title="Gaps in the data" note="Vendors you can't reach or place yet. Open a list to fill them in.">
            <ul className="space-y-2">
              {gaps.map((g) => (
                <li key={g.key}>
                  <Link
                    href={`/?missing=${g.key}`}
                    className="flex items-baseline justify-between gap-3 rounded-xl border border-line px-4 py-3 transition hover:border-accent"
                  >
                    <span className="text-[14px] font-medium">{g.label}</span>
                    <span className="num text-[14px] text-ink-2">
                      {fmt(g.n)} <span className="text-ink-3">({pct(g.n, o.total)})</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Who can sign in" note="View-only accounts can search and export, but not change anything.">
            <UsersPanel users={users} me={user.id} />
          </Panel>
        </div>
      </main>
    </>
  );
}
