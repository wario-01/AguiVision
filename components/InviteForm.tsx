"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Player } from "@/lib/data";

const ROLES = [
  { value: "coach", label: "Entrenador" },
  { value: "assistant", label: "Asistente" },
  { value: "player", label: "Jugador" },
  { value: "parent", label: "Madre/Padre" },
];

export default function InviteForm({
  teamSlug,
  teams,
  players,
}: {
  teamSlug: string;
  teams: { slug: string; name: string }[];
  players: Player[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("parent");
  const [playerName, setPlayerName] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([teamSlug]);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const needsPlayer = role === "player" || role === "parent";
  // Jugador/madre-padre quedan ligados a UN jugador de UN equipo — el
  // selector de varios equipos solo tiene sentido para entrenador/asistente.
  const canPickMultiple = !needsPlayer && teams.length > 1;

  function toggleTeam(slug: string) {
    setSelectedTeams((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targets = needsPlayer ? [teamSlug] : selectedTeams;
    if (targets.length === 0) {
      setStatus("error");
      setMessage("Elegí al menos un equipo.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      for (const slug of targets) {
        const res = await fetch("/api/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamSlug: slug,
            email,
            role,
            playerName: needsPlayer && playerName ? playerName : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`${slug}: ${data.error ?? "no se pudo invitar"}`);
      }
      setEmail("");
      setPlayerName("");
      setStatus("idle");
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-grow min-w-[200px]">
          <label className="block text-xs font-bold text-muted mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="familia@ejemplo.com"
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {needsPlayer && (
          <div className="min-w-[180px]">
            <label className="block text-xs font-bold text-muted mb-1.5">Jugador</label>
            <input
              list="players-list"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Ej: Mateo Contreras"
              className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
            />
            <datalist id="players-list">
              {players.map((p) => (
                <option key={p.id} value={p.full_name} />
              ))}
            </datalist>
          </div>
        )}
        <button
          type="submit"
          disabled={status === "saving"}
          className="bg-gold text-bg rounded-lg px-5 py-2 text-sm font-extrabold disabled:opacity-60"
        >
          {status === "saving" ? "Invitando..." : "Invitar"}
        </button>
      </div>

      {canPickMultiple && (
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">A qué equipos</label>
          <div className="flex gap-2 flex-wrap">
            {teams.map((t) => (
              <button
                type="button"
                key={t.slug}
                onClick={() => toggleTeam(t.slug)}
                className={`rounded-full px-4 py-2 text-xs font-bold ${
                  selectedTeams.includes(t.slug) ? "bg-gold text-bg" : "bg-bg border border-border text-muted"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsPlayer && (
        <div className="text-xs text-muted">
          Escribí el nombre de un jugador ya cargado (aparece mientras escribís) o uno nuevo — si es nuevo, se
          crea solo. Si lo dejás vacío, esa persona no queda vinculada a ningún jugador en particular.
        </div>
      )}
      {message && <div className="text-sm text-red">{message}</div>}
    </form>
  );
}
