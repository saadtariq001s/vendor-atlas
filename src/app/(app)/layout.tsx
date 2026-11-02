import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { CompareTray } from "@/components/CompareTray";
import { Mark } from "@/components/Mark";
import { NavLink, UploadLink } from "@/components/NavLink";
import { PrivacyToggle } from "@/components/Prefs";
import { Toaster } from "@/components/Toaster";
import { UserMenu } from "@/components/UserMenu";
import { VendorDrawer } from "@/components/VendorDrawer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-1 px-4 md:px-8">
          <Link href="/" className="mr-auto flex items-center gap-2.5 rounded-lg py-1 text-accent">
            <Mark size={22} />
            <span className="title text-[21px] text-ink">{APP_NAME}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <NavLink href="/">Search</NavLink>
            <NavLink href="/compare">Compare</NavLink>
          </nav>
          {user.role === "admin" && <UploadLink />}
          <span className="mx-2 hidden h-5 w-px bg-line md:block" aria-hidden="true" />
          <PrivacyToggle />
          <UserMenu email={user.email} name={user.name} role={user.role} />
        </div>
      </header>
      {children}
      <Suspense>
        <VendorDrawer isAdmin={user.role === "admin"} />
      </Suspense>
      <CompareTray />
      <Toaster />
    </>
  );
}
