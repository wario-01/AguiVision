"use client";

import { useState } from "react";

export default function UploadForm({ teamSlug }: { teamSlug: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [opponent, setOpponent] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileName) {
      setMessage("Elegí un archivo de video primero.");
      return;
    }
    setStatus("uploading");
    setMessage("");
    try {
      // 1) Pide una URL de subida directa al backend (esto crea el registro
      //    del partido y, en el proveedor de video, un "direct upload").
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlug, opponent, fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar la subida");

      // 2) TODO: cuando esté conectado Mux/Cloudflare, acá se sube el
      //    archivo real con fetch(data.uploadUrl, { method: 'PUT', body: file }).
      setStatus("done");
      setMessage("Backend listo para recibir el archivo (falta conectar el proveedor de video).");
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
          {fileName ?? "Elegir archivo"}
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
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
