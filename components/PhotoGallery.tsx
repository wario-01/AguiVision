"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { makeZip } from "@/lib/zip";

export type GalleryPhoto = {
  id: string;
  album: string;
  albumDate: string; // YYYY-MM-DD
  thumbUrl: string;
  fileName: string;
  keep: boolean;
  mine: boolean;
  kind: "photo" | "video";
  durationSeconds: number | null;
  highlightId: string | null;
  matchId: string | null;
};

const fmtDur = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

function fmtDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function PhotoGallery({
  teamSlug,
  photos,
  canManage,
  matches = [],
  players = [],
}: {
  teamSlug: string;
  photos: GalleryPhoto[];
  canManage: boolean;
  matches?: { id: string; label: string }[];
  players?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [viewer, setViewer] = useState<{ id: string; url: string; name: string; dl: string; kind: "photo" | "video"; highlightId: string | null; matchId: string | null } | null>(null);
  const [onlyKept, setOnlyKept] = useState(false);
  const [onlyVideos, setOnlyVideos] = useState(false);
  // Marcar un video como highlight
  const [hlOpen, setHlOpen] = useState(false);
  const [hlMatch, setHlMatch] = useState("");
  const [hlPlayer, setHlPlayer] = useState("");
  const [hlLabel, setHlLabel] = useState("Video");
  const [hlShared, setHlShared] = useState(true);
  const [hlBusy, setHlBusy] = useState(false);
  const [hlMsg, setHlMsg] = useState("");

  const albums = useMemo(() => {
    const map = new Map<string, { album: string; date: string; items: GalleryPhoto[] }>();
    for (const p of photos) {
      if (onlyKept && !p.keep) continue;
      if (onlyVideos && p.kind !== "video") continue;
      const k = `${p.albumDate}|${p.album}`;
      if (!map.has(k)) map.set(k, { album: p.album, date: p.albumDate, items: [] });
      map.get(k)!.items.push(p);
    }
    return Array.from(map.values());
  }, [photos, onlyKept, onlyVideos]);

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAlbum(items: GalleryPhoto[]) {
    setSelecting(true);
    setSelected((prev) => {
      const n = new Set(prev);
      const all = items.every((p) => n.has(p.id));
      items.forEach((p) => (all ? n.delete(p.id) : n.add(p.id)));
      return n;
    });
  }
  function clear() {
    setSelected(new Set());
    setSelecting(false);
  }

  async function links(ids: string[], inline: boolean) {
    const res = await fetch("/api/fotos/descargar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, inline }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron preparar las fotos");
    return data.items as { id: string; file_name: string; url: string }[];
  }

  async function open(p: GalleryPhoto) {
    try {
      const [view] = await links([p.id], true);
      const [dl] = await links([p.id], false);
      setHlOpen(false);
      setHlMsg("");
      setHlMatch(p.matchId && matches.some((m) => m.id === p.matchId) ? p.matchId : matches[0]?.id ?? "");
      setHlPlayer("");
      setHlLabel("Video");
      setHlShared(true);
      setViewer({ id: p.id, url: view.url, name: p.fileName, dl: dl.url, kind: p.kind, highlightId: p.highlightId, matchId: p.matchId });
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  async function downloadSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setMessage("");
    try {
      if (ids.length === 1) {
        const [l] = await links(ids, false);
        window.location.href = l.url;
        return;
      }
      const photoIds = ids.filter((id) => byId.get(id)?.kind !== "video");
      const skipped = ids.length - photoIds.length;
      if (photoIds.length === 0) {
        setMessage("Los videos se descargan de uno en uno: ábrelo y toca Descargar.");
        return;
      }
      if (photoIds.length === 1) {
        const [l] = await links(photoIds, false);
        window.location.href = l.url;
        return;
      }
      setBusy(`Preparando ${photoIds.length} fotos…`);
      const ls = await links(photoIds, true);
      const files: { name: string; data: Uint8Array }[] = [];
      const used = new Set<string>();
      for (let i = 0; i < ls.length; i++) {
        setBusy(`Descargando ${i + 1} de ${ls.length}…`);
        const r = await fetch(ls[i].url);
        if (!r.ok) throw new Error("No se pudo bajar una de las fotos");
        let name = ls[i].file_name;
        if (used.has(name)) name = `${i + 1}_${name}`;
        used.add(name);
        files.push({ name, data: new Uint8Array(await r.arrayBuffer()) });
      }
      saveBlob(makeZip(files), `fotos-${teamSlug}.zip`);
      setMessage(
        skipped > 0
          ? `Listo: ${files.length} fotos en un zip. Los ${skipped} video${skipped === 1 ? "" : "s"} se descargan de uno en uno.`
          : `Listo: ${files.length} fotos en un zip.`
      );
    } catch (e: any) {
      setMessage(e.message ?? "No se pudo descargar");
    } finally {
      setBusy("");
    }
  }

  async function setKeep(keep: boolean) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy("Guardando…");
    const res = await fetch("/api/fotos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamSlug, ids, keep }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setMessage(data.error ?? "No se pudo actualizar");
    setMessage(keep ? "Fotos marcadas para conservar." : "Ya no se conservan: se borrarán a los 60 días.");
    clear();
    router.refresh();
  }

  async function remove() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`¿Borrar ${ids.length} foto${ids.length === 1 ? "" : "s"} para siempre? No se puede deshacer.`)) return;
    setBusy("Borrando…");
    const res = await fetch("/api/fotos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamSlug, ids }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setMessage(data.error ?? "No se pudo borrar");
    setMessage(`${data.deleted} foto${data.deleted === 1 ? "" : "s"} borrada${data.deleted === 1 ? "" : "s"}.`);
    clear();
    router.refresh();
  }

  const canDeleteSelection =
    selected.size > 0 && (canManage || Array.from(selected).every((id) => byId.get(id)?.mine));

  if (photos.length === 0) {
    return <div className="text-sm text-muted">Todavía no hay fotos ni videos. Súbelos desde Subir → Fotos.</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => (selecting ? clear() : setSelecting(true))}
          className="text-xs font-bold rounded-full px-3.5 py-2 border border-borderMuted text-muted hover:text-text"
        >
          {selecting ? "Cancelar selección" : "Seleccionar"}
        </button>
        <button
          onClick={() => setOnlyKept((v) => !v)}
          className={`text-xs font-bold rounded-full px-3.5 py-2 border ${
            onlyKept ? "border-goldBorderDim text-goldText bg-goldBgDim" : "border-borderMuted text-muted hover:text-text"
          }`}
        >
          ★ Solo guardadas
        </button>
        {photos.some((p) => p.kind === "video") && (
          <button
            onClick={() => setOnlyVideos((v) => !v)}
            className={`text-xs font-bold rounded-full px-3.5 py-2 border ${
              onlyVideos ? "border-goldBorderDim text-goldText bg-goldBgDim" : "border-borderMuted text-muted hover:text-text"
            }`}
          >
            ▶ Solo videos
          </button>
        )}
        {selected.size > 0 && (
          <>
            <span className="text-xs text-muted">{selected.size} elegida{selected.size === 1 ? "" : "s"}</span>
            <button onClick={downloadSelected} disabled={!!busy} className="text-xs font-extrabold rounded-full px-3.5 py-2 bg-gold text-bg disabled:opacity-60">
              {selected.size === 1 ? "Descargar" : "Descargar zip"}
            </button>
            {canManage && (
              <>
                <button onClick={() => setKeep(true)} disabled={!!busy} className="text-xs font-bold rounded-full px-3.5 py-2 border border-goldBorderDim text-goldText">
                  ★ Guardar
                </button>
                <button onClick={() => setKeep(false)} disabled={!!busy} className="text-xs font-bold rounded-full px-3.5 py-2 border border-borderMuted text-muted">
                  Quitar guardado
                </button>
              </>
            )}
            {canDeleteSelection && (
              <button onClick={remove} disabled={!!busy} className="text-xs font-bold rounded-full px-3.5 py-2 border border-red text-red">
                Borrar
              </button>
            )}
          </>
        )}
      </div>
      {(busy || message) && <div className="text-xs text-muted mb-4">{busy || message}</div>}

      <div className="flex flex-col gap-8">
        {albums.map((g) => (
          <div key={g.date + g.album}>
            <div className="flex items-baseline gap-2 mb-3 flex-wrap">
              <span className="font-display text-base font-semibold">{g.album}</span>
              <span className="text-xs text-muted">{fmtDate(g.date)} · {g.items.length} archivo{g.items.length === 1 ? "" : "s"}</span>
              <button onClick={() => toggleAlbum(g.items)} className="text-xs font-bold text-gold ml-auto">
                {g.items.every((p) => selected.has(p.id)) ? "Quitar todas" : "Elegir todas"}
              </button>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {g.items.map((p) => {
                const on = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => (selecting ? toggle(p.id) : open(p))}
                    className={`relative aspect-square rounded-lg overflow-hidden bg-panel2 border ${
                      on ? "border-gold ring-2 ring-gold" : "border-borderMuted"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                    {p.kind === "video" && (
                      <>
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="w-9 h-9 rounded-full bg-black/55 border border-white/70 flex items-center justify-center text-white text-sm pl-0.5">▶</span>
                        </span>
                        {p.durationSeconds ? (
                          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 rounded">{fmtDur(p.durationSeconds)}</span>
                        ) : null}
                        {p.highlightId && (
                          <span className="absolute bottom-1 left-1 bg-gold text-bg text-[10px] font-extrabold px-1.5 rounded">Highlight</span>
                        )}
                      </>
                    )}
                    {p.keep && (
                      <span className="absolute top-1 left-1 bg-black/60 text-goldText text-[11px] font-extrabold px-1.5 rounded">★</span>
                    )}
                    {selecting && (
                      <span
                        className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] font-extrabold ${
                          on ? "bg-gold border-gold text-bg" : "bg-black/40 border-white/80 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {albums.length === 0 && <div className="text-sm text-muted">No hay fotos guardadas todavía.</div>}
      </div>

      {viewer && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setViewer(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
            <span className="text-muted truncate">{viewer.name}</span>
            <div className="flex gap-2">
              {canManage && viewer.kind === "video" && matches.length > 0 && !viewer.highlightId && (
                <button onClick={() => setHlOpen((v) => !v)} className="text-xs font-extrabold rounded-full px-3.5 py-2 border border-goldBorderDim text-goldText">
                  ★ Marcar como highlight
                </button>
              )}
              {viewer.kind === "video" && viewer.highlightId && (
                <span className="text-xs font-extrabold rounded-full px-3.5 py-2 bg-goldBgDim text-goldText border border-goldBorderDim">✓ Es highlight</span>
              )}
              <a href={viewer.dl} className="text-xs font-extrabold rounded-full px-3.5 py-2 bg-gold text-bg">Descargar</a>
              <button onClick={() => setViewer(null)} className="text-xs font-bold rounded-full px-3.5 py-2 border border-borderMuted text-text">Cerrar</button>
            </div>
          </div>
          {hlOpen && viewer.kind === "video" && (
            <div className="mx-4 mb-2 bg-panel border border-border rounded-xl p-3 text-sm" onClick={(e) => e.stopPropagation()}>
              <div className="text-xs text-muted mb-2">
                Aparecerá en Highlights, dentro del partido que elijas. Máximo 5 minutos.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                <select value={hlMatch} onChange={(e) => setHlMatch(e.target.value)} className="bg-bg border border-border rounded-lg px-3 py-2 text-xs font-semibold">
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <select value={hlPlayer} onChange={(e) => setHlPlayer(e.target.value)} className="bg-bg border border-border rounded-lg px-3 py-2 text-xs font-semibold">
                  <option value="">Todo el equipo</option>
                  {players.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={hlLabel}
                  onChange={(e) => setHlLabel(e.target.value)}
                  maxLength={80}
                  placeholder="Etiqueta, ej: Gol"
                  className="bg-bg border border-border rounded-lg px-3 py-2 text-xs font-semibold"
                />
              </div>
              {hlPlayer && (
                <label className="flex items-center gap-2 text-xs font-bold text-muted mb-2 cursor-pointer">
                  <input type="checkbox" checked={hlShared} onChange={(e) => setHlShared(e.target.checked)} />
                  Compartir también con todo el equipo
                </label>
              )}
              <button
                disabled={hlBusy}
                onClick={async () => {
                  setHlBusy(true);
                  setHlMsg("");
                  try {
                    const res = await fetch("/api/fotos/highlight", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ teamSlug, photoId: viewer.id, matchId: hlMatch, playerId: hlPlayer || undefined, label: hlLabel, shared: hlShared }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error ?? "No se pudo crear el highlight");
                    setViewer({ ...viewer, highlightId: data.highlightId });
                    setHlOpen(false);
                    setMessage("Listo: el video quedó como highlight. Tarda unos minutos en procesarse.");
                    router.refresh();
                  } catch (e: any) {
                    setHlMsg(e.message ?? "Ocurrió un error");
                  } finally {
                    setHlBusy(false);
                  }
                }}
                className="text-xs font-extrabold rounded-lg px-4 py-2 bg-gold text-bg disabled:opacity-60"
              >
                {hlBusy ? "Enviando…" : "Crear highlight"}
              </button>
              {hlMsg && <div className="text-xs text-red mt-2">{hlMsg}</div>}
            </div>
          )}
          <div className="flex-1 min-h-0 flex items-center justify-center p-2">
            {viewer.kind === "video" ? (
              <video
                src={viewer.url}
                controls
                playsInline
                autoPlay
                className="max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.url} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
