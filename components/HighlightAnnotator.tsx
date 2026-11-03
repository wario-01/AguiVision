"use client";

// Editor de dibujos para un highlight (computadora y teléfono).
// Computadora: arrastra con el mouse. Teléfono: toca el inicio y luego el final (o arrastra).
// Cada dibujo se puede ajustar después con sus puntos (tocar y mover).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MuxPlayer from "@mux/mux-player-react";
import AnnotationLayer from "@/components/AnnotationLayer";
import { usePlayerClock } from "@/components/usePlayerClock";
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
  select: "Toca un dibujo para elegirlo y mover sus puntos. Para dibujar, elige una herramienta.",
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
}: {
  teamSlug: string;
  highlightId: string;
  playbackId: string;
  title: string;
  initial: Anno[];
}) {
  const playerRef = useRef<any>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const { now, duration, paused } = usePlayerClock(playerRef);

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

  const pending = useRef<Pt | null>(null);
  const gesture = useRef<
    | null
    | { kind: "shape"; start: Pt; moved: boolean }
    | { kind: "free" }
    | { kind: "handle"; id: string; idx: number; last: Pt }
  >(null);
  const fired = useRef(new Set<string>());
  const lastNow = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = JSON.stringify(annos) !== saved;
  const sel = annos.find((a) => a.id === selId) ?? null;
  const sorted = useMemo(() => [...annos].sort((a, b) => a.t - b.t), [annos]);

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
    if (p.paused) p.play?.();
    else p.pause?.();
  };
  const pauseVideo = () => {
    const p = el();
    if (p && !p.paused) p.pause();
  };

  // En "Probar", las pausas automáticas funcionan igual que para las familias.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (now < lastNow.current - 0.5) for (const a of annos) if (a.t > now - 0.1) fired.current.delete(a.id);
    lastNow.current = now;
    if (!previewing || paused) return;
    for (const a of annos) {
      if (a.pause > 0 && !fired.current.has(a.id) && now >= a.t && now < a.t + 0.6) {
        fired.current.add(a.id);
        p.pause();
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (playerRef.current?.paused) playerRef.current.play?.();
        }, a.pause * 1000);
        break;
      }
    }
  }, [now, paused, previewing, annos]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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
    commit([...annos, a]);
    setSelId(a.id);
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
      const [x0, y0, x1, y1] = bbox(a, aspect);
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
        if (g.idx < 0) {
          // mover todo el dibujo
          return {
            ...a,
            pts: a.pts.map(([x, y]) => [Math.max(0, Math.min(1, x + dx)), Math.max(0, Math.min(1, y + dy))] as Pt),
          };
        }
        const pts = a.pts.map((q, i) => (i === g.idx ? p : q)) as Pt[];
        return { ...a, pts };
      })
    );
    setMsg(null);
  }
  function endHandle() {
    if (gesture.current?.kind === "handle") gesture.current = null;
  }

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
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

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
  const handlePts: { idx: number; pt: Pt }[] =
    sel && !previewing && tool === "select"
      ? sel.type === "free"
        ? (() => {
            const [x0, y0, x1, y1] = bbox(sel, aspect);
            return [{ idx: -1, pt: [(x0 + x1) / 2, (y0 + y1) / 2] as Pt }];
          })()
        : sel.pts.map((pt, idx) => ({ idx, pt }))
      : [];

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        <div className="min-w-0">
          {/* video + dibujos */}
          <div className="mx-auto" style={{ width: `min(100%, ${72 * aspect}vh)` }}>
            <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: String(aspect) }}>
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
              <AnnotationLayer annos={annos} aspect={aspect} now={now} selectedId={previewing ? null : selId} extra={draft ? [draft] : []} />
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

            {/* controles del video */}
            <div className="flex items-center gap-2 mt-3">
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
            <div className="hidden lg:block relative h-9 mt-3 bg-panel border border-border rounded-lg overflow-hidden">
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
          <div className="flex flex-wrap items-center gap-2 mt-4">
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
            <button
              type="button"
              onClick={() => {
                cancelDrawing();
                setTool("select");
                fired.current.clear();
                setSelId(null);
                seek(0);
                setPreviewing((v) => !v);
                if (!previewing) el()?.play?.();
                else pauseVideo();
              }}
              className={`${btn} ml-auto ${previewing ? "bg-red text-white border-red" : "bg-panel border-border"}`}
            >
              {previewing ? "■ Salir de la prueba" : "▶ Probar con pausas"}
            </button>
          </div>
          <div className="text-xs text-muted mt-2 min-h-[1.25rem]">
            {previewing
              ? "Así lo verán las familias: los dibujos aparecen solos y el video se pausa donde lo pusiste."
              : pendingPt
              ? "Ahora toca el punto final."
              : HINTS[tool]}
          </div>
        </div>

        {/* panel derecho */}
        <div className="min-w-0">
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
