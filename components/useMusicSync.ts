"use client";

// Música de fondo pegada al video: suena mientras el video corre, se repite si la canción
// es más corta y baja de volumen mientras habla el entrenador ("ducking").
// El volumen se controla con Web Audio (en iPhone el volumen normal del audio no funciona);
// si el almacenamiento no permite Web Audio, se usa el volumen normal como respaldo.
import { useCallback, useEffect, useRef, useState } from "react";

const DUCK = 0.3;

export function useMusicSync(opts: {
  url: string | null;
  volume: number; // 0..1
  now: number;
  paused: boolean;
  enabled?: boolean;
  duck?: boolean; // true mientras se oye la voz
}) {
  const { url, volume, now, paused: pausedRaw, enabled = true, duck = false } = opts;
  // El estado "pausado" a veces parpadea al cargar el video; se ignora si dura muy poco.
  const [paused, setPaused] = useState(pausedRaw);
  useEffect(() => {
    if (!pausedRaw) {
      setPaused(false);
      return;
    }
    const id = setTimeout(() => setPaused(true), 180);
    return () => clearTimeout(id);
  }, [pausedRaw]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const useWeb = useRef(true);
  const lastNow = useRef(0);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [version, setVersion] = useState(0); // cambia si hay que rehacer el audio (respaldo)

  const target = muted ? 0 : volume * (duck ? DUCK : 1);

  const applyGain = useCallback(
    (v: number) => {
      const a = audio.current;
      if (!a) return;
      if (gain.current && ctx.current) gain.current.gain.setTargetAtTime(v, ctx.current.currentTime, 0.15);
      else a.volume = Math.max(0, Math.min(1, v));
    },
    []
  );

  useEffect(() => {
    if (!url) {
      audio.current = null;
      return;
    }
    const a = new Audio();
    a.preload = "auto";
    a.loop = true;
    if (useWeb.current) a.crossOrigin = "anonymous";
    a.src = url;
    const onError = () => {
      // Sin permiso CORS no hay Web Audio: reintentamos con audio normal.
      if (useWeb.current && a.crossOrigin) {
        useWeb.current = false;
        gain.current = null;
        setVersion((v) => v + 1);
      }
    };
    a.addEventListener("error", onError);
    audio.current = a;
    gain.current = null;
    a.volume = Math.max(0, Math.min(1, target));
    return () => {
      a.removeEventListener("error", onError);
      a.pause();
      a.removeAttribute("src");
      a.load();
      if (audio.current === a) audio.current = null;
      gain.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, version]);

  useEffect(() => {
    applyGain(target);
  }, [target, applyGain, url, version]);

  // seguir al video
  useEffect(() => {
    const a = audio.current;
    if (!a || !url) return;
    const jumped = Math.abs(now - lastNow.current) > 0.7;
    lastNow.current = now;
    if (!enabled || paused) {
      if (!a.paused) a.pause();
      return;
    }
    const d = a.duration;
    if ((a.paused || jumped) && Number.isFinite(d) && d > 0) {
      const t = now % d;
      if (Math.abs(a.currentTime - t) > 0.3) a.currentTime = t;
    }
    if (a.paused) {
      ctx.current?.resume?.();
      a.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }
  }, [url, now, paused, enabled]);

  /** Llamar dentro de un toque del usuario (iPhone solo deja sonar audio después de un toque). */
  const unlock = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (useWeb.current && !gain.current) {
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
          if (!ctx.current) ctx.current = new AC();
          const src = ctx.current!.createMediaElementSource(a);
          const g = ctx.current!.createGain();
          g.gain.value = target;
          src.connect(g);
          g.connect(ctx.current!.destination);
          gain.current = g;
        }
      } catch {
        useWeb.current = false;
      }
    }
    ctx.current?.resume?.();
    if (a.paused) {
      const was = a.muted;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.muted = was;
        })
        .catch(() => {
          a.muted = was;
        });
    }
  }, [target]);

  return { muted, setMuted, blocked, unlock };
}
