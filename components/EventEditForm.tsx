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

type Initial = {
  id: string;
  type: string;
  title: string | null;
  opponent: string | null;
  league: string | null;
  location: string | null;
  start_at: string;
  notes: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function EventEditForm({ teamSlug, initial }: { teamSlug: string; initial: Initial }) {
  // La fecha y la hora se muestran en la hora local de quien edita (igual que al crearlo).
  const d = new Date(initial.start_at);
  const [type, setType] = useState(initial.type);
  const [title, setTitle] = useState(initial.title ?? "");
  const [opponent, setOpponent] = useState(initial.opponent ?? "");
  const [league, setLeague] = useState(initial.league ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [date, setDate] = useState(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  const [time, setTime] = useState(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [notify, setNotify] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setLogo(await resizeImage(f, 400));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) {
      setStatus("error");
      setMessage("Completa la fecha y la hora.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("eventId", initial.id);
      formData.append("type", type);
      formData.append("title", title);
      formData.append("opponent", opponent);
      formData.append("league", league);
      formData.append("location", location);
      formData.append("startAt", new Date(`${date}T${time}`).toISOString());
      formData.append("notes", notes);
      if (logo) formData.append("opponentLogo", logo);
      if (notify) formData.append("notify", "1");

      const res = await fetch("/api/events", { method: "PATCH", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      router.push(`/${teamSlug}/calendario?m=${new Date(`${date}T${time}`).getFullYear()}-${new Date(`${date}T${time}`).getMonth()}`);
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  const input = "w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold";

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-2xl p-5">
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
              <input type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted mb-1.5">Liga / división</label>
              <input type="text" value={league} onChange={(e) => setLeague(e.target.value)} className={input} />
            </div>
          </div>
          <label className="block text-xs font-bold text-muted mb-1.5">Cambiar logo del rival (opcional)</label>
          <label className="inline-block bg-bg border border-border rounded-lg px-4 py-2 text-xs font-bold cursor-pointer mb-4">
            {logo ? logo.name : "Elegir imagen nueva"}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </label>
        </>
      ) : (
        <div className="mb-3">
          <label className="block text-xs font-bold text-muted mb-1.5">Título</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Hora</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-bold text-muted mb-1.5">Lugar</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={input} />
      </div>

      <div className="mb-4">
        <label className="block text-xs font-bold text-muted mb-1.5">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`${input} resize-none`}
        />
      </div>

      <label className="flex items-center gap-2 text-xs font-bold text-muted mb-4 cursor-pointer">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        Avisar al equipo por correo de este cambio
      </label>

      <button
        type="submit"
        disabled={status === "saving"}
        className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-60"
      >
        {status === "saving" ? "Guardando..." : "Guardar cambios"}
      </button>
      {message && <div className="mt-3 text-sm text-red">{message}</div>}
    </form>
  );
}
