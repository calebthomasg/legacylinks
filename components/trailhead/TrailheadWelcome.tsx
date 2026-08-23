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
    title: "Found the treasure box? Here’s what to do next.",
    body: (
      <>
        <p>Open the treasure box and look for the <strong>Scan Here</strong> marker inside. Tap it with your phone to mark your find and reveal what you’ve discovered.</p>
        <p>Sometimes it’s a story. Sometimes it’s treasure. Sometimes it’s the first step toward wherever the trail leads next.</p>
        <p className="font-bold text-[#0d2144]">Now get out there, trailblazer. There’s a story waiting for you.</p>
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

  function replay() {
    setStep(0);
    setOpen(true);
  }

  const card = cards[step];
  const isLast = step === cards.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={replay}
        className="fixed bottom-5 right-5 z-[80] flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-[#0d2144] text-xl font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-[#54b1ee]/35 lg:bottom-6 lg:right-6"
        aria-label="How to use Trailhead"
        title="How to use Trailhead"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d2144]/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="trailhead-welcome-title">
          <div className="relative flex h-[min(700px,94dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[#0d2144]/10 bg-[#f5f2e8] shadow-2xl md:h-[640px] md:flex-row">
            <button onClick={finish} className="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-[#0d2144]/65 transition hover:text-[#0d2144]" aria-label="Skip Trailhead introduction">Skip introduction</button>

            <div className="relative flex h-[210px] shrink-0 items-end justify-center overflow-hidden bg-[#16b7aa]/10 px-6 pt-12 md:h-full md:w-[38%] md:px-8">
              <div className="absolute left-6 top-7 h-16 w-16 rounded-full bg-[#ddb647]/35 blur-xl" />
              <div className="absolute bottom-10 right-4 h-24 w-24 rounded-full bg-[#54b1ee]/30 blur-2xl" />
              <div className="relative flex h-full w-full items-end justify-center">
                <img src="/images/ranger-rowan.svg" alt="Ranger Rowan" className="max-h-[185px] w-auto md:mb-12 md:max-h-[440px]" />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col bg-white px-6 pb-6 pt-14 sm:px-9 md:px-12 md:pb-10 md:pt-14">
              <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0aa99d]">{card.eyebrow}</p>
                <h2 id="trailhead-welcome-title" className="mt-3 max-w-xl text-3xl font-bold leading-tight text-[#0d2144] sm:text-4xl">{card.title}</h2>
                <div className="mt-5 space-y-4 text-[15px] leading-7 text-[#667085] sm:text-base">{card.body}</div>
              </div>

              <div className="mt-5 shrink-0 border-t border-[#0d2144]/10 pt-5">
                <div className="mb-5 flex items-center gap-2" aria-label={`Step ${step + 1} of ${cards.length}`}>
                  {cards.map((_, index) => (
                    <span key={index} className={`h-2 rounded-full transition-all ${index === step ? "w-8 bg-[#16b7aa]" : "w-2 bg-[#0d2144]/15"}`} />
                  ))}
                  <span className="ml-2 text-xs font-semibold text-[#667085]">{step + 1} of {cards.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="rounded-xl px-3 py-3 text-sm font-semibold text-[#667085] transition hover:text-[#0d2144] disabled:invisible">Back</button>
                  <button onClick={() => isLast ? finish() : setStep((value) => value + 1)} className="rounded-xl bg-[#54b1ee] px-5 py-3 text-sm font-bold text-[#0d2144] shadow-[0_4px_0_#168bd2] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none sm:px-6">{card.button}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
