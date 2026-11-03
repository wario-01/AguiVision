"use client";

// Reproductor de highlights con los dibujos del entrenador encima.
// Si no hay dibujos, se ve igual que el reproductor normal.
import { useEffect, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import AnnotationLayer from "@/components/AnnotationLayer";
import { usePlayerClock } from "@/components/usePlayerClock";
import type { Anno } from "@/lib/annotations";

export default function AnnotatedPlayer({ playbackId, annotations }: { playbackId: string; annotations: Anno[] }) {
  const ref = useRef<any>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const { now, paused } = usePlayerClock(ref);
  const fired = useRef(new Set<string>());
  const lastNow = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pausas automáticas: el video se detiene unos segundos cuando aparece un dibujo con pausa.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (now < lastNow.current - 0.5) {
      // el usuario regresó el video: los dibujos de ahí en adelante vuelven a pausar
      for (const a of annotations) if (a.t > now - 0.1) fired.current.delete(a.id);
    }
    lastNow.current = now;
    if (paused) return;
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
  }, [now, paused, annotations]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-border">
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
  );
}
