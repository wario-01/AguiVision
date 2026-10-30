"use client";

import { useState } from "react";

type MatchOpt = { id: string; label: string };
type Item = { name: string; state: "wait" | "up" | "ok" | "error"; msg?: string; pct?: number };
type Prepared = { full: Blob; thumb: Blob; name: string; kind: "photo" | "video"; duration?: number; type: string };

const MAX_VIDEO_MB = 600;
const MAX_VIDEOS = 5;

const isVideoFile = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(f.name);

const FULL_EDGE = 2560; // lado largo máximo de la foto subida
const THUMB_EDGE = 480;

// Reduce la foto en el teléfono (JPG) antes de subirla: ahorra datos y espacio.
async function toJpeg(file: File, maxEdge: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo preparar la foto");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("No se pudo preparar la foto");
  return blob;
}

async function put(url: string, blob: Blob, type = "image/jpeg") {
  const res = await fetch(url, { method: "PUT", body: blob, headers: { "Content-Type": type } });
  if (!res.ok) throw new Error("No se pudo subir (" + res.status + ")");
}

// Los videos pesan mucho: se suben con barra de avance.
function putWithProgress(url: string, blob: Blob, type: string, onPct: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("No se pudo subir (" + xhr.status + ")")));
    xhr.onerror = () => reject(new Error("Se cortó la conexión al subir el video"));
    xhr.send(blob);
  });
}

// Miniatura de un video (un cuadro) y su duración. Si el navegador no puede leer el video
// (por ejemplo un .mov de iPhone en Chrome de escritorio) se usa una miniatura genérica.
async function videoThumb(file: File): Promise<{ thumb: Blob; duration?: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error("no se pudo leer"));
      setTimeout(() => rej(new Error("tiempo agotado")), 8000);
    });
    const duration = Number.isFinite(video.duration) ? video.duration : undefined;
    video.currentTime = Math.min(1, (duration ?? 2) / 2);
    await new Promise<void>((res, rej) => {
      video.onseeked = () => res();
      video.onerror = () => rej(new Error("no se pudo leer"));
      setTimeout(() => rej(new Error("tiempo agotado")), 8000);
    });
    const scale = Math.min(1, THUMB_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const thumb: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    if (!thumb) throw new Error("sin miniatura");
    return { thumb, duration };
  } catch {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0A2F5C";
    ctx.fillRect(0, 0, 480, 270);
    ctx.fillStyle = "#F9E547";
    ctx.beginPath();
    ctx.moveTo(210, 100);
    ctx.lineTo(210, 170);
    ctx.lineTo(275, 135);
    ctx.closePath();
    ctx.fill();
    const thumb: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    if (!thumb) throw new Error("No se pudo preparar el video");
    return { thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoUploadForm({ teamSlug, matches }: { teamSlug: string; matches: MatchOpt[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [album, setAlbum] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const other = matchId === "";

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return setMessage("Elige al menos una foto o video.");
    if (files.filter(isVideoFile).length > MAX_VIDEOS) return setMessage(`Máximo ${MAX_VIDEOS} videos por vez.`);
    const big = files.find((f) => isVideoFile(f) && f.size > MAX_VIDEO_MB * 1024 * 1024);
    if (big) return setMessage(`"${big.name}" pesa más de ${MAX_VIDEO_MB} MB. Recórtalo o elige otro.`);
    if (other && !album.trim()) return setMessage("Escribe el nombre del álbum (por ejemplo: Torneo de otoño).");
    setBusy(true);
    setMessage("");
    setItems(files.map((f) => ({ name: f.name, state: "wait" })));

    try {
      // 1) preparar todas las fotos (reducidas) y sus miniaturas
      const prepared: Prepared[] = [];
      const okIdx: number[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          if (isVideoFile(files[i])) {
            const { thumb, duration } = await videoThumb(files[i]);
            const ext = (files[i].name.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? "mp4").toLowerCase();
            prepared.push({
              full: files[i],
              thumb,
              name: files[i].name,
              kind: "video",
              duration,
              type: ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4",
            });
          } else {
            const full = await toJpeg(files[i], FULL_EDGE, 0.9);
            const thumb = await toJpeg(files[i], THUMB_EDGE, 0.8);
            prepared.push({ full, thumb, name: files[i].name, kind: "photo", type: "image/jpeg" });
          }
          okIdx.push(i);
        } catch {
          setItem(i, { state: "error", msg: "No se pudo leer este archivo" });
        }
      }
      if (prepared.length === 0) throw new Error("Ninguna foto se pudo preparar.");

      // 2) pedir los permisos de subida (y crear el registro de cada foto)
      const res = await fetch("/api/fotos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamSlug,
          matchId: other ? undefined : matchId,
          album: other ? album.trim() : undefined,
          files: prepared.map((p) => ({ name: p.name, size: p.full.size, thumbSize: p.thumb.size, kind: p.kind, duration: p.duration })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar la subida");

      // 3) subir directo a Cloudflare, 3 a la vez
      let next = 0;
      const failed: string[] = [];
      async function worker() {
        while (next < prepared.length) {
          const k = next++;
          const idx = okIdx[k];
          setItem(idx, { state: "up" });
          try {
            if (prepared[k].kind === "video") {
              await putWithProgress(data.items[k].uploadUrl, prepared[k].full, prepared[k].type, (pct) => setItem(idx, { pct }));
            } else {
              await put(data.items[k].uploadUrl, prepared[k].full);
            }
            await put(data.items[k].thumbUploadUrl, prepared[k].thumb);
            setItem(idx, { state: "ok" });
          } catch (err: any) {
            failed.push(data.items[k].id);
            setItem(idx, { state: "error", msg: err.message });
          }
        }
      }
      await Promise.all([worker(), worker(), worker()]);

      // las que fallaron se quitan de la galería para no dejar fotos rotas
      if (failed.length > 0) {
        await fetch("/api/fotos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamSlug, ids: failed }),
        }).catch(() => {});
      }
      const okCount = prepared.length - failed.length;
      setMessage(
        failed.length === 0
          ? `Listo: ${okCount} archivo${okCount === 1 ? "" : "s"} en la galería.`
          : `Se subieron ${okCount}; ${failed.length} fallaron — vuelve a elegirlos y súbelos otra vez.`
      );
      if (failed.length === 0) setFiles([]);
    } catch (err: any) {
      setMessage(err.message ?? "Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  const done = items.filter((i) => i.state === "ok").length;

  return (
    <form onSubmit={handleSubmit}>
      <div className="border-2 border-dashed border-borderMuted rounded-2xl p-8 flex flex-col items-center gap-3 bg-sidebar mb-5">
        <div className="text-sm font-bold text-center">Fotos y videos del partido o evento</div>
        <div className="text-xs text-muted text-center">
          Hasta 60 por vez (máximo 5 videos de 600 MB cada uno) · las fotos se reducen en tu teléfono antes de subir · se borran solas a los 60 días, salvo las que el cuerpo técnico marque con “Guardar”
        </div>
        <label className="mt-1 bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold cursor-pointer">
          {files.length > 0 ? `${files.length} archivo${files.length === 1 ? "" : "s"} elegido${files.length === 1 ? "" : "s"}` : "Elegir fotos o videos"}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 60))}
          />
        </label>
      </div>

      <label className="block text-xs font-bold text-muted mb-1.5">Álbum</label>
      <select
        value={matchId}
        onChange={(e) => setMatchId(e.target.value)}
        className="w-full box-border bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm font-semibold mb-3"
      >
        {matches.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        <option value="">Otro (torneo, entrenamiento, evento…)</option>
      </select>
      {other && (
        <input
          type="text"
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
          placeholder="Nombre del álbum, ej: Torneo de otoño"
          maxLength={80}
          className="w-full box-border bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm font-semibold mb-3"
        />
      )}

      {busy && items.length > 0 && (
        <div className="mb-4">
          <div className="w-full h-2 rounded-full bg-bg overflow-hidden">
            <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <div className="text-xs text-muted mt-1.5">
            {done} de {items.length} — no cierres la página mientras sube
          </div>
          {items.filter((i) => i.state === "up" && i.pct !== undefined).map((i, k) => (
            <div key={k} className="text-xs text-muted mt-1 truncate">
              {i.name}: {i.pct}%
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-gold text-bg rounded-xl py-3.5 text-sm font-extrabold disabled:opacity-60 mt-2"
      >
        {busy ? "Subiendo..." : "Subir"}
      </button>

      {message && <div className="mt-3 text-sm text-muted">{message}</div>}
      {items.some((i) => i.state === "error") && (
        <ul className="mt-2 text-xs text-red list-disc pl-5">
          {items.filter((i) => i.state === "error").map((i, k) => (
            <li key={k}>{i.name}: {i.msg}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
