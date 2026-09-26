"use client";

import { useState } from "react";
import * as UpChunk from "@mux/upchunk";

export default function UploadForm({ teamSlug }: { teamSlug: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [opponent, setOpponent] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage("Elegí un archivo de video primero.");
      return;
    }
    setStatus("uploading");
    setMessage("");
    setProgress(0);

    try {
      // 1) crea el partido y pide una URL de subida directa a Mux
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlug, opponent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar la subida");

      if (!data.uploadUrl) {
        // Mux todavía no está conectado — el partido igual quedó creado
        setStatus("done");
        setMessage(data.note ?? "Partido creado (falta conectar el proveedor de video).");
        return;
      }

      // 2) sube el archivo directo a Mux, en pedazos, con reintentos automáticos
      const upload = UpChunk.createUpload({ endpoint: data.uploadUrl, file });

      upload.on("progress", (evt: any) => setProgress(Math.round(evt.detail)));

      upload.on("success", () => {
        setStatus("done");
        setProgress(100);
        setMessage("Video subido. Mux lo está procesando — el partido va a pasar a \"Analizado\" solo, en unos minutos.");
      });

      upload.on("error", (evt: any) => {
        setStatus("error");
        setMessage(evt.detail?.message ?? "Error al subir el archivo a Mux");
      });
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="border-2 border-dashed border-borderMuted rounded-2xl p-10 flex flex-col items-center gap-3 bg-sidebar mb-5">
        <div className="w-14 h-14 rounded-full bg-panel border border-borderMuted flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#F0D875" strokeWidth={2}>
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-sm font-bold text-center">Arrastrá el video del partido</div>
        <div className="text-xs text-muted text-center">o seleccioná un archivo · MP4, MOV hasta 4 GB</div>
        <label className="mt-1 bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold cursor-pointer">
          {file?.name ?? "Elegir archivo"}
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <label className="block text-xs font-bold text-muted mb-1.5">Rival</label>
      <input
        type="text"
        value={opponent}
        onChange={(e) => setOpponent(e.target.value)}
        placeholder="Ej: Halcones"
        className="w-full box-border bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm font-semibold mb-5"
      />

      {status === "uploading" && (
        <div className="mb-5">
          <div className="w-full h-2 rounded-full bg-bg overflow-hidden">
            <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-muted mt-1.5">{progress}%</div>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "uploading"}
        className="w-full bg-gold text-bg rounded-xl py-3.5 text-sm font-extrabold disabled:opacity-60"
      >
        {status === "uploading" ? "Subiendo..." : "Subir y procesar análisis"}
      </button>

      {message && (
        <div className={`mt-3 text-sm ${status === "error" ? "text-red" : "text-muted"}`}>{message}</div>
      )}
    </form>
  );
}
