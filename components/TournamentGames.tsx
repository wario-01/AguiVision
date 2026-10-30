"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EventDeleteButton from "@/components/EventDeleteButton";

type Game = { id: string; opponent: string | null; location: string | null; label: string };

// Juegos de un torneo: ver los que hay, quitar y agregar nuevos (rival, día y hora).
export default function TournamentGames({
  teamSlug,
  tournamentId,
  league,
  location,
  startDate,
  games,
}: {
  teamSlug: string;
  tournamentId: string;
  league: string | null;
  location: string | null;
  startDate: string; // YYYY-MM-DD, para sugerir el día
  games: Game[];
}) {
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState(startDate);
  const [time, setTime] = useState("");
  const [gameLocation, setGameLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!opponent.trim() || !date || !time) {
      setMessage("Escribe el rival, el día y la hora.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const f = new FormData();
      f.append("teamSlug", teamSlug);
      f.append("type", "game");
      f.append("parentEventId", tournamentId);
      f.append("opponent", opponent.trim());
      if (league) f.append("league", league);
      const loc = gameLocation.trim() || location || "";
      if (loc) f.append("location", loc);
      f.append("startAt", new Date(`${date}T${time}`).toISOString());
      const res = await fetch("/api/events", { method: "POST", body: f });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo agregar el juego");
      setOpponent("");
      setTime("");
      setGameLocation("");
      router.refresh();
    } catch (err: any) {
      setMessage(err.message ?? "Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold";

  return (
    <div className="bg-panel border border-border rounded-2xl p-5 mt-6">
      <div className="font-display text-base font-semibold mb-3">Juegos del torneo</div>
      {games.length === 0 ? (
        <div className="text-sm text-muted mb-4">Todavía no hay juegos. Agrega el primero abajo.</div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {games.map((g) => (
            <div key={g.id} className="flex items-center gap-3 bg-bg border border-border rounded-xl px-3 py-2.5">
              <div className="flex-grow min-w-0">
                <div className="text-sm font-bold truncate">vs {g.opponent ?? "?"}</div>
                <div className="text-xs text-muted truncate">
                  {g.label}
                  {g.location ? ` · ${g.location}` : ""}
                </div>
              </div>
              <Link
                href={`/${teamSlug}/calendario/evento/${g.id}/editar`}
                className="text-xs font-bold text-gold hover:underline shrink-0"
              >
                Editar
              </Link>
              <EventDeleteButton eventId={g.id} />
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="bg-bg border border-border rounded-xl p-3">
        <div className="text-xs font-bold text-muted mb-2">Agregar juego</div>
        <input
          type="text"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          placeholder="Rival, ej: Solar SC"
          className={`${input} mb-2 !bg-panel`}
        />
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} !bg-panel`} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${input} !bg-panel`} />
        </div>
        <input
          type="text"
          value={gameLocation}
          onChange={(e) => setGameLocation(e.target.value)}
          placeholder="Cancha (opcional; si lo dejas vacío usa el lugar del torneo)"
          className={`${input} !bg-panel text-xs mb-3`}
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-60"
        >
          {busy ? "Agregando..." : "Agregar juego"}
        </button>
        {message && <div className="mt-3 text-sm text-red">{message}</div>}
      </form>
    </div>
  );
}
