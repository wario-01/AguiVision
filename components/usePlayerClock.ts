"use client";

// Lee el reloj del reproductor (segundo actual, duración, pausa) unas 30 veces por segundo.
import { useEffect, useState } from "react";

export function usePlayerClock(ref: { current: any }) {
  const [s, setS] = useState({ now: 0, duration: 0, paused: true });
  useEffect(() => {
    let raf = 0;
    let lastNow = -1;
    let lastPaused = true;
    let lastDur = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const now = Number(el.currentTime) || 0;
        const dur = Number(el.duration) || 0;
        const paused = !!el.paused;
        if (Math.abs(now - lastNow) > 0.03 || paused !== lastPaused || dur !== lastDur) {
          lastNow = now;
          lastPaused = paused;
          lastDur = dur;
          setS({ now, duration: dur, paused });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
  return s;
}
