"use client";

// Se muestra cuando el highlight ya tiene su video final (dibujos, voz y música pegados).
import { useState } from "react";
import Link from "next/link";
import MatchPlayer from "@/components/MatchPlayer";

export default function ReeditPanel({ teamSlug, highlightId, playbackId }: { teamSlug: string; highlightId: string; playbackId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reedit() {
    if (!confirm("Se va a volver a sacar el clip limpio del partido (1 o 2 minutos). Mientras tanto el highlight no se podrá ver. Tus dibujos, voz y música guardados no se pierden. ¿Continuar?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/highlights/reedit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "No se pudo preparar el clip");
      setDone(true);
    } catch (e: any) {
      setErr(e.message ?? "Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="bg-panel border border-border rounded-2xl p-4 mb-4">
        <div className="font-bold mb-1">Este highlight ya tiene su video final</div>
        <div className="text-sm text-muted leading-relaxed">
          Los dibujos, tu voz y la música ya están pegados al video, y es el que ven las familias y el que se descarga. Para cambiar algo, usa
          «Volver a editar»: la app vuelve a sacar el clip limpio y te devuelve tus dibujos, voz y música como los dejaste.
        </div>
      </div>
      <MatchPlayer playbackId={playbackId} />
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        {done ? (
          <div className="text-sm font-bold text-ok">
            Listo: el clip se está preparando (1 o 2 minutos). Recarga esta página en un rato para seguir editando.
          </div>
        ) : (
          <button type="button" onClick={reedit} disabled={busy} className="bg-gold text-bg rounded-lg px-5 py-3 text-sm font-extrabold disabled:opacity-50">
            {busy ? "Preparando..." : "Volver a editar"}
          </button>
        )}
        <Link href={`/${teamSlug}/highlights/${highlightId}`} className="text-sm font-bold text-muted hover:text-text">
          Volver al highlight
        </Link>
      </div>
      {err && <div className="mt-3 text-sm font-bold text-red">{err}</div>}
    </div>
  );
}
