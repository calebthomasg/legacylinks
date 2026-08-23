"use client";

import { ChangeEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Props = { token: string };
const MAX_PHOTOS = 5;

export default function TreasureFindFeedback({ token }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueType, setIssueType] = useState("damaged");
  const [issueDescription, setIssueDescription] = useState("");

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []).filter(file => file.type.startsWith("image/")).slice(0, MAX_PHOTOS);
    setPhotos(chosen);
    setStatus(chosen.length ? `${chosen.length} ${chosen.length === 1 ? "photo" : "photos"} ready to add.` : null);
  }

  async function uploadPhotos() {
    if (!photos.length) return [] as string[];
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");
    const uploaded: string[] = [];
    for (const [index, file] of photos.entries()) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${token}/${Date.now()}-${index}.${extension}`;
      const { error } = await supabase.storage.from("trail-log-images").upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (error) throw error;
      uploaded.push(path);
    }
    return uploaded;
  }

  async function saveFeedback() {
    if (!rating) { setStatus("Choose a star rating before sharing your experience."); return; }
    setSaving(true); setStatus(photos.length ? "Uploading your trail photos…" : null);
    try {
      const photoPaths = await uploadPhotos();
      const supabase = createClient();
      const { error } = await supabase.rpc("submit_treasure_box_feedback", { p_public_token: token, p_rating: rating, p_comment: comment, p_photo_paths: photoPaths });
      if (error) throw error;
      setStatus("Thanks, trailblazer! Your find has been added to the trail log.");
    } catch {
      setStatus("We couldn’t save that just yet. Please try again.");
    } finally { setSaving(false); }
  }

  async function reportIssue() {
    setSaving(true); setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("report_treasure_box_issue", { p_public_token: token, p_issue_type: issueType, p_description: issueDescription });
    setSaving(false);
    if (error) setStatus("We couldn’t send that report just yet. Please try again.");
    else { setStatus("Thanks for the heads-up. We’ll take a look."); setIssueOpen(false); setIssueDescription(""); }
  }

  return <section className="mt-8 border-t border-night-sky/10 pt-8">
    <p className="text-sm font-semibold uppercase tracking-wide text-teal">Add to the trail log</p>
    <h2 className="mt-2 text-2xl font-bold text-night-sky">How was your adventure?</h2>
    <p className="mt-2 leading-7 text-night-sky/65">Rate your experience and leave a note for the trailblazers who come after you.</p>
    <div className="mt-6"><p className="text-sm font-semibold text-night-sky">Your rating</p><div className="mt-2 flex gap-1" aria-label="Choose a rating from one to five stars">{[1,2,3,4,5].map(star => <button key={star} type="button" onClick={() => setRating(star)} className={`text-3xl transition hover:scale-110 ${star <= rating ? "text-[#ddb647]" : "text-night-sky/20"}`} aria-label={`${star} star${star === 1 ? "" : "s"}`}>★</button>)}</div></div>
    <label className="mt-5 block text-sm font-semibold text-night-sky" htmlFor="treasure-comment">Leave a comment <span className="font-normal text-night-sky/45">(optional)</span></label>
    <textarea id="treasure-comment" value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} rows={4} placeholder="What should the next trailblazer know about your adventure?" className="mt-2 w-full rounded-2xl border border-night-sky/15 bg-white p-4 text-night-sky outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15" />
    <div className="mt-4 rounded-2xl border border-dashed border-night-sky/20 bg-sand/60 p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-night-sky">Add photos</p><p className="mt-1 text-xs text-night-sky/50">Share up to {MAX_PHOTOS} pictures from your find.</p></div><label className="cursor-pointer rounded-xl border border-night-sky/15 bg-white px-4 py-2 text-sm font-bold text-night-sky">Choose photos<input type="file" accept="image/*" multiple onChange={choosePhotos} className="sr-only" /></label></div>{photos.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{photos.map((photo,i)=><span key={`${photo.name}-${i}`} className="max-w-full truncate rounded-full bg-white px-3 py-1 text-xs font-semibold text-night-sky/65">{photo.name}</span>)}</div>}</div>
    <button type="button" onClick={saveFeedback} disabled={saving} className="button-primary mt-4 inline-flex">{saving ? "Saving…" : "Add to trail log"}</button>
    <div className="mt-6 rounded-2xl border border-night-sky/10 bg-sand p-4"><button type="button" onClick={() => setIssueOpen(v => !v)} className="flex w-full items-center gap-3 text-left font-semibold text-night-sky"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97370]/15 text-[#ac3b3b]">!</span><span>Something wrong with this treasure box?</span></button>{issueOpen && <div className="mt-4 border-t border-night-sky/10 pt-4"><label className="text-sm font-semibold text-night-sky" htmlFor="issue-type">What happened?</label><select id="issue-type" value={issueType} onChange={e => setIssueType(e.target.value)} className="mt-2 w-full rounded-xl border border-night-sky/15 bg-white p-3 text-night-sky"><option value="damaged">Treasure box is damaged</option><option value="missing">Treasure box is missing</option><option value="scan_problem">Scan marker / NFC isn’t working</option><option value="other">Something else</option></select><textarea value={issueDescription} onChange={e => setIssueDescription(e.target.value)} maxLength={2000} rows={3} placeholder="Tell us what you noticed…" className="mt-3 w-full rounded-xl border border-night-sky/15 bg-white p-3 text-night-sky" /><button type="button" onClick={reportIssue} disabled={saving} className="mt-3 rounded-xl border border-[#ac3b3b]/25 px-4 py-2 text-sm font-semibold text-[#ac3b3b]">Send report</button></div>}</div>
    {status && <p className="mt-4 text-sm font-semibold text-night-sky/70" role="status">{status}</p>}
  </section>;
}
