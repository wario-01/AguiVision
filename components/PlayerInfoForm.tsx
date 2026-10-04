"use client";

// components/PlayerInfoForm.tsx
//
// Formulario para capturar/editar número, posición, peso, altura y
// perfil (pie dominante) de un jugador. Solo coach/asistente lo ven
// (la página que lo renderiza ya filtra el acceso).

import { useState } from "react";
import { useRouter } from "next/navigation";

const POSICIONES = [
  "Portero",
  "Defensa central",
  "Lateral derecho",
  "Lateral izquierdo",
  "Mediocampista defensivo",
  "Mediocampista",
  "Mediocampista ofensivo",
  "Extremo derecho",
  "Extremo izquierdo",
  "Delantero",
];

const PERFILES = [
  { value: "derecho", label: "Pie derecho" },
  { value: "izquierdo", label: "Pie izquierdo" },
  { value: "ambidiestro", label: "Ambidiestro" },
];

export default function PlayerInfoForm({
  playerId,
  teamSlug,
  initial,
}: {
  playerId: string;
  teamSlug: string;
  initial: {
    jersey_number: number | null;
    position: string | null;
    peso: number | null;
    altura: number | null;
    perfil: string | null;
  };
}) {
  const [jersey, setJersey] = useState(initial.jersey_number?.toString() ?? "");
  const [position, setPosition] = useState(initial.position ?? "");
  const [peso, setPeso] = useState(initial.peso?.toString() ?? "");
  const [altura, setAltura] = useState(initial.altura?.toString() ?? "");
  const [perfil, setPerfil] = useState(initial.perfil ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/player-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          jersey_number: jersey,
          position,
          peso,
          altura,
          perfil,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      router.push(`/${teamSlug}/jugador/${playerId}`);
      router.refresh();
    } catch {
      setError("Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">Número</span>
          <input
            type="number"
            min={0}
            max={99}
            value={jersey}
            onChange={(e) => setJersey(e.target.value)}
            className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
            placeholder="Ej. 10"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">Posición</span>
          <input
            list="posiciones"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
            placeholder="Ej. Delantero"
          />
          <datalist id="posiciones">
            {POSICIONES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">Peso (kg)</span>
          <input
            type="number"
            step="0.1"
            min={0}
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
            placeholder="Ej. 45.5"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">Altura (cm)</span>
          <input
            type="number"
            step="0.1"
            min={0}
            value={altura}
            onChange={(e) => setAltura(e.target.value)}
            className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
            placeholder="Ej. 150"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted">Perfil (pie dominante)</span>
        <select
          value={perfil}
          onChange={(e) => setPerfil(e.target.value)}
          className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Sin especificar</option>
          {PERFILES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {error && <div className="text-xs text-red-400 font-semibold">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar datos"}
        </button>
      </div>
    </form>
  );
}
