import Link from "next/link";
import Image from "next/image";
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
            <div className="mb-4 flex items-center justify-between gap-3">
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

              <LogoutButton />
            </div>
          </div>
        </aside>

        <section className={`min-w-0 flex-1 ${contentClassName}`}>
          <header className="border-b border-night-sky/10 bg-white px-4 py-4 lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <Link href="/dashboard" className="block">
                <Image
                  src="/images/ll-logo.svg"
                  alt="LegacyLinks"
                  width={160}
                  height={37}
                  className="h-auto w-40"
                  priority
                />
              </Link>

              <LogoutButton />
            </div>

            <nav
              className="mt-4 flex gap-2 overflow-x-auto pb-1"
              aria-label="Main navigation"
            >
              {primaryLinks.map((link) => (
                <MobileNavLink
                  key={link.href}
                  href={link.href}
                  active={active === link.active}
                >
                  {link.label}
                </MobileNavLink>
              ))}
            </nav>
          </header>

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
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
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

function MobileNavLink({
  href,
  children,
  active = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-night-sky bg-night-sky text-white"
          : "border-night-sky/15 bg-white text-night-sky/75 hover:bg-sand"
      }`}
    >
      {children}
    </Link>
  );
}
