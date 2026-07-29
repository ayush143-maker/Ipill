"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "💊 Rendering Consequences...",
  '📊 Because Someone Said "Trust Me"...',
  "💳 Converting Panic into Data...",
  "⚰️ One Dot. One Story.",
];

const STEP_MS = 1400; // total time each message occupies (visible + fade)
const FADE_MS = 400; // fade in/out duration

interface LoadingIntroProps {
  /** true once the real data fetch has actually finished */
  dataReady: boolean;
  /** called once the intro is fully done and should be unmounted */
  onDone: () => void;
}

export default function LoadingIntro({ dataReady, onDone }: LoadingIntroProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Advance through the message list on a fixed cadence, independent of
  // real data-loading speed — this is a deliberate minimum-duration intro,
  // not a progress indicator.
  useEffect(() => {
    if (sequenceDone) return;

    if (index >= MESSAGES.length - 1) {
      const holdTimer = setTimeout(() => setSequenceDone(true), STEP_MS);
      return () => clearTimeout(holdTimer);
    }

    const fadeOutTimer = setTimeout(() => setVisible(false), STEP_MS - FADE_MS);
    const nextTimer = setTimeout(() => {
      setIndex((i) => i + 1);
      setVisible(true);
    }, STEP_MS);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(nextTimer);
    };
  }, [index, sequenceDone]);

  // Only leave once BOTH the fixed cinematic sequence has played out AND the
  // real data is actually ready — a slow connection extends the intro rather
  // than cutting it short or revealing an unready page.
  useEffect(() => {
    if (sequenceDone && dataReady && !exiting) {
      setExiting(true);
      const t = setTimeout(onDone, FADE_MS);
      return () => clearTimeout(t);
    }
  }, [sequenceDone, dataReady, exiting, onDone]);

  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-bg transition-opacity duration-500 ease-in-out ${
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div
        className="px-6 text-center text-base tracking-wide text-text-secondary transition-all ease-in-out sm:text-lg"
        style={{
          transitionDuration: `${FADE_MS}ms`,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
        }}
      >
        {MESSAGES[index]}
      </div>

      <div className="flex gap-1.5">
        {MESSAGES.map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: i === index ? "#ff2fb0" : "#3a3a4a",
            }}
          />
        ))}
      </div>
    </div>
  );
}
