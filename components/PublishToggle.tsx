"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Botón del entrenador para publicar / ocultar una evaluación a las familias.
export default function PublishToggle({
  endpoint,
  idField,
  idValue,
  published,
  pendingNote,
  disabled,
}: {
  endpoint: string; // "/api/evaluaciones/ciclos" o "/api/evaluaciones/fisico"
  idField: "cycleId" | "playerId";
  idValue: string;
  published: boolean;
  pendingNote?: string; // ej. "2 resultados nuevos sin publicar"
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function set(next: boolean) {
    if (
      next &&
      !confirm(
        "¿Publicar? La familia del jugador podrá ver estas calificaciones y tus notas. Puedes ocultarlas de nuevo cuando quieras."
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [idField]: idValue, published: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo cambiar la publicación");
      }
      router.refresh();
    } catch {
      alert("Ocurrió un error");
    }
    setBusy(false);
  }

  return (
    <div className="bg-panel border border-border rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold">
            {published ? "Visible para las familias" : "Solo la ven los entrenadores"}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {published
              ? "Cada familia ve únicamente la evaluación de su hijo."
              : "Cuando termines de calificar, publícala para que las familias la vean."}
          </div>
          {pendingNote && <div className="text-xs text-gold mt-1">{pendingNote}</div>}
        </div>
        <div className="flex gap-2 shrink-0">
          {(!published || pendingNote) && (
            <button
              onClick={() => set(true)}
              disabled={busy || disabled}
              className="bg-gold text-bg rounded-lg px-4 py-2 text-xs font-extrabold disabled:opacity-50"
            >
              {busy ? "…" : published ? "Publicar nuevos" : "Publicar"}
            </button>
          )}
          {published && (
            <button
              onClick={() => set(false)}
              disabled={busy}
              className="border border-borderMuted text-muted rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              Ocultar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
