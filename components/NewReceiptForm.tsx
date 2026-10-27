"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { REASONS, METHODS, money, seasonOf, ANNUAL_FEE_CENTS, MONTHLY_FEE_CENTS } from "@/lib/finance-shared";

type TeamOpt = { id: string; name: string };
type PlayerOpt = { id: string; team_id: string; full_name: string };

const OTHER = "__other__";

export default function NewReceiptForm({
  teams,
  players,
  issuerName,
  today,
}: {
  teams: TeamOpt[];
  players: PlayerOpt[];
  issuerName: string; // quien inició sesión: sale como "Recibo generado por"
  today: string;
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [playerId, setPlayerId] = useState("");
  const [otherName, setOtherName] = useState("");
  const [reason, setReason] = useState<keyof typeof REASONS>("anualidad");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<keyof typeof METHODS>("cash");
  const [date, setDate] = useState(today);
  const [exempt, setExempt] = useState(false);
  const [previous, setPrevious] = useState(0);
  const [lastTotal, setLastTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const teamPlayers = useMemo(() => players.filter((p) => p.team_id === teamId), [players, teamId]);
  const isOther = playerId === OTHER;
  const playerName = isOther ? otherName.trim() : teamPlayers.find((p) => p.id === playerId)?.full_name ?? "";
  const teamName = teams.find((t) => t.id === teamId)?.name ?? "";
  const tracksBalance = reason === "anualidad" || reason === "membresia";

  // Cuánto lleva pagado esa persona en la temporada (solo anualidad/membresía).
  useEffect(() => {
    setPrevious(0);
    setLastTotal(null);
    setExempt(false);
    if (!playerName) return;
    const qs = new URLSearchParams({ reason, date, teamName, playerName });
    if (playerId && !isOther) qs.set("playerId", playerId);
    let cancelled = false;
    fetch(`/api/recibos/previo?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setExempt(d.exempt === true);
        setPrevious(d.previousCents ?? 0);
        if (d.lastTotalCents != null) {
          setLastTotal(d.lastTotalCents);
          setTotal((t) => (t === "" ? String(d.lastTotalCents / 100) : t));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reason, playerId, playerName, date, teamName, isOther]);

  // Anualidad: el total sugerido es $1,320 y se puede elegir cuántos meses ($110 c/u) paga.
  useEffect(() => {
    if (reason === "anualidad") setTotal((t) => (t === "" ? String(ANNUAL_FEE_CENTS / 100) : t));
  }, [reason]);
  function setMonths(n: number) {
    setAmount(String((n * MONTHLY_FEE_CENTS) / 100));
  }

  const amountC = Math.round((Number(amount.replace(/[$,\s]/g, "")) || 0) * 100);
  const totalC = total === "" ? amountC : Math.round((Number(total.replace(/[$,\s]/g, "")) || 0) * 100);
  const balanceC = Math.max(0, totalC - (tracksBalance ? previous : 0) - amountC);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!playerName) return setError("Elige al jugador (o escribe el nombre).");
    if (!amountC) return setError("Escribe el monto que se está pagando.");
    setBusy(true);
    try {
      const res = await fetch("/api/recibos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          playerId: playerId && !isOther ? playerId : undefined,
          playerName,
          reason,
          description,
          total,
          amount,
          method,
          date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      router.push(`/recibos/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  const input = "w-full box-border bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm font-semibold";
  const label = "block text-xs font-bold text-muted mb-1.5";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Equipo</label>
          <select value={teamId} onChange={(e) => { setTeamId(e.target.value); setPlayerId(""); }} className={input}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Jugador</label>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className={input}>
            <option value="">— Elige —</option>
            {teamPlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            <option value={OTHER}>Otro (escribir nombre)</option>
          </select>
        </div>
      </div>
      {isOther && (
        <input value={otherName} onChange={(e) => setOtherName(e.target.value)} maxLength={100} placeholder="Nombre completo" className={input} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Motivo del recibo</label>
          <select value={reason} onChange={(e) => setReason(e.target.value as any)} className={input}>
            {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          <div className="text-[11px] text-muted mt-1">Temporada {seasonOf(date)}</div>
        </div>
      </div>

      <div>
        <label className={label}>Descripción {reason === "otro" ? "(obligatoria)" : "(opcional)"}</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder={reason === "torneos" ? "Ej: Torneo de otoño" : "Ej: Segundo pago"} className={input} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Total a pagar (USD) {tracksBalance ? "" : "(opcional)"}</label>
          <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={tracksBalance ? "Ej: 600" : "Igual al monto"} className={input} />
          {tracksBalance && lastTotal != null && (
            <div className="text-[11px] text-muted mt-1">Tomado del último recibo de esta temporada.</div>
          )}
        </div>
        <div>
          <label className={label}>Monto que paga ahora (USD)</label>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ej: 110" className={input} />
          {reason === "anualidad" && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-muted">Meses ($110 c/u):</span>
              {[1, 2, 3, 4, 6, 12].map((n) => (
                <button type="button" key={n} onClick={() => setMonths(n)} className="text-[11px] font-bold rounded-full px-2.5 py-1 border border-borderMuted text-muted hover:text-text">
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {exempt && (
        <div className="bg-goldBgDim border border-goldBorderDim rounded-xl px-4 py-3 text-sm text-goldText">
          Este jugador está marcado como <b>exento</b> de este pago en la temporada. Si de todos modos va a pagar algo, puedes generar el recibo.
        </div>
      )}
      <div className="bg-panel border border-border rounded-xl px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
        {tracksBalance && <span className="text-muted">Pagado antes: <b className="text-text">{money(previous)}</b></span>}
        <span className="text-muted">Saldo después de este pago: <b className="text-gold">{money(balanceC)}</b></span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Método de pago</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as any)} className={input}>
            {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Recibo generado por</label>
          <div className={`${input} text-muted`}>{issuerName}</div>
        </div>
      </div>

      {error && <div className="text-sm text-red">{error}</div>}
      <button disabled={busy} className="w-full bg-gold text-bg rounded-xl py-3.5 text-sm font-extrabold disabled:opacity-60">
        {busy ? "Guardando..." : "Generar recibo"}
      </button>
    </form>
  );
}
