"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import LogoutButton from "@/components/auth/LogoutButton";

type AppShellProps = {
  active:
    | "journal"
    | "tree"
    | "gallery"
    | "family"
    | "find-family"
    | "account";
  userEmail?: string | null;
  userName?: string | null;
  children: React.ReactNode;
  contentClassName?: string;
};

const primaryLinks = [
  { href: "/dashboard", label: "Journal", active: "journal" },
  { href: "/tree", label: "My Family Tree", active: "tree" },
  { href: "/gallery", label: "Photo Gallery", active: "gallery" },
  { href: "/family", label: "Manage Family", active: "family" },
  { href: "/family/connect", label: "Find Family", active: "find-family" },
  { href: "/profile", label: "Account", active: "account" },
] as const;

const comingLaterLinks = [
  "Family Feed",
  "Family Chat",
  "Clans",
  "FamilySearch Sync",
  "LegacyLinks Map",
  "Bedtime Stories",
];

export default function AppShell({
  active,
  userEmail,
  userName = "LegacyLinks",
  children,
  contentClassName = "bg-sand",
}: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <main className="min-h-screen bg-white text-night-sky">
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 border-r border-night-sky/10 bg-white lg:flex lg:flex-col">
          <div className="border-b border-night-sky/10 px-8 py-8">
            <Link href="/dashboard" className="block">
              <Image
                src="/images/ll-logo.svg"
                alt="LegacyLinks"
                width={192}
                height={44}
                className="h-auto w-48"
                priority
              />
            </Link>
          </div>

          <nav className="flex-1 px-4 py-6" aria-label="Main navigation">
            <div className="space-y-1">
              {primaryLinks.map((link) => (
                <SidebarLink
                  key={link.href}
                  href={link.href}
                  active={active === link.active}
                >
                  {link.label}
                </SidebarLink>
              ))}

              <div className="pt-6">
                <p className="px-4 text-xs font-semibold uppercase tracking-[0.2em] text-night-sky/40">
                  Coming later
                </p>
              </div>

              {comingLaterLinks.map((label) => (
                <SidebarLink key={label} href="#" disabled>
                  {label}
                </SidebarLink>
              ))}
            </div>
          </nav>

          <div className="border-t border-night-sky/10 px-6 py-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-night-sky">
                {userName}
              </p>
              {userEmail && (
                <p className="truncate text-xs text-night-sky/60">
                  {userEmail}
                </p>
              )}
            </div>

            <div className="mt-4">
              <LogoutButton />
            </div>
          </div>
        </aside>

        <section className={`min-w-0 flex-1 ${contentClassName}`}>
          <header className="relative z-50 border-b border-night-sky/10 bg-white px-4 py-4 shadow-sm lg:hidden">
            <div className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-night-sky/15 bg-white text-night-sky shadow-sm"
                aria-label="Open navigation"
                aria-expanded={isMobileNavOpen}
              >
                <span className="flex w-5 flex-col gap-1.5">
                  <span className="h-0.5 rounded-full bg-current" />
                  <span className="h-0.5 rounded-full bg-current" />
                  <span className="h-0.5 rounded-full bg-current" />
                </span>
              </button>

              <Link href="/dashboard" className="block">
                <Image
                  src="/images/ll-logo.svg"
                  alt="LegacyLinks"
                  width={160}
                  height={37}
                  className="mx-auto h-auto w-40"
                  priority
                />
              </Link>

              <div aria-hidden="true" />
            </div>
          </header>

          <div
            className={`fixed inset-0 z-[70] lg:hidden ${
              isMobileNavOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
            aria-hidden={!isMobileNavOpen}
          >
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className={`absolute inset-0 bg-night-sky/40 transition-opacity ${
                isMobileNavOpen ? "opacity-100" : "opacity-0"
              }`}
              aria-label="Close navigation"
            />

            <aside
              className={`relative flex h-full w-[min(82vw,320px)] flex-col border-r border-night-sky/10 bg-white shadow-2xl transition-transform duration-300 ${
                isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="border-b border-night-sky/10 px-6 py-6">
                <div className="flex items-center justify-between gap-4">
                  <Link
                    href="/dashboard"
                    className="block"
                    onClick={() => setIsMobileNavOpen(false)}
                  >
                    <Image
                      src="/images/ll-logo.svg"
                      alt="LegacyLinks"
                      width={176}
                      height={40}
                      className="h-auto w-44"
                      priority
                    />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-night-sky/15 text-xl leading-none text-night-sky"
                    aria-label="Close navigation"
                  >
                    ×
                  </button>
                </div>
              </div>

              <nav className="flex-1 px-4 py-6" aria-label="Main navigation">
                <div className="space-y-1">
                  {primaryLinks.map((link) => (
                    <SidebarLink
                      key={link.href}
                      href={link.href}
                      active={active === link.active}
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      {link.label}
                    </SidebarLink>
                  ))}

                  <div className="pt-6">
                    <p className="px-4 text-xs font-semibold uppercase tracking-[0.2em] text-night-sky/40">
                      Coming later
                    </p>
                  </div>

                  {comingLaterLinks.map((label) => (
                    <SidebarLink key={label} href="#" disabled>
                      {label}
                    </SidebarLink>
                  ))}
                </div>
              </nav>

              <div className="border-t border-night-sky/10 px-6 py-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-night-sky">
                    {userName}
                  </p>
                  {userEmail && (
                    <p className="truncate text-xs text-night-sky/60">
                      {userEmail}
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <LogoutButton />
                </div>
              </div>
            </aside>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}

function SidebarLink({
  href,
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  if (disabled) {
    return (
      <div className="flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium text-night-sky/40">
        <span>{children}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium transition ${
        active
          ? "bg-night-sky text-white"
          : "text-night-sky/75 hover:bg-sand hover:text-night-sky"
      }`}
    >
      <span>{children}</span>
    </Link>
  );
}
