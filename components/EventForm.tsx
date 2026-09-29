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

export default function EventForm({ teamSlug, onDone }: { teamSlug: string; onDone?: () => void }) {
  const [type, setType] = useState("game");
  const [title, setTitle] = useState("");
  const [opponent, setOpponent] = useState("");
  const [league, setLeague] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
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
      setMessage("Completá la fecha y la hora.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("teamSlug", teamSlug);
      formData.append("type", type);
      if (title) formData.append("title", title);
      if (opponent) formData.append("opponent", opponent);
      if (league) formData.append("league", league);
      if (location) formData.append("location", location);
      formData.append("startAt", new Date(`${date}T${time}`).toISOString());
      if (notes) formData.append("notes", notes);
      if (logo) formData.append("opponentLogo", logo);

      const res = await fetch("/api/events", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el evento");

      setTitle("");
      setOpponent("");
      setLeague("");
      setLocation("");
      setDate("");
      setTime("");
      setNotes("");
      setLogo(null);
      setStatus("idle");
      router.refresh();
      onDone?.();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-2xl p-5">
      <div className="font-display text-base font-semibold mb-4">Nuevo evento</div>

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
            placeholder="Ej: Entrenamiento semanal"
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Hora</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </div>
      </div>

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
