"use client";

// Reproduce el audio de la voz del entrenador sincronizado con el video:
// la voz va en el segundo (video - start). Si el video pausa o salta, la voz lo sigue.
import { useCallback, useEffect, useRef, useState } from "react";

export function useVoiceSync(opts: {
  url: string | null;
  start: number;
  now: number;
  paused: boolean;
  enabled?: boolean; // false mientras se está grabando
}) {
  const { url, start, now, paused, enabled = true } = opts;
  const audio = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // crear / cambiar el audio
  useEffect(() => {
    if (!url) {
      audio.current = null;
      return;
    }
    const a = new Audio();
    a.preload = "auto";
    a.src = url;
    audio.current = a;
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
      if (audio.current === a) audio.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (audio.current) audio.current.muted = muted;
  }, [muted, url]);

  // seguir al video
  useEffect(() => {
    const a = audio.current;
    if (!a || !url) return;
    const target = now - start;
    const inRange = target >= 0 && (!Number.isFinite(a.duration) || target <= a.duration);
    if (!enabled || paused || !inRange) {
      if (!a.paused) a.pause();
      if (inRange && Math.abs(a.currentTime - target) > 0.25) a.currentTime = target;
      return;
    }
    if (Math.abs(a.currentTime - target) > 0.3) a.currentTime = target;
    if (a.paused) {
      a.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }
  }, [url, start, now, paused, enabled]);

  /** Llamar dentro de un toque del usuario: en iPhone el audio solo "se desbloquea" así. */
  const unlock = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) return;
    const wasMuted = a.muted;
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.muted = wasMuted;
        setBlocked(false);
      })
      .catch(() => {
        a.muted = wasMuted;
      });
  }, []);

  // ¿se está oyendo la voz ahora? (la música baja de volumen mientras tanto)
  const a0 = audio.current;
  const speaking = Boolean(
    url && enabled && !muted && !paused && a0 && Number.isFinite(a0.duration) && now >= start && now - start <= a0.duration
  );

  return { muted, setMuted, blocked, unlock, speaking };
}
