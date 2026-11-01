"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Notification = {
  id: string;
  event_type: "signup" | "treasure_find";
  person_name: string;
  box_title: string | null;
  box_code: string | null;
  occurred_at: string;
  created_at: string;
  is_read: boolean;
};
type Feed = { rows: Notification[]; total: number; unread: number };

export default function AdminNotifications() {
  const supabase = useMemo(() => createClient(), []);
  const [feed, setFeed] = useState<Feed>({ rows: [], total: 0, unread: 0 });
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    try {
      const { data, error } = await supabase.rpc("list_admin_notifications", {
        p_filter: filter, p_offset: page * 20,
      });
      if (sequence !== request.current) return;
      if (error) throw error;
      const next = data as Feed;
      if (page > 0 && !next.rows.length) { setPage(0); return; }
      setFeed(next);
      setError(null);
    } catch {
      if (sequence === request.current) setError("Unable to load notifications. Please try again.");
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [supabase, filter, page]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void refresh(); }, 0);
    const invalidate = () => { request.current++; };
    const channel = supabase.channel("admin-notification-center")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, () => { void refresh(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notification_reads" }, () => { void refresh(); })
      .subscribe((status) => { if (status === "SUBSCRIBED") void refresh(); });
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initialLoad);
      invalidate();
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  async function markRead(id?: string) {
    setBusy(true);
    try {
      // A server timestamp from the latest loaded event avoids client clock drift.
      const cutoff = feed.rows[0]?.created_at;
      if (!id && !cutoff) return;
      const { error } = await supabase.rpc("mark_admin_notifications_read", {
        p_notification_id: id ?? null, p_through: id ? null : cutoff,
      });
      if (error) throw error;
      await refresh();
    } catch {
      setError("Unable to mark notifications as read. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <section id="admin-notifications" aria-labelledby="notification-heading" className="mt-8 rounded-3xl border border-night-sky/10 bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Activity</p>
          <h2 id="notification-heading" className="mt-1 flex items-center gap-3 text-xl font-bold">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
            Notifications
            <span aria-live="polite" className="rounded-full bg-teal/10 px-3 py-1 text-xs text-teal">{feed.unread} unread</span>
          </h2>
          <p className="mt-2 text-sm text-night-sky/55">New accounts and treasure finds. Read status is personal to you.</p>
        </div>
        <div className="flex gap-4 text-sm font-bold text-teal">
          <button type="button" onClick={() => { void refresh(); }} disabled={loading || busy}>Refresh</button>
          <button type="button" onClick={() => { void markRead(); }} disabled={busy || loading || !feed.unread || page !== 0 || filter !== "all" || !!error} className="disabled:opacity-40">Mark all as read</button>
        </div>
      </div>
      <label className="mt-5 block text-xs font-semibold text-night-sky/60">
        Show notifications
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); setLoading(true); }} className="ml-3 rounded-xl border border-night-sky/15 bg-white px-3 py-2 text-sm text-night-sky">
          <option value="all">All activity</option><option value="unread">Unread</option><option value="signup">New accounts</option><option value="treasure_find">Treasure finds</option>
        </select>
      </label>
      {error && <p role="alert" className="mt-4 rounded-xl bg-coral/10 p-3 text-sm">{error}</p>}
      {loading ? <p role="status" className="py-8 text-sm text-night-sky/55">Loading notifications…</p> : !error && !feed.rows.length ? <p className="py-8 text-sm text-night-sky/55">{filter === "unread" ? "You’re all caught up." : "No notifications yet. New activity will appear here automatically."}</p> : (
        <ul className="mt-4 divide-y divide-night-sky/10">
          {feed.rows.map((n) => <li key={n.id} className={`flex flex-wrap items-center justify-between gap-4 rounded-xl px-4 py-4 ${n.is_read ? "" : "bg-teal/5"}`}>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-teal">{n.event_type === "signup" ? "New account created" : "Treasure box found"}{!n.is_read && <span className="ml-2 text-night-sky/60">· Unread</span>}</p>
              <p className="mt-1 break-words text-sm"><strong>{n.person_name}</strong>{n.event_type === "signup" ? " joined LegacyLink." : <> found <strong>{n.box_title || "a treasure box"}</strong>{n.box_code ? ` · ${n.box_code}` : ""}.</>}</p>
              <p className="mt-1 text-xs text-night-sky/55">{n.event_type === "signup" ? "Account created: " : "Found: "}<time dateTime={n.occurred_at}>{new Date(n.occurred_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></p>
            </div>
            {!n.is_read && <button type="button" disabled={busy || loading} onClick={() => { void markRead(n.id); }} className="text-xs font-bold text-teal disabled:opacity-40">Mark as read</button>}
          </li>)}
        </ul>
      )}
      {feed.total > 20 && <div className="mt-4 flex items-center justify-between text-sm">
        <button disabled={!page || loading} onClick={() => { setPage(page - 1); setLoading(true); }} className="font-bold text-teal disabled:opacity-40">Previous</button>
        <span>Page {page + 1} of {Math.ceil(feed.total / 20)}</span>
        <button disabled={(page + 1) * 20 >= feed.total || loading} onClick={() => { setPage(page + 1); setLoading(true); }} className="font-bold text-teal disabled:opacity-40">Next</button>
      </div>}
    </section>
  );
}
