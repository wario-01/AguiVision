"use client";

// Reproductor de highlights con los dibujos del entrenador encima.
// Si no hay dibujos, se ve igual que el reproductor normal.
import { useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import AnnotationLayer from "@/components/AnnotationLayer";
import { usePlayerClock } from "@/components/usePlayerClock";
import { usePresentation } from "@/components/usePresentation";
import { useVoiceSync } from "@/components/useVoiceSync";
import { useMusicSync } from "@/components/useMusicSync";
import type { Anno } from "@/lib/annotations";
import type { CamTrack } from "@/lib/camera-track";

export default function AnnotatedPlayer({
  playbackId,
  annotations,
  voice,
  music,
  camTrack,
}: {
  camTrack?: CamTrack | null;
  playbackId: string;
  annotations: Anno[];
  voice?: { url: string; start: number; pauses?: boolean } | null;
  music?: { url: string; volume: number; title?: string } | null;
}) {
  const ref = useRef<any>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const { now, paused } = usePlayerClock(ref);
  // Las pausas de los dibujos se respetan, salvo con una voz grabada antes de que existieran las pausas.
  const pres = usePresentation(ref, annotations, now, paused, !voice || voice.pauses === true);
  const vs = useVoiceSync({ url: voice?.url ?? null, start: voice?.start ?? 0, now: pres.pNow, paused: pres.userPaused });
  const ms = useMusicSync({ url: music?.url ?? null, volume: music?.volume ?? 0.25, now: pres.pNow, paused: pres.userPaused, duck: vs.speaking });
  const unlockAll = () => {
    vs.unlock();
    ms.unlock();
  };

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
        <AnnotationLayer annos={annotations} aspect={aspect} now={now} track={camTrack} />
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
