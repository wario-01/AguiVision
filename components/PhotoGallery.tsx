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
};

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
}: {
  teamSlug: string;
  photos: GalleryPhoto[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [viewer, setViewer] = useState<{ id: string; url: string; name: string; dl: string } | null>(null);
  const [onlyKept, setOnlyKept] = useState(false);

  const albums = useMemo(() => {
    const map = new Map<string, { album: string; date: string; items: GalleryPhoto[] }>();
    for (const p of photos) {
      if (onlyKept && !p.keep) continue;
      const k = `${p.albumDate}|${p.album}`;
      if (!map.has(k)) map.set(k, { album: p.album, date: p.albumDate, items: [] });
      map.get(k)!.items.push(p);
    }
    return Array.from(map.values());
  }, [photos, onlyKept]);

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
      setViewer({ id: p.id, url: view.url, name: p.fileName, dl: dl.url });
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
      setBusy(`Preparando ${ids.length} fotos…`);
      const ls = await links(ids, true);
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
      setMessage(`Listo: ${files.length} fotos en un zip.`);
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
    return <div className="text-sm text-muted">Todavía no hay fotos. Súbelas desde Subir → Fotos.</div>;
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
              <span className="text-xs text-muted">{fmtDate(g.date)} · {g.items.length} foto{g.items.length === 1 ? "" : "s"}</span>
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
              <a href={viewer.dl} className="text-xs font-extrabold rounded-full px-3.5 py-2 bg-gold text-bg">Descargar</a>
              <button onClick={() => setViewer(null)} className="text-xs font-bold rounded-full px-3.5 py-2 border border-borderMuted text-text">Cerrar</button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewer.url} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}
