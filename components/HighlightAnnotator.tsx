"use client";

// Editor de dibujos para un highlight (computadora y teléfono).
// Computadora: arrastra con el mouse. Teléfono: toca el inicio y luego el final (o arrastra).
// Cada dibujo se puede ajustar después con sus puntos (tocar y mover).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MuxPlayer from "@mux/mux-player-react";
import AnnotationLayer from "@/components/AnnotationLayer";
import { analyzeCamera, deltaFor, shiftAnno, type CamTrack } from "@/lib/camera-track";
import { usePlayerClock } from "@/components/usePlayerClock";
import { useVoiceSync } from "@/components/useVoiceSync";
import { usePresentation } from "@/components/usePresentation";
import { useMusicSync } from "@/components/useMusicSync";
import { exportFinalVideo, exportSupported, uploadToMux } from "@/lib/exportFinalVideo";
import {
  Anno,
  AnnoType,
  ANNO_COLORS,
  DEFAULT_DURATION,
  MAX_ANNOS,
  PAUSE_OPTIONS,
  Pt,
  TYPE_LABELS,
  isActive,
  newId,
} from "@/lib/annotations";

type Tool = "select" | AnnoType;

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Elegir", icon: "↖" },
  { id: "arrow", label: "Flecha", icon: "➜" },
  { id: "rect", label: "Cuadro", icon: "▭" },
  { id: "circle", label: "Círculo", icon: "◯" },
  { id: "text", label: "Texto", icon: "T" },
  { id: "free", label: "Trazo", icon: "✎" },
];

const HINTS: Record<Tool, string> = {
  select: "Toca un dibujo para elegirlo y mover sus puntos. Para dibujar, elige una herramienta (después de cada dibujo se vuelve a Elegir).",
  arrow: "Arrastra, o toca el inicio y luego el final de la flecha.",
  rect: "Arrastra de una esquina a la opuesta, o toca una esquina y luego la otra.",
  circle: "Arrastra de una esquina a la opuesta, o toca una esquina y luego la otra.",
  text: "Toca donde quieres poner el texto y escríbelo abajo.",
  free: "Dibuja con el dedo o el mouse sin soltar.",
};

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};
const round1 = (n: number) => Math.round(n * 10) / 10;
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function bbox(a: Anno, aspect: number): [number, number, number, number] {
  if (a.type === "text") {
    const w = ((a.text ?? "").length * 38 * 0.58 + 28) / 1000;
    const h = 58 / (1000 / aspect);
    return [a.pts[0][0], a.pts[0][1], a.pts[0][0] + w, a.pts[0][1] + h];
  }
  const xs = a.pts.map((p) => p[0]);
  const ys = a.pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export default function HighlightAnnotator({
  teamSlug,
  highlightId,
  playbackId,
  title,
  initial,
  initialVoice,
  r2Ready,
  initialTracks,
  initialMusicId,
  initialMusicVolume,
  initialFinalStatus,
  initialTrack,
  camMissing,
}: {
  initialTrack?: CamTrack | null;
  camMissing?: boolean;
  teamSlug: string;
  highlightId: string;
  playbackId: string;
  title: string;
  initial: Anno[];
  initialVoice: { url: string; start: number; pauses?: boolean } | null;
  r2Ready: boolean;
  initialTracks: { id: string; title: string; url: string; builtin?: boolean }[];
  initialMusicId: string | null;
  initialMusicVolume: number;
  initialFinalStatus: string | null;
}) {
  const playerRef = useRef<any>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const { now, duration, paused } = usePlayerClock(playerRef);

  // Movimiento de cámara: los dibujos siguen la escena (se mide solo al abrir el editor).
  const [track, setTrack] = useState<CamTrack | null>(initialTrack ?? null);
  const [cam, setCam] = useState<{ phase: "idle" | "working" | "done" | "error"; pct: number; text: string }>({
    phase: initialTrack ? "done" : "idle",
    pct: 0,
    text: initialTrack ? "Cámara medida: los dibujos siguen la escena." : "",
  });
  const camTried = useRef(false);
  const camAbort = useRef<AbortController | null>(null);

  const [annos, setAnnos] = useState<Anno[]>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [history, setHistory] = useState<Anno[][]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(ANNO_COLORS[0]);
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Anno | null>(null);
  const [pendingPt, setPendingPt] = useState<Pt | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // voz
  type Pending = { blob: Blob; url: string; start: number; duration: number; mime: string; pauses: boolean };
  const [voice, setVoice] = useState(initialVoice);
  const [pendingVoice, setPendingVoice] = useState<Pending | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const recStartedAt = useRef(0);
  const recVideoStart = useRef(0);
  const wasMuted = useRef(false);
  const activeVoice = pendingVoice ? { url: pendingVoice.url, start: pendingVoice.start, pauses: pendingVoice.pauses } : voice;
  // Pausas de los dibujos: se ejecutan al grabar y al "Probar" (salvo con una voz grabada antes de que existieran las pausas).
  // La voz y la música siguen corriendo mientras el video está congelado ("tiempo de presentación").
  const honor = recording || (previewing && (!activeVoice || activeVoice.pauses === true));
  const pres = usePresentation(playerRef, annos, now, paused, honor);
  const vs = useVoiceSync({
    url: activeVoice?.url ?? null,
    start: activeVoice?.start ?? 0,
    now: pres.pNow,
    paused: pres.userPaused,
    enabled: !recording && (previewing || activeVoice?.pauses !== true),
  });

  // música de fondo
  const [tracks, setTracks] = useState(initialTracks);
  const [musicId, setMusicId] = useState<string | null>(initialMusicId);
  const [musicVol, setMusicVol] = useState(initialMusicVolume);
  const [musicBusy, setMusicBusy] = useState(false);
  const musicTrack = tracks.find((t) => t.id === musicId) ?? null;
  const ms = useMusicSync({ url: musicTrack?.url ?? null, volume: musicVol, now: pres.pNow, paused: pres.userPaused, enabled: !recording, duck: vs.speaking });
  const unlockAll = () => {
    vs.unlock();
    ms.unlock();
  };

  // video final
  type Fin = { phase: "idle" | "recording" | "uploading" | "processing" | "done" | "error"; pct: number; text?: string };
  const [fin, setFin] = useState<Fin>({
    phase: initialFinalStatus === "processing" ? "processing" : "idle",
    pct: 0,
    text: initialFinalStatus === "error" ? "La última vez Mux no pudo procesar el video final. Puedes intentarlo otra vez." : undefined,
  });
  const finBusy = fin.phase === "recording" || fin.phase === "uploading";

  // pantalla completa
  const [full, setFull] = useState(false);
  const [fit, setFit] = useState({ w: 0, h: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  const pending = useRef<Pt | null>(null);
  const gesture = useRef<
    | null
    | { kind: "shape"; start: Pt; moved: boolean }
    | { kind: "free" }
    | { kind: "handle"; id: string; idx: number; last: Pt }
  >(null);

  const dirty = JSON.stringify(annos) !== saved;
  const hasVoice = Boolean(activeVoice);
  const sel = annos.find((a) => a.id === selId) ?? null;
  const sorted = useMemo(() => [...annos].sort((a, b) => a.t - b.t), [annos]);

  // ---------- movimiento de cámara ----------
  const measureCamera = useCallback(async () => {
    camAbort.current?.abort();
    const ac = new AbortController();
    camAbort.current = ac;
    setCam({ phase: "working", pct: 0, text: "Midiendo el movimiento de la cámara..." });
    try {
      const r = await analyzeCamera(
        `https://stream.mux.com/${playbackId}/capped-1080p.mp4`,
        (f) => setCam({ phase: "working", pct: f, text: `Midiendo el movimiento de la cámara ${Math.round(f * 100)}%` }),
        ac.signal
      );
      if (ac.signal.aborted) return;
      const good = r.total > 0 && r.usable / r.total >= 0.4;
      const next = good ? r.track : null;
      if (!camMissing) {
        const res = await fetch("/api/highlights/annotations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ highlightId, camTrack: next }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo guardar la medición");
      }
      setTrack(next);
      setCam(
        good
          ? { phase: "done", pct: 1, text: r.maxShift < 0.01 ? "La cámara casi no se mueve en este clip." : "Cámara medida: los dibujos siguen la escena." }
          : { phase: "error", pct: 0, text: "No pude medir bien la cámara en este clip (poca textura o mucho movimiento). Los dibujos se quedan fijos en la pantalla." }
      );
    } catch (err: any) {
      if (ac.signal.aborted) return;
      setCam({ phase: "error", pct: 0, text: `${err?.message ?? "No se pudo medir la cámara."} Los dibujos se quedan fijos en la pantalla.` });
    }
  }, [playbackId, highlightId, camMissing]);
  useEffect(() => {
    if (camTried.current || track || camMissing || duration <= 0) return;
    camTried.current = true;
    measureCamera();
  }, [duration, track, camMissing, measureCamera]);
  useEffect(() => () => camAbort.current?.abort(), []);

  // ---------- control del video ----------
  const el = () => playerRef.current as any;
  const seek = useCallback((t: number) => {
    const p = el();
    if (!p) return;
    const max = Number(p.duration) || t;
    p.currentTime = Math.max(0, Math.min(max, t));
  }, []);
  const togglePlay = () => {
    const p = el();
    if (!p) return;
    unlockAll();
    if (p.paused) p.play?.();
    else p.pause?.();
  };
  const pauseVideo = () => {
    const p = el();
    if (p && !p.paused) p.pause();
  };

  // ---------- cambios con deshacer ----------
  const commit = useCallback((next: Anno[]) => {
    setHistory((h) => [...h.slice(-29), annos]);
    setAnnos(next);
    setMsg(null);
  }, [annos]);
  const patch = (id: string, p: Partial<Anno>) => {
    setAnnos((arr) => arr.map((a) => (a.id === id ? { ...a, ...p } : a)));
    setMsg(null);
  };
  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setAnnos(h[h.length - 1]);
      return h.slice(0, -1);
    });
    setSelId(null);
  }, []);
  const remove = useCallback((id: string) => {
    commit(annos.filter((a) => a.id !== id));
    setSelId(null);
  }, [annos, commit]);

  function cancelDrawing() {
    pending.current = null;
    setPendingPt(null);
    setDraft(null);
    gesture.current = null;
  }
  function chooseTool(t: Tool) {
    cancelDrawing();
    setTool(t);
    setPreviewing(false);
    if (t !== "select") setSelId(null);
  }

  function createAnno(partial: Omit<Anno, "id" | "t" | "d" | "pause" | "color">) {
    if (annos.length >= MAX_ANNOS) {
      setMsg({ ok: false, text: `Máximo ${MAX_ANNOS} dibujos por highlight.` });
      return;
    }
    const t = round1(Math.max(0, now));
    const maxD = duration > 0 ? Math.max(1, round1(duration - t)) : DEFAULT_DURATION;
    const a: Anno = { id: newId(), color, t, d: Math.min(DEFAULT_DURATION, maxD), pause: 0, ...partial };
    // Lo dibujado está en coordenadas de la pantalla en este instante: se guarda relativo al segundo en que aparece.
    const [cdx, cdy] = deltaFor(a, track, now);
    if (cdx || cdy) a.pts = a.pts.map(([x, y]) => [Math.max(0, Math.min(1, x - cdx)), Math.max(0, Math.min(1, y - cdy))] as Pt);
    commit([...annos, a]);
    setSelId(a.id);
    // Al terminar un dibujo, volvemos a "Elegir" para poder ajustarlo con sus puntos
    // (si no, tocar un punto empezaría un dibujo nuevo en vez de moverlo).
    cancelDrawing();
    setTool("select");
  }

  // ---------- dibujar sobre el video ----------
  const toNorm = (e: React.PointerEvent): Pt => {
    const r = surfaceRef.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))];
  };
  const mkDraft = (type: AnnoType, a: Pt, b: Pt): Anno => ({
    id: "draft",
    type,
    color,
    t: now,
    d: 999,
    pause: 0,
    pts: [a, b],
  });

  function hitTest(p: Pt): string | null {
    const pad = 0.03;
    let best: { id: string; area: number } | null = null;
    for (const a of annos) {
      if (!isActive(a, now) && a.id !== selId) continue;
      const [x0, y0, x1, y1] = bbox(shiftAnno(a, track, now), aspect);
      if (p[0] >= x0 - pad && p[0] <= x1 + pad && p[1] >= y0 - pad && p[1] <= y1 + pad) {
        const area = (x1 - x0 + pad) * (y1 - y0 + pad);
        if (!best || area < best.area) best = { id: a.id, area };
      }
    }
    return best?.id ?? null;
  }

  function onSurfaceDown(e: React.PointerEvent<HTMLDivElement>) {
    if (previewing) return;
    const p = toNorm(e);
    if (tool === "select") {
      setSelId(hitTest(p));
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    pauseVideo();
    if (tool === "text") {
      createAnno({ type: "text", pts: [p], text: "Texto" });
      setTool("select");
      return;
    }
    if (tool === "free") {
      gesture.current = { kind: "free" };
      setDraft({ ...mkDraft("free", p, p), pts: [p] });
      return;
    }
    gesture.current = { kind: "shape", start: p, moved: false };
    const a = pending.current ?? p;
    setDraft(mkDraft(tool, a, p));
  }
  function onSurfaceMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const p = toNorm(e);
    if (g.kind === "free") {
      setDraft((d) => {
        if (!d) return d;
        const last = d.pts[d.pts.length - 1];
        return dist(last, p) > 0.004 ? { ...d, pts: [...d.pts, p] } : d;
      });
    } else if (g.kind === "shape") {
      if (dist(g.start, p) > 0.02) g.moved = true;
      const a = pending.current ?? g.start;
      setDraft(mkDraft(tool as AnnoType, a, p));
    }
  }
  function onSurfaceUp(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const p = toNorm(e);
    if (g.kind === "free") {
      const pts = [...(draft?.pts ?? [p]), p];
      setDraft(null);
      if (pts.length >= 3) createAnno({ type: "free", pts });
      return;
    }
    if (g.kind === "shape") {
      const type = tool as AnnoType;
      if (g.moved) {
        const a = pending.current ?? g.start;
        cancelDrawing();
        if (dist(a, p) > 0.01) createAnno({ type, pts: [a, p] });
      } else if (!pending.current) {
        pending.current = g.start;
        setPendingPt(g.start);
        setDraft(mkDraft(type, g.start, g.start));
      } else {
        const a = pending.current;
        cancelDrawing();
        if (dist(a, p) > 0.01) createAnno({ type, pts: [a, p] });
      }
    }
  }

  // ---------- mover los puntos de un dibujo ----------
  function startHandle(e: React.PointerEvent, id: string, idx: number) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setHistory((h) => [...h.slice(-29), annos]);
    gesture.current = { kind: "handle", id, idx, last: toNorm(e) };
  }
  function moveHandle(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || g.kind !== "handle") return;
    const p = toNorm(e);
    const dx = p[0] - g.last[0];
    const dy = p[1] - g.last[1];
    g.last = p;
    setAnnos((arr) =>
      arr.map((a) => {
        if (a.id !== g.id) return a;
        const [cdx, cdy] = deltaFor(a, track, now);
        if (g.idx < 0) {
          // mover todo el dibujo
          return {
            ...a,
            pts: a.pts.map(([x, y]) => [Math.max(0, Math.min(1, x + dx)), Math.max(0, Math.min(1, y + dy))] as Pt),
          };
        }
        const pc: Pt = [Math.max(0, Math.min(1, p[0] - cdx)), Math.max(0, Math.min(1, p[1] - cdy))];
        const pts = a.pts.map((q, i) => (i === g.idx ? pc : q)) as Pt[];
        return { ...a, pts };
      })
    );
    setMsg(null);
  }
  function endHandle() {
    if (gesture.current?.kind === "handle") gesture.current = null;
  }

  // ---------- voz ----------
  const pickMime = () => {
    const list = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    return list.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) ?? "";
  };
  async function startRecording() {
    setMsg(null);
    if (!r2Ready) return setMsg({ ok: false, text: "Falta conectar el almacenamiento (Cloudflare R2) para guardar la voz." });
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return setMsg({ ok: false, text: "Este navegador no puede grabar audio. Prueba con Chrome o Safari actualizado." });
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setMsg({ ok: false, text: "No se pudo usar el micrófono. Permite el acceso en tu navegador e inténtalo otra vez." });
    }
    const mime = pickMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      return setMsg({ ok: false, text: "No se pudo iniciar la grabación en este dispositivo." });
    }
    cancelDrawing();
    setTool("select");
    setPreviewing(false);
    setSelId(null);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunks, { type });
      const duration = (performance.now() - recStartedAt.current) / 1000;
      if (blob.size < 1000 || duration < 0.5) return setMsg({ ok: false, text: "La grabación quedó vacía. Inténtalo de nuevo." });
      setPendingVoice((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { blob, url: URL.createObjectURL(blob), start: recVideoStart.current, duration, mime: type, pauses: true };
      });
    };
    const p = el();
    const v0 = Math.round((Number(p?.currentTime) || 0) * 100) / 100;
    pres.markPassed(v0);
    recVideoStart.current = Math.round(pres.pAt(v0) * 100) / 100; // la voz se ubica en tiempo de presentación (incluye las pausas)
    wasMuted.current = Boolean(p?.muted);
    if (p) p.muted = true; // el video va en silencio mientras hablas (así el micrófono no lo recoge)
    recRef.current = rec;
    recStartedAt.current = performance.now();
    rec.start(1000);
    setRecSecs(0);
    setRecording(true);
    p?.play?.();
  }
  const stopRecording = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state !== "inactive") rec.stop();
    const p = playerRef.current;
    if (p) {
      p.muted = wasMuted.current;
      p.pause?.();
    }
    setRecording(false);
  }, []);
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecSecs((performance.now() - recStartedAt.current) / 1000), 250);
    return () => clearInterval(id);
  }, [recording]);
  // la grabación se detiene sola al terminar el video o si alguien pausa el video
  useEffect(() => {
    if (!recording) return;
    const sinceStart = performance.now() - recStartedAt.current;
    if ((duration > 0 && now >= duration - 0.1) || (pres.userPaused && sinceStart > 1200)) stopRecording();
  }, [recording, now, pres.userPaused, duration, stopRecording]);
  useEffect(() => () => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  async function saveVoice() {
    if (!pendingVoice) return;
    setVoiceBusy(true);
    setMsg(null);
    try {
      const r1 = await fetch("/api/highlights/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId, mime: pendingVoice.mime, size: pendingVoice.blob.size }),
      });
      const d1 = await r1.json().catch(() => ({}));
      if (!r1.ok) throw new Error(d1.error ?? "No se pudo preparar la subida");
      const up = await fetch(d1.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": pendingVoice.mime.split(";")[0] },
        body: pendingVoice.blob,
      });
      if (!up.ok) throw new Error("No se pudo subir el audio. Inténtalo otra vez.");
      const r2 = await fetch("/api/highlights/voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId, key: d1.key, start: pendingVoice.start, duration: pendingVoice.duration, pauses: pendingVoice.pauses }),
      });
      const d2 = await r2.json().catch(() => ({}));
      if (!r2.ok) throw new Error(d2.error ?? "No se pudo guardar la voz");
      setVoice({ url: pendingVoice.url, start: pendingVoice.start, pauses: pendingVoice.pauses });
      setPendingVoice(null);
      setMsg({ ok: true, text: "Voz guardada" });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message ?? "Ocurrió un error" });
    } finally {
      setVoiceBusy(false);
    }
  }
  function discardVoice() {
    if (pendingVoice) URL.revokeObjectURL(pendingVoice.url);
    setPendingVoice(null);
  }
  async function removeVoice() {
    if (!confirm("¿Quitar la voz de este highlight?")) return;
    setVoiceBusy(true);
    try {
      const res = await fetch("/api/highlights/voice", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo quitar la voz");
      setVoice(null);
      setMsg({ ok: true, text: "Voz quitada" });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message ?? "Ocurrió un error" });
    } finally {
      setVoiceBusy(false);
    }
  }

  // ---------- música ----------
  async function saveMusic(id: string | null, vol: number) {
    setMusicBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/highlights/music", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId, trackId: id, volume: vol }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "No se pudo guardar la música");
      setMsg({ ok: true, text: id ? "Música guardada" : "Música quitada" });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message ?? "Ocurrió un error" });
    } finally {
      setMusicBusy(false);
    }
  }
  async function uploadTrack(file: File) {
    setMsg(null);
    const mime = (file.type || "").split(";")[0] || (file.name.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "");
    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 80);
    setMusicBusy(true);
    let createdId: string | null = null;
    try {
      const r1 = await fetch("/api/musica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlug, title, mime, size: file.size }),
      });
      const d1 = await r1.json().catch(() => ({}));
      if (!r1.ok) throw new Error(d1.error ?? "No se pudo preparar la subida");
      createdId = d1.track.id;
      const up = await fetch(d1.uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: file });
      if (!up.ok) throw new Error("No se pudo subir la canción. Inténtalo otra vez.");
      setTracks((t) => [...t, d1.track]);
      setMusicId(d1.track.id);
      await saveMusic(d1.track.id, musicVol);
    } catch (err: any) {
      if (createdId) {
        fetch("/api/musica", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamSlug, id: createdId }),
        }).catch(() => {});
      }
      setMsg({ ok: false, text: err.message ?? "Ocurrió un error" });
      setMusicBusy(false);
      return;
    }
    setMusicBusy(false);
  }
  async function deleteTrack() {
    if (!musicTrack) return;
    if (!confirm(`¿Borrar "${musicTrack.title}" de la biblioteca? Los highlights que la usan se quedarán sin música.`)) return;
    setMusicBusy(true);
    try {
      const res = await fetch("/api/musica", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlug, id: musicTrack.id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo borrar");
      setTracks((t) => t.filter((x) => x.id !== musicTrack.id));
      setMusicId(null);
      setMsg({ ok: true, text: "Canción borrada" });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message ?? "Ocurrió un error" });
    } finally {
      setMusicBusy(false);
    }
  }

  // ---------- video final ----------
  async function createFinal() {
    setMsg(null);
    const bad = exportSupported();
    if (bad) return setFin({ phase: "error", pct: 0, text: bad });
    if (dirty || pendingVoice) return setFin({ phase: "error", pct: 0, text: "Primero guarda los dibujos y la voz." });
    if (annos.length === 0 && !activeVoice && !musicTrack) return setFin({ phase: "error", pct: 0, text: "Agrega al menos un dibujo, voz o música." });
    const secs = Math.round(duration || 0);
    if (
      !confirm(
        `Se va a grabar el video final: dura lo mismo que el clip (unos ${secs} segundos). Deja esta pestaña abierta y la pantalla encendida. Al terminar, reemplaza el clip del highlight (para cambiarlo después usas «Volver a editar»). ¿Continuar?`
      )
    )
      return;
    cancelDrawing();
    setPreviewing(false);
    pauseVideo();
    try {
      setFin({ phase: "recording", pct: 0, text: "Grabando el video final..." });
      const { blob } = await exportFinalVideo({
        videoUrl: `https://stream.mux.com/${playbackId}/capped-1080p.mp4`,
        annos,
        track,
        voice: activeVoice,
        pauses: !activeVoice || activeVoice.pauses === true,
        music: musicTrack ? { url: musicTrack.url, volume: musicVol } : null,
        onProgress: (p) => setFin({ phase: "recording", pct: p.d > 0 ? p.t / p.d : 0, text: `Grabando ${fmt(p.t)} de ${fmt(p.d)}` }),
      });
      setFin({ phase: "uploading", pct: 0, text: "Subiendo el video..." });
      const r1 = await fetch("/api/highlights/final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId }),
      });
      const d1 = await r1.json().catch(() => ({}));
      if (!r1.ok) throw new Error(d1.error ?? "No se pudo preparar la subida");
      await uploadToMux(d1.uploadUrl, blob, (f) => setFin({ phase: "uploading", pct: f, text: `Subiendo el video ${Math.round(f * 100)}%` }));
      const r2 = await fetch("/api/highlights/final", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId }),
      });
      if (!r2.ok) throw new Error((await r2.json().catch(() => ({}))).error ?? "No se pudo guardar");
      setFin({ phase: "processing", pct: 1, text: "Mux está procesando el video (1 o 2 minutos)..." });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const st = await fetch(`/api/highlights/final?highlightId=${highlightId}`).then((r) => r.json()).catch(() => null);
        if (st?.videoEdited) return setFin({ phase: "done", pct: 1, text: "Listo: el highlight ya usa el video final." });
        if (st?.finalStatus === "error") throw new Error("Mux no pudo procesar el video. Inténtalo otra vez.");
      }
      setFin({ phase: "processing", pct: 1, text: "Mux sigue procesando. Revisa el highlight en unos minutos." });
    } catch (err: any) {
      setFin({ phase: "error", pct: 0, text: err.message ?? "Ocurrió un error" });
    }
  }

  // ---------- pantalla completa ----------
  async function enterFull() {
    setFull(true);
    try {
      await document.documentElement.requestFullscreen?.();
      await (screen.orientation as any)?.lock?.("landscape");
    } catch {}
  }
  function exitFull() {
    setFull(false);
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      (screen.orientation as any)?.unlock?.();
    } catch {}
  }
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setFull((f) => (f ? false : f));
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const box = stageRef.current;
    const measure = () => {
      if (!box) return;
      const w0 = box.clientWidth;
      const h0 = box.clientHeight;
      if (w0 <= 0 || h0 <= 0) return;
      setFit(aspect >= w0 / h0 ? { w: w0, h: w0 / aspect } : { w: h0 * aspect, h: h0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box) ro.observe(box);
    window.addEventListener("resize", measure);
    return () => {
      document.body.style.overflow = prev;
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [full, aspect]);

  // ---------- teclado (computadora) ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seek((Number(el()?.currentTime) || 0) - (e.shiftKey ? 1 : 0.1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seek((Number(el()?.currentTime) || 0) + (e.shiftKey ? 1 : 0.1));
      } else if ((e.key === "Delete" || e.key === "Backspace") && selId) {
        e.preventDefault();
        remove(selId);
      } else if (e.key === "Escape") {
        if (recording) stopRecording();
        else if (full && tool === "select" && !pendingPt) exitFull();
        cancelDrawing();
        setTool("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // avisar si hay cambios sin guardar
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty || pendingVoice || recording || finBusy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, pendingVoice, recording, finBusy]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/highlights/annotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId, annotations: annos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      setSaved(JSON.stringify(annos));
      setMsg({ ok: true, text: "Dibujos guardados" });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message ?? "Ocurrió un error" });
    } finally {
      setBusy(false);
    }
  }

  const btn = "min-w-11 h-11 px-3 rounded-xl border text-sm font-extrabold flex items-center justify-center gap-1.5";
  const input = "w-full box-border bg-bg border border-border rounded-lg px-2.5 py-2 text-sm font-semibold";
  const drawing = tool !== "select" && !previewing;
  const selView = sel ? shiftAnno(sel, track, now) : null;
  const handlePts: { idx: number; pt: Pt }[] =
    selView && !previewing && tool === "select"
      ? selView.type === "free"
        ? (() => {
            const [x0, y0, x1, y1] = bbox(selView, aspect);
            return [{ idx: -1, pt: [(x0 + x1) / 2, (y0 + y1) / 2] as Pt }];
          })()
        : selView.pts.map((pt, idx) => ({ idx, pt }))
      : [];

  return (
    <div className={full ? "fixed inset-0 z-[100] bg-bg flex flex-col" : ""} onPointerDownCapture={unlockAll}>
      <div className={full ? "flex flex-col flex-1 min-h-0" : "grid gap-5 lg:grid-cols-[1fr_330px]"}>
        <div className={full ? "flex flex-col flex-1 min-h-0 min-w-0" : "min-w-0"}>
          {/* video + dibujos */}
          <div
            className={full ? "flex flex-col flex-1 min-h-0" : "mx-auto"}
            style={full ? undefined : { width: `min(100%, ${72 * aspect}vh)` }}
          >
            <div ref={stageRef} className={full ? "flex-1 min-h-0 flex items-center justify-center bg-black" : ""}>
            <div
              className={`relative rounded-xl overflow-hidden bg-black ${full ? "" : "w-full"}`}
              style={full ? { width: fit.w, height: fit.h } : { aspectRatio: String(aspect) }}
            >
              <MuxPlayer
                ref={playerRef}
                playbackId={playbackId}
                streamType="on-demand"
                accentColor="#F9E547"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ["--controls" as any]: "none" }}
                onLoadedMetadata={() => {
                  const w = Number(playerRef.current?.videoWidth);
                  const h = Number(playerRef.current?.videoHeight);
                  if (w > 0 && h > 0) setAspect(w / h);
                }}
              />
              <AnnotationLayer annos={annos} aspect={aspect} now={now} track={track} selectedId={previewing ? null : selId} extra={draft ? [draft] : []} />
              {pendingPt && (
                <div
                  className="absolute w-4 h-4 rounded-full border-2 border-white bg-gold pointer-events-none"
                  style={{ left: `${pendingPt[0] * 100}%`, top: `${pendingPt[1] * 100}%`, transform: "translate(-50%,-50%)" }}
                />
              )}
              {/* superficie que recibe el dedo / el mouse */}
              <div
                ref={surfaceRef}
                data-testid="surface"
                className="absolute inset-0"
                style={{ touchAction: drawing ? "none" : "pan-y", cursor: drawing ? "crosshair" : "default" }}
                onPointerDown={onSurfaceDown}
                onPointerMove={onSurfaceMove}
                onPointerUp={onSurfaceUp}
                onPointerCancel={() => cancelDrawing()}
              />
              {handlePts.map(({ idx, pt }) => (
                <div
                  key={idx}
                  data-testid={`handle-${idx}`}
                  className="absolute w-8 h-8 rounded-full border-[3px] border-white bg-gold/80 shadow"
                  style={{ left: `${pt[0] * 100}%`, top: `${pt[1] * 100}%`, transform: "translate(-50%,-50%)", touchAction: "none", cursor: "grab" }}
                  onPointerDown={(e) => startHandle(e, sel!.id, idx)}
                  onPointerMove={moveHandle}
                  onPointerUp={endHandle}
                  onPointerCancel={endHandle}
                />
              ))}
            </div>
            </div>

            {/* controles del video */}
            <div className={`flex items-center gap-2 ${full ? "px-3 pt-2" : "mt-3"}`}>
              <button type="button" onClick={() => seek(now - 1)} className={`${btn} bg-panel border-border`} aria-label="Atrás 1 segundo">
                ⏪
              </button>
              <button type="button" onClick={togglePlay} className={`${btn} bg-gold text-bg border-gold`} aria-label={paused ? "Reproducir" : "Pausar"}>
                {paused ? "▶" : "⏸"}
              </button>
              <button type="button" onClick={() => seek(now + 1)} className={`${btn} bg-panel border-border`} aria-label="Adelante 1 segundo">
                ⏩
              </button>
              <input
                type="range"
                aria-label="Posición del video"
                min={0}
                max={duration || 1}
                step={0.05}
                value={Math.min(now, duration || 1)}
                onChange={(e) => seek(Number(e.target.value))}
                className="flex-grow min-w-0"
              />
              <span className="text-xs font-bold text-muted whitespace-nowrap">
                {fmt(now)} / {fmt(duration)}
              </span>
            </div>

            {/* línea de tiempo (solo computadora) */}
            <div className={`${full ? "hidden" : "hidden lg:block"} relative h-9 mt-3 bg-panel border border-border rounded-lg overflow-hidden`}>
              {duration > 0 &&
                sorted.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    title={`${TYPE_LABELS[a.type]} · ${fmt(a.t)}`}
                    onClick={() => {
                      setSelId(a.id);
                      seek(a.t);
                    }}
                    className={`absolute top-1.5 h-6 rounded text-[10px] font-extrabold px-1.5 overflow-hidden whitespace-nowrap ${
                      a.id === selId ? "ring-2 ring-white" : ""
                    }`}
                    style={{
                      left: `${(a.t / duration) * 100}%`,
                      width: `${Math.max(3, (a.d / duration) * 100)}%`,
                      background: a.color,
                      color: a.color === "#E6483C" ? "#fff" : "#003C71",
                    }}
                  >
                    {TYPE_LABELS[a.type]}
                  </button>
                ))}
              <div className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none" style={{ left: duration > 0 ? `${(now / duration) * 100}%` : 0 }} />
            </div>
          </div>

          {/* herramientas */}
          <div className={`flex flex-wrap items-center gap-2 ${full ? "px-3 py-2" : "mt-4"}`}>
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid={`tool-${t.id}`}
                onClick={() => chooseTool(t.id)}
                className={`${btn} ${tool === t.id && !previewing ? "bg-gold text-bg border-gold" : "bg-panel border-border"}`}
              >
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
            <button type="button" onClick={undo} disabled={history.length === 0} className={`${btn} bg-panel border-border disabled:opacity-40`} aria-label="Deshacer">
              ↶
            </button>
            <div className="flex items-center gap-1.5 ml-1">
              {ANNO_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => {
                    setColor(c);
                    if (sel) patch(sel.id, { color: c });
                  }}
                  className={`w-9 h-9 rounded-full border-[3px] ${(sel ? sel.color : color) === c ? "border-white" : "border-white/20"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            {full && (
              <button
                type="button"
                onClick={() => sel && remove(sel.id)}
                disabled={!sel}
                className={`${btn} bg-panel border-red text-red disabled:opacity-30`}
                aria-label="Borrar dibujo"
              >
                🗑
              </button>
            )}
            <button
              type="button"
              data-testid="rec-toggle"
              onClick={() => (recording ? stopRecording() : startRecording())}
              disabled={voiceBusy}
              className={`${btn} ${recording ? "bg-red text-white border-red" : "bg-panel border-border"}`}
            >
              {recording ? `■ Detener ${fmt(recSecs)}` : "🎙"}
              {!recording && <span className="hidden sm:inline">Grabar voz</span>}
            </button>
            <button
              type="button"
              data-testid="full-toggle"
              onClick={() => (full ? exitFull() : enterFull())}
              className={`${btn} bg-panel border-border`}
              aria-label={full ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {full ? "✕ Salir" : "⛶"}
            </button>
            <button
              type="button"
              onClick={() => {
                cancelDrawing();
                setTool("select");
                pres.reset();
                setSelId(null);
                seek(0);
                setPreviewing((v) => !v);
                if (!previewing) el()?.play?.();
                else pauseVideo();
              }}
              className={`${btn} ml-auto ${previewing ? "bg-red text-white border-red" : "bg-panel border-border"}`}
            >
              {previewing ? "■ Salir de la prueba" : hasVoice ? "▶ Probar con voz" : "▶ Probar con pausas"}
            </button>
          </div>
          <div className={`text-xs text-muted ${full ? (pendingPt || recording || previewing ? "px-3 pb-2" : "hidden") : "mt-2 min-h-[1.25rem]"}`}>
            {recording
              ? "● Grabando: habla mientras ves el video. Se detiene al terminar el video o con el botón rojo."
              : previewing
              ? hasVoice
                ? "Así lo verán las familias: los dibujos aparecen solos y se oye tu voz."
                : "Así lo verán las familias: los dibujos aparecen solos y el video se pausa donde lo pusiste."
              : pendingPt
              ? "Ahora toca el punto final."
              : tool === "select" && sel
              ? "Arrastra los puntos amarillos para ajustar el dibujo. Para dibujar otro, elige una herramienta."
              : HINTS[tool]}
          </div>
        </div>

        {/* panel derecho */}
        <div className={full ? "hidden" : "min-w-0"}>
          {/* voz */}
          <div className="bg-panel border border-border rounded-2xl p-4 mb-4" data-testid="voice-panel">
            <div className="text-[11px] font-extrabold text-gold tracking-widest uppercase mb-2">Voz del entrenador</div>
            {activeVoice && (vs.stats.starts > 0) && (
              <div className="text-[10px] text-muted mb-2" data-testid="voice-stats">
                Diagnóstico de voz: arranques {vs.stats.starts} · cortes por desfase {vs.stats.drift} · por video atorado {vs.stats.stalls} · por pausa {vs.stats.pauses}
              </div>
            )}
            {recording ? (
              <div className="text-sm">
                <div className="font-bold text-red mb-2">● Grabando {fmt(recSecs)}</div>
                <button type="button" onClick={stopRecording} className="bg-red text-white rounded-lg px-4 py-2.5 text-sm font-extrabold">
                  ■ Detener
                </button>
              </div>
            ) : pendingVoice ? (
              <div className="text-sm">
                <div className="font-bold mb-1">Voz grabada ({fmt(pendingVoice.duration)}, desde {fmt(pendingVoice.start)})</div>
                <div className="text-xs text-muted mb-3">Pulsa Probar para oírla con el video. Todavía no está guardada.</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={saveVoice} disabled={voiceBusy} className="bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold disabled:opacity-50">
                    {voiceBusy ? "Subiendo..." : "Guardar voz"}
                  </button>
                  <button type="button" onClick={startRecording} disabled={voiceBusy} className="bg-bg border border-border rounded-lg px-3 py-2.5 text-xs font-bold">
                    Grabar de nuevo
                  </button>
                  <button type="button" onClick={discardVoice} disabled={voiceBusy} className="text-xs font-bold text-red px-2">
                    Descartar
                  </button>
                </div>
              </div>
            ) : voice ? (
              <div className="text-sm">
                <div className="font-bold mb-1">Voz guardada (empieza en {fmt(voice.start)})</div>
                <div className="text-xs text-muted mb-3">
                  {voice.pauses
                    ? "Va alineada con las pausas de los dibujos. Si cambias o agregas pausas, graba la voz de nuevo. Para oírla con las pausas usa «Probar con voz»."
                    : "Esta voz se grabó antes de que existieran las pausas con voz: las pausas no se aplican. Si quieres pausas, graba la voz de nuevo."}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={startRecording} disabled={voiceBusy} className="bg-bg border border-border rounded-lg px-3 py-2.5 text-xs font-bold">
                    🎙 Grabar de nuevo
                  </button>
                  <button type="button" onClick={removeVoice} disabled={voiceBusy} className="text-xs font-bold text-red px-2">
                    Quitar voz
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                <button type="button" onClick={startRecording} className="bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold">
                  🎙 Grabar voz
                </button>
                <div className="text-xs text-muted mt-2 leading-relaxed">
                  Pon el video donde quieras empezar y habla mientras lo ves; los dibujos aparecen solos. El video va en silencio mientras grabas. Si un dibujo tiene pausa, el video se congela y tú sigues hablando; la voz queda alineada con esas pausas.
                </div>
              </div>
            )}
          </div>

          {/* música */}
          <div className="bg-panel border border-border rounded-2xl p-4 mb-4" data-testid="music-panel">
            <div className="text-[11px] font-extrabold text-gold tracking-widest uppercase mb-2">Música de fondo</div>
            <select
              value={musicId ?? ""}
              disabled={musicBusy}
              onChange={(e) => {
                const id = e.target.value || null;
                setMusicId(id);
                saveMusic(id, musicVol);
              }}
              className={input}
              aria-label="Canción"
            >
              <option value="">Sin música</option>
              <optgroup label="Incluidas en la app">
                {tracks.filter((t) => t.builtin).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
              {tracks.some((t) => !t.builtin) && (
                <optgroup label="Subidas por el equipo">
                  {tracks.filter((t) => !t.builtin).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {musicTrack && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-muted mb-1">Volumen: {Math.round(musicVol * 100)}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(musicVol * 100)}
                  onChange={(e) => setMusicVol(Number(e.target.value) / 100)}
                  onPointerUp={() => saveMusic(musicId, musicVol)}
                  onKeyUp={() => saveMusic(musicId, musicVol)}
                  className="w-full"
                  aria-label="Volumen de la música"
                />
                <div className="text-[11px] text-muted mt-1">Baja sola mientras se oye tu voz. Dale play al video para oírla.</div>
                {!musicTrack.builtin && (
                  <button type="button" onClick={deleteTrack} disabled={musicBusy} className="text-xs font-bold text-red mt-2">
                    Borrar esta canción de la biblioteca
                  </button>
                )}
              </div>
            )}
            <label className={`mt-3 inline-block bg-bg border border-border rounded-lg px-3 py-2.5 text-xs font-bold cursor-pointer ${musicBusy || !r2Ready ? "opacity-50 pointer-events-none" : ""}`}>
              {musicBusy ? "Procesando..." : "+ Subir otra canción (MP3, máx. 15 MB)"}
              <input
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.ogg"
                className="hidden"
                data-testid="music-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) uploadTrack(f);
                }}
              />
            </label>
            <div className="text-[11px] text-muted mt-2 leading-relaxed">
              Las canciones incluidas son de Pixabay Music. Si subes otras, usa solo música libre de derechos. Lo que subas queda en la biblioteca del equipo para todos los highlights.
            </div>
          </div>

          {/* cámara */}
          <div className="bg-panel border border-border rounded-2xl p-4 mb-4" data-testid="cam-panel">
            <div className="text-[11px] font-extrabold text-gold tracking-widest uppercase mb-2">Seguimiento de cámara</div>
            {camMissing ? (
              <div className="text-xs text-muted leading-relaxed">Falta correr el SQL <b>highlights-camara.sql</b> en Supabase para activarlo.</div>
            ) : (
              <>
                {cam.phase === "working" && (
                  <div className="h-2 rounded bg-bg overflow-hidden mb-2">
                    <div className="h-full bg-gold" style={{ width: `${Math.round(cam.pct * 100)}%` }} />
                  </div>
                )}
                <div className={`text-xs leading-relaxed ${cam.phase === "error" ? "text-red font-bold" : "text-muted"}`}>
                  {cam.text || "Se mide solo al abrir el editor."}
                </div>
                <div className="text-[11px] text-muted mt-1.5 leading-relaxed">
                  Si la cámara se mueve, los dibujos se mueven con la escena. Se puede quitar en cada dibujo.
                </div>
                {cam.phase !== "working" && (
                  <button type="button" onClick={measureCamera} className="mt-2 text-xs font-bold text-gold hover:underline">
                    Volver a medir
                  </button>
                )}
              </>
            )}
          </div>

          {/* video final */}
          <div className="bg-panel border border-border rounded-2xl p-4 mb-4" data-testid="final-panel">
            <div className="text-[11px] font-extrabold text-gold tracking-widest uppercase mb-2">Video final</div>
            <div className="text-xs text-muted leading-relaxed mb-3">
              Pega los dibujos, tu voz y la música al clip y reemplaza el video del highlight. Así lo ven todos y se puede descargar tal cual.
              Se graba en tiempo real, con esta pestaña abierta.
            </div>
            {finBusy || fin.phase === "processing" ? (
              <div>
                <div className="h-2 rounded bg-bg overflow-hidden mb-2">
                  <div className="h-full bg-gold" style={{ width: `${Math.round(fin.pct * 100)}%` }} />
                </div>
                <div className="text-xs font-bold">{fin.text}</div>
              </div>
            ) : (
              <button
                type="button"
                data-testid="final-btn"
                onClick={createFinal}
                disabled={recording || voiceBusy || musicBusy}
                className="bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold disabled:opacity-50"
              >
                🎬 Crear video final
              </button>
            )}
            {(fin.phase === "error" || fin.phase === "done") && fin.text && (
              <div className={`mt-2 text-xs font-bold ${fin.phase === "done" ? "text-ok" : "text-red"}`}>
                {fin.text}
                {fin.phase === "done" && (
                  <div className="mt-1">
                    <Link href={`/${teamSlug}/highlights/${highlightId}`} className="text-gold hover:underline">
                      Ver el highlight
                    </Link>
                  </div>
                )}
              </div>
            )}
            {fin.phase === "idle" && fin.text && <div className="mt-2 text-xs font-bold text-red">{fin.text}</div>}
          </div>

          {sel ? (
            <div className="bg-panel border border-border rounded-2xl p-4 mb-4" data-testid="panel">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-extrabold text-gold tracking-widest uppercase">{TYPE_LABELS[sel.type]} seleccionado</div>
                <button type="button" onClick={() => remove(sel.id)} className="text-xs font-bold text-red">
                  Borrar
                </button>
              </div>
              {sel.type === "text" && (
                <div className="mb-3">
                  <label className="block text-xs font-bold text-muted mb-1">Texto</label>
                  <input
                    type="text"
                    autoFocus
                    maxLength={60}
                    value={sel.text ?? ""}
                    onChange={(e) => patch(sel.id, { text: e.target.value })}
                    className={input}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1">Aparece en (seg)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={sel.t}
                    onChange={(e) => patch(sel.id, { t: round1(Math.max(0, Number(e.target.value) || 0)) })}
                    className={input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted mb-1">Dura (seg)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0.5}
                    value={sel.d}
                    onChange={(e) => patch(sel.id, { d: round1(Math.max(0.5, Number(e.target.value) || DEFAULT_DURATION)) })}
                    className={input}
                  />
                </div>
              </div>
              {track && (
                <label className="flex items-center gap-2 text-xs font-bold mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="follow-toggle"
                    checked={sel.follow !== false}
                    onChange={(e) => patch(sel.id, { follow: e.target.checked })}
                  />
                  Sigue el movimiento de la cámara
                </label>
              )}
              <label className="block text-xs font-bold text-muted mb-1">Pausar el video al aparecer</label>
              <select value={sel.pause} onChange={(e) => patch(sel.id, { pause: Number(e.target.value) })} className={input}>
                {PAUSE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p === 0 ? "No pausar" : `Pausar ${p} segundos`}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => seek(sel.t)} className="mt-3 text-xs font-bold text-gold hover:underline">
                Ir al momento en que aparece
              </button>
              <div className="text-[11px] text-muted mt-2">Mueve los puntos amarillos sobre el video para ajustar el dibujo.</div>
            </div>
          ) : (
            <div className="bg-panel border border-dashed border-borderMuted rounded-2xl p-4 mb-4 text-xs text-muted">
              Elige un dibujo de la lista, o dibuja uno nuevo: pausa el video en el momento justo y usa una herramienta.
            </div>
          )}

          <div className="text-[11px] font-extrabold text-gold tracking-widest mb-2">DIBUJOS ({annos.length})</div>
          <div className="flex flex-col gap-1.5 mb-5">
            {sorted.length === 0 && <div className="text-xs text-muted">Todavía no hay dibujos.</div>}
            {sorted.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelId(a.id);
                  setTool("select");
                  seek(a.t);
                }}
                className={`flex items-center gap-2 text-left rounded-lg border px-3 py-2 text-xs font-bold ${
                  a.id === selId ? "bg-panel2 border-gold" : "bg-panel border-border"
                }`}
              >
                <span className="bg-bg rounded px-1.5 py-0.5 text-[10px] text-gold">{fmt(a.t)}</span>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: a.color }} />
                <span className="truncate">{a.type === "text" ? `“${a.text}”` : TYPE_LABELS[a.type]}</span>
                <span className="ml-auto text-muted shrink-0">
                  {a.d}s{a.pause > 0 ? ` · ⏸${a.pause}s` : ""}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className="bg-gold text-bg rounded-lg px-5 py-3 text-sm font-extrabold disabled:opacity-50"
            >
              {busy ? "Guardando..." : "Guardar dibujos"}
            </button>
            <Link href={`/${teamSlug}/highlights/${highlightId}`} className="text-sm font-bold text-muted hover:text-text">
              Volver al highlight
            </Link>
          </div>
          <div className="mt-2 min-h-[1.25rem] text-xs font-bold">
            {dirty && !msg && <span className="text-goldText">Cambios sin guardar</span>}
            {msg && <span className={msg.ok ? "text-ok" : "text-red"}>{msg.text}</span>}
          </div>
          <div className="hidden lg:block text-[11px] text-muted mt-3 leading-relaxed">
            Atajos: espacio = reproducir/pausar · ← → = 0.1 s (con Mayús 1 s) · Supr = borrar · Ctrl+Z = deshacer · Esc = cancelar.
          </div>
        </div>
      </div>
    </div>
  );
}
