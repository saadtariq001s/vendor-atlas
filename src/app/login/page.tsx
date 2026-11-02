import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { Mark } from "@/components/Mark";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getUser()) redirect("/");
  const { next } = await searchParams;

  return (
    <main className="wash grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col justify-between px-6 pb-10 pt-8 md:px-14 md:py-12">
        <div className="flex items-center gap-2.5 text-accent">
          <Mark size={26} />
          <span className="title text-[22px] text-ink">{APP_NAME}</span>
        </div>

        <div className="mt-16 max-w-xl md:mt-0">
          <h1 className="headline text-[48px] md:text-[78px]">
            Every vendor you know, <em>in a word</em>.
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-2">
            Type a sector or a service and see everyone you work with in it, what they offer, who they
            resemble, and where one could catch up with another.
          </p>
        </div>

        <p className="mt-16 text-[13px] text-ink-3 md:mt-0">Private. Shared only with people you invite.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 md:px-14">
        <div className="card w-full max-w-sm p-7 md:p-9">
          <h2 className="title text-[30px] text-ink">Sign in</h2>
          <p className="mb-7 mt-1.5 text-[14px] text-ink-3">Use the account your administrator set up.</p>
          <LoginForm next={next ?? "/"} />
        </div>
      </section>
    </main>
  );
}
