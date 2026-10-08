"use client";

// components/PlayerInfoForm.tsx
//
// Formulario de jugador, para dos casos:
//  - Crear (sin playerId, con teamId): nombre + número, posición, peso,
//    altura y perfil (pie dominante).
//  - Editar (con playerId): los mismos campos, ya llenos.
// Solo coach/asistente lo ven (las páginas que lo renderizan filtran).

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
  teamId,
  teamSlug,
  initial,
}: {
  playerId?: string;
  teamId?: string;
  teamSlug: string;
  initial: {
    full_name: string;
    jersey_number: number | null;
    position: string | null;
    peso: number | null;
    altura: number | null;
    cintura: number | null;
    perfil: string | null;
    age_months: number | null; // edad estimada hoy, en meses
    sex: "M" | "F" | null;
  };
}) {
  const isCreate = !playerId;
  const [fullName, setFullName] = useState(initial.full_name);
  const [jersey, setJersey] = useState(initial.jersey_number?.toString() ?? "");
  const [position, setPosition] = useState(initial.position ?? "");
  const [peso, setPeso] = useState(initial.peso?.toString() ?? "");
  // La altura se guarda en pulgadas totales; en el formulario se captura en pies + pulgadas.
  const [pies, setPies] = useState(initial.altura != null ? String(Math.floor(initial.altura / 12)) : "");
  const [pulg, setPulg] = useState(
    initial.altura != null ? String(Math.round((initial.altura - Math.floor(initial.altura / 12) * 12) * 10) / 10) : ""
  );
  const [cintura, setCintura] = useState(initial.cintura?.toString() ?? "");
  const [edadAnios, setEdadAnios] = useState(initial.age_months != null ? String(Math.floor(initial.age_months / 12)) : "");
  const [edadMeses, setEdadMeses] = useState(initial.age_months != null ? String(Math.floor(initial.age_months % 12)) : "");
  const [sex, setSex] = useState<string>(initial.sex ?? "");
  const [perfil, setPerfil] = useState(initial.perfil ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if ((pies !== "" || pulg !== "") && pies === "") {
      setError("Faltan los pies de la altura (por ejemplo 4 pies 11 pulgadas)");
      setBusy(false);
      return;
    }
    const altura = pies === "" ? "" : String(Number(pies) * 12 + Number(pulg || 0));
    try {
      const res = await fetch(isCreate ? "/api/players" : "/api/player-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isCreate ? { teamId } : { playerId }),
          full_name: fullName,
          jersey_number: jersey,
          position,
          peso,
          altura,
          cintura,
          perfil,
          edad_anios: edadAnios,
          edad_meses: edadMeses,
          sex,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      router.push(isCreate ? `/${teamSlug}/equipo` : `/${teamSlug}/jugador/${playerId}`);
      router.refresh();
    } catch {
      setError("Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-xl p-5 flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted">Nombre completo</span>
        <input
          required
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
          placeholder="Ej. Mateo Ramírez"
        />
      </label>

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
          <span className="text-xs font-bold text-muted">Peso (libras)</span>
          <input
            type="number"
            step="0.1"
            min={0}
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
            placeholder="Ej. 85"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">Altura</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={8}
              value={pies}
              onChange={(e) => setPies(e.target.value)}
              aria-label="Pies"
              className="w-full bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
              placeholder="4"
            />
            <span className="text-xs text-muted">pies</span>
            <input
              type="number"
              step="0.1"
              min={0}
              max={11.9}
              value={pulg}
              onChange={(e) => setPulg(e.target.value)}
              aria-label="Pulgadas"
              className="w-full bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
              placeholder="11"
            />
            <span className="text-xs text-muted">pulg</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">Edad hoy (para el IMC)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={3}
              max={20}
              value={edadAnios}
              onChange={(e) => setEdadAnios(e.target.value)}
              aria-label="Años"
              className="w-full bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
              placeholder="11"
            />
            <span className="text-xs text-muted">años</span>
            <input
              type="number"
              min={0}
              max={11}
              value={edadMeses}
              onChange={(e) => setEdadMeses(e.target.value)}
              aria-label="Meses"
              className="w-full bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
              placeholder="4"
            />
            <span className="text-xs text-muted">meses</span>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">Cintura (pulgadas, opcional)</span>
          <input
            type="number"
            step="0.1"
            min={0}
            value={cintura}
            onChange={(e) => setCintura(e.target.value)}
            className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
            placeholder="Ej. 25"
          />
          <span className="text-[11px] text-muted">Con cinta, a la altura del ombligo, sin apretar.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">Sexo (para el IMC)</span>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as "M" | "F" | "")}
            className="bg-panel2 border border-borderMuted rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Sin especificar</option>
            <option value="M">Niño</option>
            <option value="F">Niña</option>
          </select>
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

      {error && <div className="text-xs text-red font-semibold">{error}</div>}

      <div className="text-xs text-muted">
        Peso, altura, edad y sexo sirven para calcular el IMC y compararlo con el CDC. No se guarda la fecha de nacimiento: la
        edad queda con cada medición. Revisa la edad cada vez que cambies el peso o la altura.
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-50"
        >
          {busy ? "Guardando…" : isCreate ? "Agregar jugador" : "Guardar datos"}
        </button>
      </div>
    </form>
  );
}
