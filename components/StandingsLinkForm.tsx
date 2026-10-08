"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Para entrenador/asistente: cambiar el enlace de la tabla de posiciones.
export default function StandingsLinkForm({
  teamSlug,
  currentUrl,
}: {
  teamSlug: string;
  currentUrl: string | null;
}) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team-standings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlug, url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "No se pudo guardar" });
        return;
      }
      setMessage({ ok: true, text: url.trim() ? "Enlace guardado" : "Enlace quitado" });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Ocurrió un error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-2xl p-5">
      <div className="font-display text-base font-semibold mb-1">Tabla de posiciones (Standings)</div>
      <div className="text-xs text-muted mb-4">
        Pega el enlace de la página de tu equipo en la liga. Todos los del equipo verán el botón “Standings” en Inicio.
        Cámbialo cuando empiece otra temporada o torneo.
      </div>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        maxLength={500}
        placeholder="https://system.gotsport.com/…"
        className="w-full bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm mb-3"
      />
      <button
        type="submit"
        disabled={busy}
        className="bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold disabled:opacity-60"
      >
        {busy ? "Guardando…" : "Guardar enlace"}
      </button>
      {message && (
        <div className={`mt-3 text-sm ${message.ok ? "text-gold" : "text-red"}`}>{message.text}</div>
      )}
    </form>
  );
}
