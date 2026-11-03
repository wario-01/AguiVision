"use client";

// Reproductor de highlights con los dibujos del entrenador encima.
// Si no hay dibujos, se ve igual que el reproductor normal.
import { useEffect, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import AnnotationLayer from "@/components/AnnotationLayer";
import { usePlayerClock } from "@/components/usePlayerClock";
import { useVoiceSync } from "@/components/useVoiceSync";
import { useMusicSync } from "@/components/useMusicSync";
import type { Anno } from "@/lib/annotations";

export default function AnnotatedPlayer({
  playbackId,
  annotations,
  voice,
  music,
}: {
  playbackId: string;
  annotations: Anno[];
  voice?: { url: string; start: number } | null;
  music?: { url: string; volume: number; title?: string } | null;
}) {
  const ref = useRef<any>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const { now, paused } = usePlayerClock(ref);
  const fired = useRef(new Set<string>());
  const lastNow = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vs = useVoiceSync({ url: voice?.url ?? null, start: voice?.start ?? 0, now, paused });
  const ms = useMusicSync({ url: music?.url ?? null, volume: music?.volume ?? 0.25, now, paused, duck: vs.speaking });
  const unlockAll = () => {
    vs.unlock();
    ms.unlock();
  };

  // Pausas automáticas: el video se detiene unos segundos cuando aparece un dibujo con pausa.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (now < lastNow.current - 0.5) {
      // el usuario regresó el video: los dibujos de ahí en adelante vuelven a pausar
      for (const a of annotations) if (a.t > now - 0.1) fired.current.delete(a.id);
    }
    lastNow.current = now;
    if (paused || voice) return; // con voz, el video no se detiene solo (la voz va pegada al video)
    for (const a of annotations) {
      if (a.pause > 0 && !fired.current.has(a.id) && now >= a.t && now < a.t + 0.6) {
        fired.current.add(a.id);
        el.pause();
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (ref.current?.paused) ref.current.play?.();
        }, a.pause * 1000);
        break;
      }
    }
  }, [now, paused, annotations, voice]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div>
    <div className="rounded-2xl overflow-hidden border border-border" onPointerDownCapture={unlockAll}>
      <div className="relative w-full" style={{ aspectRatio: String(aspect) }}>
        <MuxPlayer
          ref={ref}
          playbackId={playbackId}
          streamType="on-demand"
          accentColor="#F9E547"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          onLoadedMetadata={() => {
            const w = Number(ref.current?.videoWidth);
            const h = Number(ref.current?.videoHeight);
            if (w > 0 && h > 0) setAspect(w / h);
          }}
        />
        <AnnotationLayer annos={annotations} aspect={aspect} now={now} />
      </div>
    </div>
    {(voice || music) && (
      <div className="flex items-center gap-2 mt-2 text-xs font-bold text-muted flex-wrap">
        {voice && (
          <button type="button" onClick={() => { vs.setMuted(!vs.muted); unlockAll(); }} className="bg-panel border border-border rounded-lg px-3 py-1.5 text-text">
            {vs.muted ? "🔇 Activar voz" : "🎙 Silenciar voz"}
          </button>
        )}
        {music && (
          <button type="button" onClick={() => { ms.setMuted(!ms.muted); unlockAll(); }} className="bg-panel border border-border rounded-lg px-3 py-1.5 text-text">
            {ms.muted ? "🔇 Activar música" : "🎵 Silenciar música"}
          </button>
        )}
        {(vs.blocked || ms.blocked) && <span className="text-goldText">Toca el video para activar el sonido</span>}
      </div>
    )}
    </div>
  );
}
