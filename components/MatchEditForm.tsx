"use client";

// Editar rival, jornada y fecha de un partido (solo cuerpo técnico).
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MatchEditForm({
  matchId,
  opponent,
  jornada,
  dateYmd,
}: {
  matchId: string;
  opponent: string;
  jornada: number | null;
  dateYmd: string; // AAAA-MM-DD en hora del club
}) {
  const router = useRouter();
  const [opp, setOpp] = useState(opponent);
  const [j, setJ] = useState(jornada != null ? String(jornada) : "");
  const [date, setDate] = useState(dateYmd);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          opponent: opp,
          jornada: j.trim() === "" ? null : j.trim(),
          // la fecha solo se manda si la cambiaron (así no se pierde la hora original)
          matchDate: date && date !== dateYmd ? new Date(`${date}T12:00:00`).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      setMsg({ ok: true, text: "Guardado" });
      router.refresh();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message ?? "Ocurrió un error" });
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold";
  return (
    <form onSubmit={save} className="bg-panel border border-border rounded-2xl p-5 mt-6">
      <div className="font-display text-base font-semibold mb-3">Datos del partido</div>
      <div className="grid grid-cols-[90px_1fr] gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Jornada</label>
          <input
            type="text"
            inputMode="numeric"
            value={j}
            onChange={(e) => setJ(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="1"
            className={input}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Rival</label>
          <input type="text" value={opp} onChange={(e) => setOpp(e.target.value)} maxLength={120} className={input} />
        </div>
      </div>
      <div className="mb-4 max-w-[200px]">
        <label className="block text-xs font-bold text-muted mb-1.5">Fecha del partido</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
      </div>
      <div className="text-[11px] text-muted mb-4">
        La jornada es opcional. Con ella, la lista de Partidos se ordena como se fueron jugando (J1, J2, J3…).
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !opp.trim()} className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-60">
          {busy ? "Guardando..." : "Guardar"}
        </button>
        {msg && <span className={`text-xs font-bold ${msg.ok ? "text-ok" : "text-red"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
