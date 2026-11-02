import type { Metadata } from "next";
import Link from "next/link";
import { COMPARE_MAX, compareVendors } from "@/lib/insights";
import { CompareView } from "@/components/CompareView";
import { ComparePicker } from "@/components/ComparePicker";

export const metadata: Metadata = { title: "Compare" };

const WRAP = "mx-auto max-w-[1280px] px-4 md:px-8";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const list = (ids ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, COMPARE_MAX);
  const comparison = list.length >= 2 ? await compareVendors(list) : null;

  if (!comparison) {
    return (
      <div className="wash">
        <main className={`${WRAP} pb-28 pt-12 md:pt-20`}>
          <h1 className="headline text-[48px] sm:text-[64px] lg:text-[84px]">
            Two vendors, <em>side by side</em>.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2 md:text-[19px]">
            Pick up to {COMPARE_MAX} vendors from any search, any vendor&apos;s page, or the competitors it&apos;s shown
            with. You&apos;ll see what they share, where each goes further, and what one could add to match the
            other.
          </p>
          <ComparePicker />
          <p className="mt-10 text-[14px] text-ink-3">
            Start from a{" "}
            <Link href="/" className="font-medium text-accent-text hover:underline">
              search
            </Link>
            : every result has a Compare button.
          </p>
        </main>
      </div>
    );
  }

  return <CompareView c={comparison} />;
}
