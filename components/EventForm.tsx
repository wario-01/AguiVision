"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImage } from "@/lib/resizeImage";

const TYPES = [
  { value: "game", label: "Partido" },
  { value: "practice", label: "Entrenamiento" },
  { value: "tournament", label: "Torneo" },
  { value: "other", label: "Otro" },
];

type GameRow = { opponent: string; date: string; time: string; location: string; logo: File | null };

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Todas las fechas entre "desde" y "hasta" (inclusive) que caen en los días elegidos,
// con la misma hora. Se arman en hora local (igual que un evento suelto).
function repeatDates(from: string, to: string, days: number[], time: string): string[] {
  if (!from || !to || !time || days.length === 0) return [];
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  const last = new Date(`${to}T23:59`);
  for (let i = 0; i < 400; i++) {
    const day = new Date(y, m - 1, d + i);
    if (day > last) break;
    if (!days.includes(day.getDay())) continue;
    const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    out.push(new Date(`${ymd}T${time}`).toISOString());
  }
  return out;
}

export default function EventForm({
  teamSlug,
  teams,
  onDone,
}: {
  teamSlug: string;
  teams: { slug: string; name: string }[];
  onDone?: () => void;
}) {
  const [type, setType] = useState("game");
  const [title, setTitle] = useState("");
  const [opponent, setOpponent] = useState("");
  const [league, setLeague] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([teamSlug]);
  // Torneo: fecha de fin y lista de juegos (rival, día, hora).
  const [endDate, setEndDate] = useState("");
  const [games, setGames] = useState<GameRow[]>([]);
  // Evento que se repite (entrenamientos): días de la semana y fecha final.
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  function toggleTeam(slug: string) {
    setSelectedTeams((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setLogo(await resizeImage(f, 400));
  }

  const isTournament = type === "tournament";
  const canRepeat = type === "practice" || type === "other";
  const repeatList = repeat && canRepeat ? repeatDates(date, until, weekdays, time) : [];

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }
  function setGame(i: number, patch: Partial<GameRow>) {
    setGames((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function addGame() {
    setGames((prev) => [...prev, { opponent: "", date: prev[prev.length - 1]?.date || date, time: "", location: "", logo: null }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || (!isTournament && !time)) {
      setStatus("error");
      setMessage(isTournament ? "Completa la fecha de inicio del torneo." : "Completa la fecha y la hora.");
      return;
    }
    if (selectedTeams.length === 0) {
      setStatus("error");
      setMessage("Elige al menos un equipo.");
      return;
    }
    if (isTournament) {
      if (!title.trim()) {
        setStatus("error");
        setMessage("Escribe el nombre del torneo.");
        return;
      }
      if (endDate && endDate < date) {
        setStatus("error");
        setMessage("La fecha de fin no puede ser antes del inicio.");
        return;
      }
      const bad = games.findIndex((g) => !g.opponent.trim() || !g.date || !g.time);
      if (bad >= 0) {
        setStatus("error");
        setMessage(`Al juego ${bad + 1} le falta el rival, la fecha o la hora (o quítalo).`);
        return;
      }
    }
    if (repeat && canRepeat) {
      if (weekdays.length === 0 || !until) {
        setStatus("error");
        setMessage("Elige los días de la semana y hasta qué fecha se repite.");
        return;
      }
      if (repeatList.length === 0) {
        setStatus("error");
        setMessage("Con esos días y esa fecha final no sale ningún evento.");
        return;
      }
      if (repeatList.length > 120) {
        setStatus("error");
        setMessage("Son demasiados eventos (máximo 120). Elige una fecha final más cercana.");
        return;
      }
    }
    setStatus("saving");
    setMessage("");
    try {
      for (const slug of selectedTeams) {
        const formData = new FormData();
        formData.append("teamSlug", slug);
        formData.append("type", type);
        if (title) formData.append("title", title);
        if (opponent) formData.append("opponent", opponent);
        if (league) formData.append("league", league);
        if (location) formData.append("location", location);
        if (isTournament) {
          // El torneo ocupa días completos; la hora de cada juego va en sus juegos.
          formData.append("startAt", new Date(`${date}T12:00`).toISOString());
          if (endDate) formData.append("endAt", new Date(`${endDate}T12:00`).toISOString());
        } else if (repeat && canRepeat) {
          formData.append("startAt", repeatList[0]);
          formData.append("repeatDates", JSON.stringify(repeatList));
        } else {
          formData.append("startAt", new Date(`${date}T${time}`).toISOString());
        }
        if (notes) formData.append("notes", notes);
        if (logo) formData.append("opponentLogo", logo);

        const res = await fetch("/api/events", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(`${slug}: ${data.error ?? "no se pudo crear"}`);

        // Juegos del torneo: uno por uno, dentro del torneo recién creado.
        if (isTournament) {
          for (const g of games) {
            const gf = new FormData();
            gf.append("teamSlug", slug);
            gf.append("type", "game");
            gf.append("parentEventId", data.id);
            gf.append("opponent", g.opponent.trim());
            if (league) gf.append("league", league);
            const loc = g.location.trim() || location;
            if (loc) gf.append("location", loc);
            gf.append("startAt", new Date(`${g.date}T${g.time}`).toISOString());
            if (g.logo) gf.append("opponentLogo", g.logo);
            const gr = await fetch("/api/events", { method: "POST", body: gf });
            const gd = await gr.json().catch(() => ({}));
            if (!gr.ok) {
              throw new Error(
                `El torneo se creó, pero falló el juego vs ${g.opponent}: ${gd.error ?? "no se pudo crear"}. Agrégalo desde Editar en el torneo.`
              );
            }
          }
        }
      }

      setTitle("");
      setOpponent("");
      setLeague("");
      setLocation("");
      setDate("");
      setTime("");
      setNotes("");
      setLogo(null);
      setEndDate("");
      setGames([]);
      setRepeat(false);
      setWeekdays([]);
      setUntil("");
      setStatus("idle");
      router.refresh();
      onDone?.();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-2xl p-5">
      <div className="font-display text-base font-semibold mb-4">Nuevo evento</div>

      {teams.length > 1 && (
        <div className="mb-4">
          <label className="block text-xs font-bold text-muted mb-1.5">Aplicar a estos equipos</label>
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

      <label className="block text-xs font-bold text-muted mb-1.5">Tipo</label>
      <div className="flex gap-2 mb-4 flex-wrap">
        {TYPES.map((t) => (
          <button
            type="button"
            key={t.value}
            onClick={() => setType(t.value)}
            className={`rounded-full px-4 py-2 text-xs font-bold ${
              type === t.value ? "bg-gold text-bg" : "bg-bg border border-border text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === "game" ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-bold text-muted mb-1.5">Rival</label>
              <input
                type="text"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Ej: Solar SC"
                className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted mb-1.5">Liga / división</label>
              <input
                type="text"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                placeholder="Ej: CAYSA Fall 2026 Division 3"
                className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </div>
          </div>
          <label className="block text-xs font-bold text-muted mb-1.5">Logo del rival (opcional)</label>
          <label className="inline-block bg-bg border border-border rounded-lg px-4 py-2 text-xs font-bold cursor-pointer mb-4">
            {logo ? logo.name : "Elegir imagen"}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </label>
        </>
      ) : (
        <div className="mb-3">
          <label className="block text-xs font-bold text-muted mb-1.5">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isTournament ? "Ej: Copa Austin Otoño" : "Ej: Entrenamiento semanal"}
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
          {isTournament && (
            <div className="mt-3">
              <label className="block text-xs font-bold text-muted mb-1.5">Liga / organizador (opcional)</label>
              <input
                type="text"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">{isTournament ? "Primer día" : "Fecha"}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>
        <div>
          {isTournament ? (
            <>
              <label className="block text-xs font-bold text-muted mb-1.5">Último día (opcional)</label>
              <input
                type="date"
                value={endDate}
                min={date || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </>
          ) : (
            <>
              <label className="block text-xs font-bold text-muted mb-1.5">Hora</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
              />
            </>
          )}
        </div>
      </div>

      {canRepeat && (
        <div className="mb-3 bg-bg border border-border rounded-xl p-3">
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => {
                setRepeat(e.target.checked);
                if (e.target.checked && weekdays.length === 0 && date) setWeekdays([new Date(`${date}T12:00`).getDay()]);
              }}
            />
            Se repite (por ejemplo, entrenamientos de cada semana)
          </label>
          {repeat && (
            <div className="mt-3">
              <div className="text-xs font-bold text-muted mb-1.5">Los días</div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {WEEKDAYS.map((w, d) => (
                  <button
                    type="button"
                    key={w}
                    onClick={() => toggleWeekday(d)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      weekdays.includes(d) ? "bg-gold text-bg" : "bg-panel border border-border text-muted"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <label className="block text-xs font-bold text-muted mb-1.5">Hasta qué fecha</label>
              <input
                type="date"
                value={until}
                min={date || undefined}
                onChange={(e) => setUntil(e.target.value)}
                className="w-full box-border bg-panel border border-border rounded-lg px-3 py-2 text-sm font-semibold"
              />
              <div className="text-xs text-muted mt-2">
                {repeatList.length > 0
                  ? `Se crearán ${repeatList.length} evento${repeatList.length === 1 ? "" : "s"}, desde el ${new Date(
                      repeatList[0]
                    ).toLocaleDateString("es-MX", { day: "numeric", month: "long" })} hasta el ${new Date(
                      repeatList[repeatList.length - 1]
                    ).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}.`
                  : "Elige la fecha inicial, la hora, los días y la fecha final."}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-3">
        <label className="block text-xs font-bold text-muted mb-1.5">Lugar</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ej: Roy G. Guerrero Metro Park, Field #2"
          className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
        />
      </div>

      {isTournament && (
        <div className="mb-4">
          <div className="text-xs font-bold text-muted mb-1.5">Juegos del torneo</div>
          {games.length === 0 && (
            <div className="text-xs text-muted mb-2">
              Agrega aquí cada juego con su rival, día y hora. También puedes agregarlos después desde Editar.
            </div>
          )}
          <div className="flex flex-col gap-2 mb-2">
            {games.map((g, i) => (
              <div key={i} className="bg-bg border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-extrabold text-gold uppercase tracking-wide">Juego {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setGames((prev) => prev.filter((_, idx) => idx !== i))}
                    className="ml-auto text-xs font-bold text-red"
                  >
                    Quitar
                  </button>
                </div>
                <input
                  type="text"
                  value={g.opponent}
                  onChange={(e) => setGame(i, { opponent: e.target.value })}
                  placeholder="Rival, ej: Solar SC"
                  className="w-full box-border bg-panel border border-border rounded-lg px-3 py-2 text-sm font-semibold mb-2"
                />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="date"
                    value={g.date}
                    onChange={(e) => setGame(i, { date: e.target.value })}
                    className="w-full box-border bg-panel border border-border rounded-lg px-3 py-2 text-sm font-semibold"
                  />
                  <input
                    type="time"
                    value={g.time}
                    onChange={(e) => setGame(i, { time: e.target.value })}
                    className="w-full box-border bg-panel border border-border rounded-lg px-3 py-2 text-sm font-semibold"
                  />
                </div>
                <input
                  type="text"
                  value={g.location}
                  onChange={(e) => setGame(i, { location: e.target.value })}
                  placeholder="Cancha (opcional; si lo dejas vacío usa el lugar del torneo)"
                  className="w-full box-border bg-panel border border-border rounded-lg px-3 py-2 text-xs font-semibold"
                />
                <label className="inline-block bg-panel border border-border rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer mt-2">
                  {g.logo ? g.logo.name : "Logo del rival (opcional)"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setGame(i, { logo: await resizeImage(f, 400) });
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addGame}
            className="bg-bg border border-border rounded-lg px-4 py-2 text-xs font-bold text-gold"
          >
            + Agregar juego
          </button>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs font-bold text-muted mb-1.5">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={status === "saving"}
        className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-60"
      >
        {status === "saving" ? "Guardando..." : "Agregar al calendario"}
      </button>
      {message && <div className="mt-3 text-sm text-red">{message}</div>}
    </form>
  );
}
