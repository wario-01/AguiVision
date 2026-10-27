"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MONTHLY_FEE_CENTS, money } from "@/lib/finance-shared";

type Player = { id: string; full_name: string };
type Existing = Record<string, { amount: number; ref: string; app?: number }>;

export default function BackfillForm({
  teamId,
  reason,
  season,
  today,
  players,
  existing,
  exempt,
}: {
  teamId: string;
  reason: string;
  season: string;
  today: string;
  players: Player[];
  existing: Existing;
  exempt: Record<string, string>;
}) {
  const router = useRouter();
  const monthly = MONTHLY_FEE_CENTS / 100;
  const [date, setDate] = useState(today);
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(players.map((p) => [p.id, existing[p.id]?.amount ? String(existing[p.id].amount / 100) : ""]))
  );
  const [refs, setRefs] = useState<Record<string, string>>(
    Object.fromEntries(players.map((p) => [p.id, existing[p.id]?.ref ?? ""]))
  );
  const [exemptOn, setExemptOn] = useState<Record<string, boolean>>(
    Object.fromEntries(players.map((p) => [p.id, p.id in exempt]))
  );
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(players.map((p) => [p.id, exempt[p.id] ?? ""]))
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function setMonths(id: string, n: number) {
    setAmounts((a) => ({ ...a, [id]: n > 0 ? String(n * monthly) : "" }));
  }

  async function save() {
    setBusy(true);
    setMessage("");
    const rows = players.map((p) => ({ playerId: p.id, amount: amounts[p.id] || "0", ref: refs[p.id], exempt: exemptOn[p.id], note: notes[p.id] }));
    const res = await fetch("/api/recibos/anteriores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, reason, season, date, rows }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage(data.error ?? "No se pudo guardar");
    setMessage("Guardado. Ya cuenta en los reportes.");
    router.refresh();
  }

  const input = "box-border bg-bg border border-border rounded-lg px-2.5 py-2 text-sm font-semibold";
  const total = players.reduce((n, p) => n + Math.round((Number((amounts[p.id] || "0").replace(/[$,\s]/g, "")) || 0) * 100), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-xs font-bold text-muted">Fecha del último pago registrado</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
      </div>
      <div className="bg-panel border border-border rounded-2xl overflow-hidden mb-4">
        {players.map((p, i) => (
          <div key={p.id} className={`px-4 py-3 ${i < players.length - 1 ? "border-b border-border" : ""}`}>
            <div className="text-sm font-bold mb-2">{p.full_name}</div>
            <div className="flex flex-wrap items-center gap-2">
              {reason === "anualidad" && (
                <select
                  value=""
                  onChange={(e) => setMonths(p.id, Number(e.target.value))}
                  className={input}
                  aria-label="Meses pagados"
                >
                  <option value="">Meses…</option>
                  {Array.from({ length: 13 }, (_, n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "mes" : "meses"} (${n * monthly})</option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted">$</span>
                <input
                  inputMode="decimal"
                  value={amounts[p.id]}
                  onChange={(e) => setAmounts((a) => ({ ...a, [p.id]: e.target.value }))}
                  placeholder="Pagado a la fecha"
                  className={`${input} w-36`}
                />
              </div>
              <input
                value={refs[p.id]}
                onChange={(e) => setRefs((r) => ({ ...r, [p.id]: e.target.value }))}
                placeholder="# recibo de papel (opc.)"
                maxLength={40}
                className={`${input} w-44`}
              />
              {reason === "anualidad" && (
              <label className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <input
                  type="checkbox"
                  checked={!!exemptOn[p.id]}
                  onChange={(e) => setExemptOn((x) => ({ ...x, [p.id]: e.target.checked }))}
                />
                Exento
              </label>
              )}
              {reason === "anualidad" && exemptOn[p.id] && (
                <input
                  value={notes[p.id]}
                  onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                  placeholder="Motivo (ej: hijo de entrenador)"
                  maxLength={100}
                  className={`${input} w-56`}
                />
              )}
              {existing[p.id]?.app ? (
                <span className="text-[11px] text-muted">Además ya tiene {money(existing[p.id].app as number)} en recibos de la app</span>
              ) : null}
            </div>
          </div>
        ))}
        {players.length === 0 && <div className="px-4 py-4 text-sm text-muted">Este equipo todavía no tiene jugadores.</div>}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button onClick={save} disabled={busy || players.length === 0} className="bg-gold text-bg rounded-xl px-6 py-3 text-sm font-extrabold disabled:opacity-60">
          {busy ? "Guardando..." : "Guardar pagos anteriores"}
        </button>
        <span className="text-xs text-muted">Total anotado en esta lista: <b className="text-gold">{money(total)}</b></span>
        {message && <span className="text-sm text-muted">{message}</span>}
      </div>
    </div>
  );
}
