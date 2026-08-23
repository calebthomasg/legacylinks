"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "legacylink:trailhead-welcome:v1";

const cards = [
  {
    eyebrow: "WELCOME TO TRAILHEAD",
    title: "Adventure starts here.",
    body: (
      <>
        <p>Hey there, trailblazer! I’m <strong>Ranger Rowan</strong>, and I’ll be your guide to Trailhead—a world of stories, treasures, and adventures waiting to be discovered.</p>
        <p>Ready? Let me show you how it works.</p>
      </>
    ),
    button: "Lead the way",
  },
  {
    eyebrow: "PICK YOUR ADVENTURE",
    title: "There’s treasure out there. Really.",
    body: (
      <>
        <p>Those markers on the map aren’t just places to visit. Each one leads to a <strong>real treasure box hidden somewhere out in the world.</strong></p>
        <p>Pick one that sounds interesting, check its difficulty and terrain, then hit <strong>Begin Adventure</strong>. Trailhead will help you make your way there.</p>
        <p>Some are easy enough for a first outing. Others will make even a seasoned trailblazer work for it.</p>
      </>
    ),
    button: "So I’m really treasure hunting?",
  },
  {
    eyebrow: "EXPECT THE UNEXPECTED",
    title: "You won’t know what you found until you find it.",
    body: (
      <>
        <p>That’s the fun of it! No two treasure boxes have to hold the same kind of adventure.</p>
        <p>One treasure box might tell you a story. Another might put something in your hand. Another might reveal a trail you didn’t even know was there.</p>
        <p>You could find a special LegacyLink token, a prize to take with you, or even unlock a <strong>hidden treasure box</strong> that wasn’t on your map before.</p>
        <p><strong>Some finds end with the box. Others are only the beginning.</strong></p>
      </>
    ),
    button: "Okay, I’m in",
  },
  {
    eyebrow: "FOLLOW THE TRAIL",
    title: "We’ll get you close. Then it’s up to you.",
    body: (
      <>
        <p>Once your adventure begins, look for the <strong>blue dot</strong> on your map—that’s you. The blue arrow points in the direction your device is facing.</p>
        <p>Follow the map toward the treasure. When you reach the <strong>green search area</strong>, you’re close! Somewhere inside that circle is the treasure box.</p>
        <p>From there, the map takes a back seat. Look around, check the hiding spots, and start hunting.</p>
      </>
    ),
    button: "Got it",
  },
  {
    eyebrow: "YOU FOUND IT!",
    title: "Every adventure leaves a story behind.",
    body: (
      <>
        <p>Found the treasure box? Open it and look for the <strong>Scan Here</strong> marker inside. Tap it with your phone to mark your find and reveal what you’ve discovered.</p>
        <p>Sometimes it’s a story. Sometimes it’s treasure. Sometimes it’s the first step toward wherever the trail leads next.</p>
        <p className="font-bold text-night-sky">Now get out there, trailblazer. There’s a story waiting for you.</p>
      </>
    ),
    button: "Start exploring",
  },
];

export default function TrailheadWelcome() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(STORAGE_KEY) !== "seen");
    } catch {
      setOpen(true);
    }
  }, []);

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "seen");
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  const card = cards[step];
  const isLast = step === cards.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-night-sky/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="trailhead-welcome-title">
      <div className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-night-sky/10 bg-sand shadow-2xl md:min-h-[570px] md:flex-row">
        <button onClick={finish} className="absolute right-4 top-4 z-10 rounded-full bg-white/80 px-3 py-2 text-xs font-semibold text-night-sky/60 transition hover:text-night-sky" aria-label="Skip Trailhead introduction">Skip introduction</button>

        <div className="relative flex min-h-[180px] items-end justify-center overflow-hidden bg-teal/10 px-6 pt-12 md:min-h-full md:w-[38%] md:px-8">
          <div className="absolute left-6 top-7 h-16 w-16 rounded-full bg-sunshine/35 blur-xl" />
          <div className="absolute bottom-10 right-4 h-24 w-24 rounded-full bg-sky-blue/30 blur-2xl" />
          <div className="relative mb-5 flex h-36 w-36 items-center justify-center rounded-full border-2 border-dashed border-teal/30 bg-white/70 text-center shadow-sm md:mb-16 md:h-52 md:w-52">
            <div>
              <div className="mx-auto mb-2 text-5xl md:text-7xl">🧭</div>
              <p className="px-4 text-xs font-bold uppercase tracking-[0.16em] text-teal">Ranger Rowan</p>
              <p className="mt-1 px-5 text-[11px] leading-4 text-night-sky/55">Character art placeholder for this draft</p>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white px-6 pb-6 pt-16 sm:px-9 md:px-12 md:pb-10 md:pt-14">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">{card.eyebrow}</p>
            <h2 id="trailhead-welcome-title" className="mt-3 max-w-xl text-3xl font-bold leading-tight text-night-sky sm:text-4xl">{card.title}</h2>
            <div className="mt-5 space-y-4 text-[15px] leading-7 text-night-sky/70 sm:text-base">{card.body}</div>
          </div>

          <div className="mt-7 border-t border-night-sky/10 pt-5">
            <div className="mb-5 flex items-center gap-2" aria-label={`Step ${step + 1} of ${cards.length}`}>
              {cards.map((_, index) => (
                <span key={index} className={`h-2 rounded-full transition-all ${index === step ? "w-8 bg-teal" : "w-2 bg-night-sky/15"}`} />
              ))}
              <span className="ml-2 text-xs font-semibold text-night-sky/45">{step + 1} of {cards.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="rounded-xl px-3 py-3 text-sm font-semibold text-night-sky/60 transition hover:text-night-sky disabled:invisible">Back</button>
              <button onClick={() => isLast ? finish() : setStep((value) => value + 1)} className="rounded-xl bg-sky-blue px-5 py-3 text-sm font-bold text-white shadow-[0_4px_0_#168bd2] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none sm:px-6">{card.button}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
