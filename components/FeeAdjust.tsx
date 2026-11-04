"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { money, monthsOwed, agreedTotalCents, type PlayerFee } from "@/lib/finance-shared";

const STD_MONTHLY = 11000;

const fmtMonths = (m: number) => (Number.isInteger(m) ? String(m) : m.toFixed(2).replace(/0$/, ""));
const usDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function FeeAdjust({
  playerId,
  playerName,
  season,
  current,
}: {
  playerId: string;
  playerName: string;
  season: string;
  current: PlayerFee | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [monthly, setMonthly] = useState(String((current?.monthly_cents ?? STD_MONTHLY) / 100));
  const [joined, setJoined] = useState(current?.joined_on ?? "");
  const [months, setMonths] = useState(String(current?.months ?? 12));
  const [monthsAuto, setMonthsAuto] = useState(!current);
  const [override, setOverride] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<PlayerFee[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const monthlyC = Math.round((Number(monthly.replace(/[$,\s]/g, "")) || 0) * 100);
  const monthsN = Number(months) || 0;
  const calcC = agreedTotalCents(monthlyC, monthsN);
  const overrideC = override === "" ? null : Math.round((Number(override.replace(/[$,\s]/g, "")) || 0) * 100);
  const finalC = overrideC ?? calcC;

  // Con fecha de ingreso, los meses se calculan solos (se pueden corregir a mano).
  useEffect(() => {
    if (monthsAuto) setMonths(fmtMonths(monthsOwed(joined || null, season)));
  }, [joined, monthsAuto, season]);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/recibos/cuotas?playerId=${playerId}&season=${season}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .catch(() => {});
  }, [open, playerId, season]);

  async function save() {
    setError("");
    if (note.trim().length < 3) return setError("Escribe el motivo del cambio.");
    setBusy(true);
    try {
      const res = await fetch("/api/recibos/cuotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, season, monthly, months: monthsN, joinedOn: joined || null, note, totalOverride: overrideC === null ? null : overrideC / 100 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo guardar");
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }

  const input = "w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold";
  const label = "block text-[11px] font-bold text-muted mb-1";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="no-print text-[11px] font-bold rounded-full px-2.5 py-1 border border-borderMuted text-muted hover:text-text">
        Ajustar cuota
      </button>
      {open && (
        <div className="no-print fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-panel border border-border rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-lg font-bold">Cuota acordada</div>
            <div className="text-xs text-muted mb-4">{playerName} · temporada {season}</div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={label}>Cuota por mes (USD)</label>
                <input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>Fecha de ingreso (si entró tarde)</label>
                <input type="date" value={joined} onChange={(e) => { setJoined(e.target.value); setMonthsAuto(true); }} className={input} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={label}>Meses a cobrar {monthsAuto ? "(automático)" : "(manual)"}</label>
                <input inputMode="decimal" value={months} onChange={(e) => { setMonths(e.target.value); setMonthsAuto(false); }} className={input} />
              </div>
              <div>
                <label className={label}>Ajustar total a mano (opcional)</label>
                <input inputMode="decimal" value={override} onChange={(e) => setOverride(e.target.value)} placeholder={money(calcC)} className={input} />
              </div>
            </div>
            <div className="bg-bg border border-border rounded-xl px-3.5 py-2.5 text-sm mb-3">
              <span className="text-muted">{money(monthlyC)} × {fmtMonths(monthsN)} meses{overrideC !== null ? " (ajustado a mano)" : ""} = </span>
              <b className="text-gold">{money(finalC)}</b>
            </div>
            <div className="text-[11px] text-muted mb-3">
              El mes de ingreso se divide en 4 semanas y la semana de ingreso cuenta. Si entra del día 22 en adelante, ese mes no se cobra.
            </div>
            <div className="mb-3">
              <label className={label}>Motivo del cambio (obligatorio)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ej: Descuento autorizado por dirección" className={input} />
            </div>
            {error && <div className="text-sm text-red mb-2">{error}</div>}
            <div className="flex gap-2 mb-4">
              <button type="button" disabled={busy} onClick={save} className="flex-1 bg-gold text-bg rounded-xl py-2.5 text-sm font-extrabold disabled:opacity-60">
                {busy ? "Guardando..." : "Guardar cuota"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="px-4 rounded-xl border border-borderMuted text-sm font-bold text-muted">Cancelar</button>
            </div>
            <div className="text-[11px] text-muted mb-2">
              Queda sellado con tu nombre y la fecha. La cuota es solo de esta temporada; la siguiente vuelve a la estándar.
            </div>
            {history.length > 0 && (
              <div className="border-t border-border pt-3">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Historial</div>
                {history.map((h) => (
                  <div key={h.id} className="text-xs mb-1.5">
                    <b className="text-gold">{money(h.total_cents)}</b> ({money(h.monthly_cents)} × {fmtMonths(Number(h.months))}) · {h.note}
                    <div className="text-muted">{h.set_by_name} · {usDate(h.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
