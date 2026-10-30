"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// seriesId: el evento es parte de una serie que se repite (se puede borrar solo este o toda la serie).
// hasGames: es un torneo con juegos (borrarlo borra también sus juegos).
export default function EventDeleteButton({
  eventId,
  seriesId,
  hasGames,
}: {
  eventId: string;
  seriesId?: string | null;
  hasGames?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const router = useRouter();

  async function doDelete(series: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, series }),
      });
      if (!res.ok) {
        alert("No se pudo borrar el evento");
        setBusy(false);
        return;
      }
      setAsking(false);
      router.refresh();
    } catch {
      alert("Ocurrió un error");
      setBusy(false);
    }
  }

  function handleClick() {
    if (seriesId) {
      setAsking(true);
      return;
    }
    const msg = hasGames
      ? "¿Borrar este torneo? También se borran todos sus juegos (y la asistencia que hayas tomado en ellos)."
      : "¿Borrar este evento? Si ya tomaste asistencia, también se borra la asistencia de ese evento.";
    if (confirm(msg)) doDelete(false);
  }

  if (asking) {
    return (
      <span className="flex items-center gap-2 shrink-0 text-xs font-bold">
        <button onClick={() => doDelete(false)} disabled={busy} className="text-red disabled:opacity-50">
          Solo este
        </button>
        <button onClick={() => doDelete(true)} disabled={busy} className="text-red disabled:opacity-50">
          Toda la serie
        </button>
        <button onClick={() => setAsking(false)} disabled={busy} className="text-muted">
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="text-xs font-bold text-red hover:opacity-80 disabled:opacity-50 shrink-0"
    >
      Borrar
    </button>
  );
}
