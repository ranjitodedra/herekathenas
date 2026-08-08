"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

export function AppShell({
  children,
  username,
  fullBleed = false,
}: {
  children: React.ReactNode;
  username?: string;
  /** Skip max-width main padding - used by full-page network. */
  fullBleed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/dashboard", label: "Network" },
    { href: "/find", label: "Find Connection" },
    { href: "/import", label: "Import" },
    {
      href: username ? `/profile/${username}` : "/profile/edit",
      label: "Profile",
    },
  ];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className={`flex flex-col ${fullBleed ? "h-dvh overflow-hidden" : "min-h-screen"}`}
    >
      <header className="sticky top-0 z-40 shrink-0 border-b border-[var(--line)] bg-[rgba(247,243,238,0.85)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <BrandMark size="sm" />
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.label === "Profile" && pathname.startsWith("/profile")) ||
                (link.href !== "/dashboard" &&
                  link.label !== "Profile" &&
                  pathname.startsWith(link.href));
              const networkActive = link.href === "/dashboard" && pathname === "/dashboard";
              const isActive = link.href === "/dashboard" ? networkActive : active;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    isActive ? "bg-ink text-cream" : "text-ink/70 hover:bg-white/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {username ? (
              <Link href={`/profile/${username}`} className="text-ink/70 hover:text-ink">
                @{username}
              </Link>
            ) : null}
            <button type="button" onClick={signOut} className="text-ink/60 hover:text-ink">
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 sm:hidden">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.label === "Profile" && pathname.startsWith("/profile"));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                  active ? "bg-ink text-cream" : "bg-white/50 text-ink/70"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {fullBleed ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      ) : (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      )}
    </div>
  );
}
