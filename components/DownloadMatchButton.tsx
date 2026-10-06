"use client";

// components/DownloadMatchButton.tsx
// Prepara y ofrece la descarga del partido completo (solo entrenador/asistente).

import { useState } from "react";

export default function DownloadMatchButton({ matchId }: { matchId: string }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function prepare() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/matches/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo preparar la descarga");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {!url ? (
        <button
          onClick={prepare}
          disabled={busy}
          className="inline-flex w-fit items-center gap-2 bg-panel border border-border rounded-lg px-4 py-2.5 text-sm font-bold hover:border-borderMuted disabled:opacity-60"
        >
          {busy ? "Preparando..." : "Descargar partido"}
        </button>
      ) : (
        <>
          <a
            href={url}
            className="inline-flex w-fit items-center gap-2 bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold"
          >
            Descargar archivo del partido
          </a>
          <div className="text-xs text-muted">
            Si es la primera vez que lo pides, el archivo puede tardar unos minutos (más si el partido es largo) en estar
            listo. Si la descarga no empieza o dice que no existe, espera un rato y vuelve a intentarlo. Los partidos se
            borran a los 6 meses.
          </div>
        </>
      )}
      {error && <div className="text-xs text-red font-semibold">{error}</div>}
    </div>
  );
}
