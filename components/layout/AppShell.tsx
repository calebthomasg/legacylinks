"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChatPresenceHeartbeat } from "@/components/chat/useChatActivity";
import LogoutButton from "@/components/auth/LogoutButton";

type AppShellProps = {
  active?: "journal"|"trailhead"|"tree"|"gallery"|"family"|"find-family"|"family-chat"|"profile"|null;
  userEmail?: string|null; userName?: string|null; profileHref?: string; isAdmin?: boolean; children:React.ReactNode; contentClassName?:string;
};
function getPrimaryLinks(profileHref:string){return [{href:"/dashboard",label:"Journal",active:"journal"},{href:"/trailhead",label:"Trailhead",active:"trailhead"},{href:"/tree",label:"My Family Tree",active:"tree"},{href:profileHref,label:"Profile",active:"profile"},{href:"/gallery",label:"Photo Gallery",active:"gallery"},{href:"/family",label:"Manage Family",active:"family"},{href:"/family/connect",label:"Find Family",active:"find-family"},{href:"/family-chat",label:"Family Chat",active:"family-chat"}] as const}
const comingLaterLinks=["Family Feed","Clans","FamilySearch Sync","Bedtime Stories"];
export default function AppShell({active,userEmail,userName="LegacyLinks",profileHref="/family",isAdmin=false,children,contentClassName="bg-sand"}:AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  const isFamilyChat = active === "family-chat";
  const primaryLinks = getPrimaryLinks(profileHref);

  useEffect(() => {
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!isFamilyChat || !shell || !viewport) return;
    let frame = 0;

    function updateViewport() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!viewport || !shell) return;
        // Match the absolute frame to the visible area in document coordinates.
        // Safari can scroll the document and pan the visual viewport on focus.
        shell.style.setProperty("--chat-viewport-top", `${Math.max(0, viewport.pageTop)}px`);
        shell.style.setProperty("--chat-viewport-height", `${viewport.height}px`);
      });
    }

    updateViewport();
    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("scroll", updateViewport, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("scroll", updateViewport);
      shell.style.removeProperty("--chat-viewport-top");
      shell.style.removeProperty("--chat-viewport-height");
    };
  }, [isFamilyChat]);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    if (isFamilyChat) return () => window.removeEventListener("keydown", closeOnEscape);

    const scrollY = window.scrollY;
    const { style } = document.body;
    const previous = { position: style.position, top: style.top, width: style.width, overflow: style.overflow };
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";
    style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      Object.assign(style, previous);
      window.scrollTo(0, scrollY);
    };
  }, [isFamilyChat, isMobileNavOpen]);
const accountFooter = (
  <>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-night-sky">{userName}</p>
        {userEmail && <p className="truncate text-xs text-night-sky/60">{userEmail}</p>}
      </div>
      <Link href="/profile" aria-label="Account settings" title="Account settings"
        onClick={() => setIsMobileNavOpen(false)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-night-sky/70 hover:bg-sand hover:text-night-sky focus-visible:outline-2 focus-visible:outline-teal">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831 2.34 2.34 0 0 1 2.33-4.033 2.34 2.34 0 0 0 3.32-1.915Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </Link>
    </div>
    <div className="mt-4"><LogoutButton/></div>
  </>
);
const nav=(mobile=false)=><div className="space-y-1">{primaryLinks.map(link=><SidebarLink key={link.href} href={link.href} active={active===link.active} onClick={mobile?()=>setIsMobileNavOpen(false):undefined}>{link.label}</SidebarLink>)}{isAdmin&&<div className="pt-4"><div className="mb-2 h-0.5 rounded-full bg-teal"/><SidebarLink href="/admin" onClick={mobile?()=>setIsMobileNavOpen(false):undefined}>Admin</SidebarLink></div>}<div className="pt-6"><p className="px-4 text-xs font-semibold uppercase tracking-[0.2em] text-night-sky/40">Coming later</p></div>{comingLaterLinks.map(label=><SidebarLink key={label} href="#" disabled>{label}</SidebarLink>)}</div>;
return <main ref={shellRef} data-family-chat-viewport={isFamilyChat || undefined} className={`min-h-screen bg-white text-night-sky ${isFamilyChat ? "max-lg:absolute max-lg:inset-x-0 max-lg:top-[var(--chat-viewport-top,0px)] max-lg:h-[var(--chat-viewport-height,100dvh)] max-lg:min-h-0 max-lg:overflow-hidden" : ""}`}>{userEmail && <ChatPresenceHeartbeat />}<div className={`flex min-h-screen ${isFamilyChat ? "max-lg:h-full max-lg:min-h-0" : ""}`}><aside className="hidden w-[280px] shrink-0 border-r border-night-sky/10 bg-white lg:flex lg:flex-col"><div className="border-b border-night-sky/10 px-8 py-8"><Link href="/dashboard" className="block"><Image src="/images/ll-logo.svg" alt="LegacyLinks" width={192} height={44} className="h-auto w-48" priority/></Link></div><nav className="flex-1 px-4 py-6" aria-label="Main navigation">{nav()}</nav><div className="border-t border-night-sky/10 px-6 py-5">{accountFooter}</div></aside><section className={`min-w-0 flex-1 ${contentClassName} ${isFamilyChat ? "max-lg:relative max-lg:flex max-lg:h-full max-lg:flex-col max-lg:overflow-hidden" : ""}`}><header className={`z-[60] border-b border-night-sky/10 bg-white px-4 py-4 shadow-sm lg:hidden ${isFamilyChat ? "relative shrink-0" : "fixed inset-x-0 top-0"}`}><div className="grid grid-cols-[44px_1fr_44px] items-center gap-3"><button type="button" onClick={()=>setIsMobileNavOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-night-sky/15 bg-white text-night-sky shadow-sm" aria-label="Open navigation" aria-expanded={isMobileNavOpen}><span className="flex w-5 flex-col gap-1.5"><span className="h-0.5 rounded-full bg-current"/><span className="h-0.5 rounded-full bg-current"/><span className="h-0.5 rounded-full bg-current"/></span></button><Link href="/dashboard" className="block"><Image src="/images/ll-logo.svg" alt="LegacyLinks" width={160} height={37} className="mx-auto h-auto w-40" priority/></Link><div aria-hidden="true"/></div></header>{!isFamilyChat && <div className="h-[77px] lg:hidden" aria-hidden="true"/>}<div className={`${isFamilyChat ? "absolute" : "fixed"} inset-0 z-[70] lg:hidden ${isMobileNavOpen?"pointer-events-auto":"pointer-events-none"}`} aria-hidden={!isMobileNavOpen}><button type="button" onClick={()=>setIsMobileNavOpen(false)} className={`absolute inset-0 bg-night-sky/40 transition-opacity ${isMobileNavOpen?"opacity-100":"opacity-0"}`} aria-label="Close navigation"/><aside className={`relative flex ${isFamilyChat ? "h-full" : "h-dvh"} w-[min(82vw,320px)] flex-col overflow-hidden border-r border-night-sky/10 bg-white shadow-2xl transition-transform duration-300 ${isMobileNavOpen?"translate-x-0":"-translate-x-full"}`}><div className="shrink-0 border-b border-night-sky/10 px-6 py-6"><div className="flex items-center justify-between gap-4"><Link href="/dashboard" className="block" onClick={()=>setIsMobileNavOpen(false)}><Image src="/images/ll-logo.svg" alt="LegacyLinks" width={176} height={40} className="h-auto w-44" priority/></Link><button type="button" onClick={()=>setIsMobileNavOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-night-sky/15 text-xl leading-none text-night-sky" aria-label="Close navigation">×</button></div></div><nav className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-6" aria-label="Main navigation">{nav(true)}</nav><div className="shrink-0 border-t border-night-sky/10 bg-white px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{accountFooter}</div></aside></div>{children}</section></div></main>}
function SidebarLink({href,children,active=false,disabled=false,onClick}:{href:string;children:React.ReactNode;active?:boolean;disabled?:boolean;onClick?:()=>void}){if(disabled)return <div className="flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium text-night-sky/40"><span>{children}</span></div>;return <Link href={href} onClick={onClick} className={`flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium transition ${active?"bg-night-sky text-white":"text-night-sky/75 hover:bg-sand hover:text-night-sky"}`}><span>{children}</span></Link>}
