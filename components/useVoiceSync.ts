"use client";

// Reproduce la voz del entrenador sincronizada con el video.
// Se decodifica TODO el audio en memoria (Web Audio) y se arranca desde el segundo exacto que
// toca. Así no depende de "saltar" dentro de un archivo grabado por el navegador (que en
// Firefox/Chrome no trae duración ni índice y se reinicia o se corta al saltar).
// Funciona igual en Firefox, Chrome y Safari. Si el video se atora cargando, la voz se detiene.
import { useCallback, useEffect, useRef, useState } from "react";

let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

const DRIFT = 0.25; // si la voz se desfasa más de esto respecto al video, se reacomoda
const STALL_MS = 250; // el video lleva este tiempo sin avanzar estando "en play": se atoró cargando

export function useVoiceSync(opts: {
  url: string | null;
  start: number;
  now: number;
  paused: boolean;
  enabled?: boolean; // false mientras se está grabando
}) {
  const { url, start, now, paused, enabled = true } = opts;
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [stalled, setStalled] = useState(false);
  const src = useRef<{ node: AudioBufferSourceNode; ctxStart: number; offset: number } | null>(null);
  const gain = useRef<GainNode | null>(null);
  const lastAdv = useRef({ now: 0, at: 0 });

  // descargar y decodificar el audio
  useEffect(() => {
    setBuffer(null);
    if (!url) return;
    let cancelled = false;
    (async () => {
      try {
        const ctx = getCtx();
        if (!ctx) return;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.arrayBuffer();
        const buf = await new Promise<AudioBuffer>((ok, bad) => ctx.decodeAudioData(data.slice(0), ok, bad));
        if (!cancelled) setBuffer(buf);
      } catch {
        // si no se puede decodificar, la voz simplemente no suena
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const stop = useCallback(() => {
    const s = src.current;
    if (s) {
      try {
        s.node.onended = null;
        s.node.stop();
      } catch {}
      try {
        s.node.disconnect();
      } catch {}
      src.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => stop(), [url, buffer, stop]);

  useEffect(() => {
    if (gain.current) gain.current.gain.value = muted ? 0 : 1;
  }, [muted]);

  // ¿el video avanza? (si dice "play" pero el segundo no cambia, se está cargando)
  useEffect(() => {
    const t = performance.now();
    if (Math.abs(now - lastAdv.current.now) > 0.001) lastAdv.current = { now, at: t };
    if (paused) lastAdv.current = { now, at: t };
    setStalled(false);
  }, [now, paused]);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const s = performance.now() - lastAdv.current.at > STALL_MS;
      setStalled((prev) => (prev === s ? prev : s));
    }, 100);
    return () => clearInterval(id);
  }, [paused]);

  // seguir al video
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx || !buffer) return;
    const target = now - start;
    const inRange = target >= 0 && target < buffer.duration - 0.02;
    if (!enabled || paused || stalled || !inRange) {
      stop();
      return;
    }
    const cur = src.current;
    if (cur) {
      const pos = cur.offset + (ctx.currentTime - cur.ctxStart);
      if (Math.abs(pos - target) <= DRIFT) return; // va bien
      stop();
    }
    if (ctx.state !== "running") {
      ctx.resume().then(() => setBlocked(false)).catch(() => setBlocked(true));
      if (ctx.state !== "running") {
        setBlocked(true);
        return;
      }
    }
    setBlocked(false);
    if (!gain.current || gain.current.context !== ctx) {
      gain.current = ctx.createGain();
      gain.current.connect(ctx.destination);
    }
    gain.current.gain.value = muted ? 0 : 1;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(gain.current);
    node.onended = () => {
      if (src.current?.node === node) src.current = null;
    };
    node.start(0, Math.max(0, target));
    src.current = { node, ctxStart: ctx.currentTime, offset: Math.max(0, target) };
  }, [buffer, start, now, paused, stalled, enabled, muted, stop]);

  /** Llamar dentro de un toque del usuario: en iPhone/Safari el audio solo se "desbloquea" así. */
  const unlock = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state !== "running") ctx.resume().then(() => setBlocked(false)).catch(() => {});
  }, []);

  const speaking = Boolean(
    url && buffer && enabled && !muted && !paused && !stalled && now >= start && now - start <= buffer.duration
  );

  return { muted, setMuted, blocked, unlock, speaking };
}
