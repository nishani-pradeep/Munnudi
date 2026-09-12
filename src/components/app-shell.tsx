import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { NavLinks } from "./nav-links";
import { MobileNav } from "./mobile-nav";
import { MonthSwitcher } from "./month-switcher";
import { ThemeToggle } from "./theme-toggle";
import { resolveCurrentMonth } from "@/lib/app-config";

export function AppShell({ children }: { children: ReactNode }) {
  // Resolved on the server in the property timezone. The browser clock is not
  // authoritative for "what month is it".
  const currentMonth = resolveCurrentMonth();

  return (
    <div className="min-h-svh bg-background">
      {/* Sidebar: desktop only */}
      <aside className="hidden bg-card md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-r">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight">
            Munnudi
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <Suspense fallback={null}>
            <NavLinks currentMonth={currentMonth} />
          </Suspense>
        </div>
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          Rental &amp; loan tracker
        </div>
      </aside>

      <div className="md:pl-56">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
          <Suspense fallback={null}>
            <MobileNav currentMonth={currentMonth} />
          </Suspense>
          <span className="text-base font-semibold tracking-tight md:hidden">Munnudi</span>
          <div className="flex-1" />
          <Suspense fallback={null}>
            <MonthSwitcher currentMonth={currentMonth} />
          </Suspense>
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
