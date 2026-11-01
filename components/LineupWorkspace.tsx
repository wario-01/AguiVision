"use client";

// Campograma + estadísticas del partido (solo entrenadores).
// Toca un jugador y luego otro (o una posición vacía) para cambiarlos de lugar.
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LineupSheet, { SheetPlayer } from "@/components/LineupSheet";
import { FORMATION_GROUPS, formationSlots, shortName, gameCode, cleanSubs, fieldAfter, subChain, PlannedSub } from "@/lib/lineup";

type P = SheetPlayer & { position?: string | null };
export type GameOption = { id: string; label: string; title: string; details: string; startAt: string };
export type StatRow = { minutes: number | null; goals: number | null; assists: number | null; yellow: number | null; red: number | null; saves: number | null };
export type ResultRow = { goals_for: number | null; goals_against: number | null; shots: number | null; corners: number | null; fouls: number | null; subs: number | null };

const STAT_COLS: { k: keyof StatRow; label: string }[] = [
  { k: "minutes", label: "Min." },
  { k: "goals", label: "Goles" },
  { k: "assists", label: "Asist." },
  { k: "yellow", label: "Amar." },
  { k: "red", label: "Roja" },
  { k: "saves", label: "Atajadas" },
];
const RES_FIELDS: { k: keyof ResultRow; label: string }[] = [
  { k: "shots", label: "Tiros a gol" },
  { k: "corners", label: "Tiros de esquina" },
  { k: "fouls", label: "Faltas" },
  { k: "subs", label: "Cambios" },
];

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export default function LineupWorkspace({
  teamSlug,
  teamName,
  ageCategory,
  players,
  games,
  eventId,
  initial,
  statsInit,
  resultInit,
  before,
  after,
}: {
  teamSlug: string;
  teamName: string;
  ageCategory: string;
  players: P[];
  games: GameOption[];
  eventId: string | null;
  initial: { formation: string; slots: (string | null)[]; out: string[]; subs: PlannedSub[]; notes: string };
  statsInit: Record<string, StatRow>;
  resultInit: ResultRow | null;
  before: React.ReactNode;
  after: React.ReactNode;
}) {
  const router = useRouter();
  const [formation, setFormation] = useState(initial.formation);
  const [slotIds, setSlotIds] = useState<(string | null)[]>(initial.slots);
  const [out, setOut] = useState<string[]>(initial.out);
  const [notes, setNotes] = useState(initial.notes);
  const [subsRaw, setSubsRaw] = useState<PlannedSub[]>(initial.subs);
  const [newMin, setNewMin] = useState("");
  const [newOut, setNewOut] = useState("");
  const [newIn, setNewIn] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [snap, setSnap] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const slots = useMemo(() => formationSlots(formation), [formation]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const validIds = useMemo(() => new Set(players.map((p) => p.id)), [players]);
  // Los cambios que ya no tienen sentido (el jugador ya no está en el campo, etc.) se descartan solos.
  const subs = useMemo(() => cleanSubs(subsRaw, slotIds, out, validIds), [subsRaw, slotIds, out, validIds]);
  const current = JSON.stringify({ formation, slots: slotIds, out, subs, notes });
  const dirty = current !== snap;
  const game = games.find((g) => g.id === eventId) ?? null;

  const placedIds = new Set(slotIds.filter(Boolean) as string[]);
  const bench = players
    .filter((p) => !placedIds.has(p.id) && !out.includes(p.id))
    .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999));
  const outPlayers = out.map((id) => byId.get(id)).filter(Boolean) as P[];
  const placed = slotIds.map((id) => (id ? byId.get(id) ?? null : null));

  type Loc = { t: "slot"; i: number } | { t: "bench" } | { t: "out" };
  const loc = (id: string): Loc => {
    const i = slotIds.indexOf(id);
    if (i >= 0) return { t: "slot", i };
    return out.includes(id) ? { t: "out" } : { t: "bench" };
  };

  // Mueve a `id` a `to`; si había alguien en esa posición, se va al lugar donde estaba `id`.
  function move(id: string, to: Loc, baseSlots = slotIds, baseOut = out) {
    const from = ((): Loc => {
      const i = baseSlots.indexOf(id);
      if (i >= 0) return { t: "slot", i };
      return baseOut.includes(id) ? { t: "out" } : { t: "bench" };
    })();
    const ns = baseSlots.map((v) => (v === id ? null : v));
    let no = baseOut.filter((v) => v !== id);
    if (to.t === "slot") {
      const occupant = ns[to.i];
      ns[to.i] = id;
      if (occupant && occupant !== id) {
        if (from.t === "slot") ns[from.i] = occupant;
        else if (from.t === "out") no = [...no, occupant];
      }
    } else if (to.t === "out") {
      no = [...no, id];
    }
    return { ns, no };
  }
  const apply = (r: { ns: (string | null)[]; no: string[] }) => {
    setSlotIds(r.ns);
    setOut(r.no);
    setMsg(null);
  };

  const clearSel = () => setSel(null);
  // Quién está en el campo / en la banca después del último cambio (para armar el siguiente).
  const fieldNow = useMemo(() => fieldAfter(subs, slotIds), [subs, slotIds]);
  const outOptions = slotIds.length ? players.filter((p) => fieldNow.has(p.id)) : [];
  const inOptions = players.filter((p) => !fieldNow.has(p.id) && !out.includes(p.id));
  const parseMin = (v: string): number | null => {
    const clean = v.replace(/\D/g, "").slice(0, 3);
    return clean === "" ? null : Math.min(120, Number(clean));
  };
  function addSub() {
    if (!newOut || !newIn) return;
    setSubsRaw([...subs, { out: newOut, in: newIn, minute: parseMin(newMin) }]);
    setNewMin("");
    setNewOut("");
    setNewIn("");
    setMsg(null);
  }
  function setMinute(idx: number, v: string) {
    setSubsRaw(subs.map((x, k) => (k === idx ? { ...x, minute: parseMin(v) } : x)));
    setMsg(null);
  }
  // Al quitar un cambio, los que venían después y ya no tienen sentido se descartan solos.
  function removeSub(idx: number) {
    setSubsRaw(subs.filter((_, k) => k !== idx));
    setMsg(null);
  }

  function clickPlayer(id: string) {
    if (!sel) return setSel(id);
    if (sel === id) return clearSel();
    const a = loc(sel);
    const b = loc(id);
    if (b.t === "slot") apply(move(sel, b));
    else if (a.t === "slot") apply(move(id, a));
    else if (a.t !== b.t) {
      const r1 = move(sel, b);
      apply(move(id, a, r1.ns, r1.no));
    }
    clearSel();
  }
  function clickSlot(i: number) {
    const occ = slotIds[i];
    if (sel) {
      if (occ === sel) clearSel();
      else {
        apply(move(sel, { t: "slot", i }));
        clearSel();
      }
    } else if (occ) setSel(occ);
  }
  function sendTo(t: "bench" | "out") {
    if (!sel) return;
    apply(move(sel, { t }));
    clearSel();
  }

  function changeFormation(f: string) {
    const n = formationSlots(f).length;
    // Se conservan los jugadores en el mismo orden; los que ya no caben pasan a suplentes.
    setFormation(f);
    setSlotIds(Array.from({ length: n }, (_, i) => slotIds[i] ?? null));
    clearSel();
    setMsg(null);
  }
  function autoFill() {
    const free = bench.slice();
    setSlotIds(slotIds.map((v) => v ?? free.shift()?.id ?? null));
    setMsg(null);
  }
  function clearField() {
    setSlotIds(slotIds.map(() => null));
    clearSel();
  }

  function goToGame(id: string) {
    if (dirty && !confirm("Tienes cambios sin guardar en la alineación. ¿Cambiar de partido sin guardarlos?")) return;
    router.push(id ? `/${teamSlug}/equipo/perfil?e=${id}` : `/${teamSlug}/equipo/perfil`);
  }

  async function saveLineup() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/alineacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlug, eventId, formation, slots: slotIds, out, subs, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      setSnap(current);
      setMsg({ ok: true, text: "Alineación guardada" });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? "Ocurrió un error" });
    } finally {
      setBusy(false);
    }
  }

  // ---------- estadísticas del partido ----------
  const [stats, setStats] = useState<Record<string, Record<keyof StatRow, string>>>(() => {
    const o: Record<string, Record<keyof StatRow, string>> = {};
    for (const p of players) {
      const s = statsInit[p.id];
      o[p.id] = { minutes: str(s?.minutes), goals: str(s?.goals), assists: str(s?.assists), yellow: str(s?.yellow), red: str(s?.red), saves: str(s?.saves) };
    }
    return o;
  });
  const [res, setRes] = useState<Record<keyof ResultRow, string>>({
    goals_for: str(resultInit?.goals_for),
    goals_against: str(resultInit?.goals_against),
    shots: str(resultInit?.shots),
    corners: str(resultInit?.corners),
    fouls: str(resultInit?.fouls),
    subs: str(resultInit?.subs),
  });
  const [sBusy, setSBusy] = useState(false);
  const [sMsg, setSMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const statPlayers = [...(slotIds.map((id) => (id ? byId.get(id) : null)).filter(Boolean) as P[]), ...bench, ...outPlayers.filter((p) => Object.values(stats[p.id] ?? {}).some((v) => v !== ""))];
  const goalsSum = players.reduce((s, p) => s + (Number(stats[p.id]?.goals) || 0), 0);
  const goalsFor = res.goals_for === "" ? null : Number(res.goals_for);

  async function saveStats() {
    if (!eventId) return;
    setSBusy(true);
    setSMsg(null);
    try {
      const r = await fetch("/api/estadisticas-juego", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          result: res,
          players: players.map((p) => ({ playerId: p.id, ...stats[p.id] })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "No se pudo guardar");
      setSMsg({ ok: true, text: "Estadísticas guardadas" });
      router.refresh();
    } catch (e: any) {
      setSMsg({ ok: false, text: e.message ?? "Ocurrió un error" });
    } finally {
      setSBusy(false);
    }
  }

  const chip = (p: P, extra = "", note: string | null = null) => (
    <button
      key={p.id}
      type="button"
      onClick={() => clickPlayer(p.id)}
      className={`flex items-center gap-2 w-full text-left rounded-lg border px-2 py-1.5 text-xs font-bold ${
        sel === p.id ? "bg-gold text-bg border-gold" : "bg-bg border-border"
      } ${extra}`}
    >
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${sel === p.id ? "bg-bg text-gold" : "bg-panel2 text-gold"}`}>
        {p.jersey_number ?? "–"}
      </span>
      <span className="truncate">{p.full_name}</span>
      {note ? (
        <span className={`ml-auto text-[10px] font-extrabold shrink-0 ${sel === p.id ? "text-bg" : "text-ok"}`}>{note}</span>
      ) : (
        p.position && <span className={`ml-auto text-[10px] ${sel === p.id ? "text-bg" : "text-muted"}`}>{p.position}</span>
      )}
    </button>
  );
  const inp = "w-14 box-border bg-bg border border-border rounded-md px-1.5 py-1 text-xs font-bold text-center";

  return (
    <>
      <div className="screen-only flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11">
        <div className="max-w-5xl">
          {before}

          {/* ---------- Campograma ---------- */}
          <div className="bg-panel border border-border rounded-2xl p-5 mb-8">
            <div className="font-display text-lg font-semibold mb-3">Alineación · campograma</div>
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <select
                value={eventId ?? ""}
                onChange={(e) => goToGame(e.target.value)}
                className="bg-bg border border-border rounded-lg px-3 py-2 text-xs font-bold max-w-full"
              >
                <option value="">Sin partido (borrador)</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <select
                value={formation}
                onChange={(e) => changeFormation(e.target.value)}
                className="bg-bg border border-border rounded-lg px-3 py-2 text-xs font-bold"
              >
                {FORMATION_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button type="button" onClick={autoFill} className="bg-bg border border-border rounded-lg px-3 py-2 text-xs font-bold">
                Llenar con la banca
              </button>
              <button type="button" onClick={clearField} className="bg-bg border border-border rounded-lg px-3 py-2 text-xs font-bold text-muted">
                Vaciar campo
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_260px]">
              <div
                className="relative rounded-xl border-[3px] border-white/30 overflow-hidden w-full"
                style={{ background: "linear-gradient(#2E8B4A,#277a40)", aspectRatio: "10 / 12.5" }}
              >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                  <g fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" vectorEffect="non-scaling-stroke">
                    <rect x="2" y="2" width="96" height="96" vectorEffect="non-scaling-stroke" />
                    <line x1="2" y1="50" x2="98" y2="50" vectorEffect="non-scaling-stroke" />
                    <ellipse cx="50" cy="50" rx="9" ry="11" vectorEffect="non-scaling-stroke" />
                    <rect x="25" y="2" width="50" height="16" vectorEffect="non-scaling-stroke" />
                    <rect x="38" y="2" width="24" height="6" vectorEffect="non-scaling-stroke" />
                    <rect x="25" y="82" width="50" height="16" vectorEffect="non-scaling-stroke" />
                    <rect x="38" y="92" width="24" height="6" vectorEffect="non-scaling-stroke" />
                  </g>
                </svg>
                {slots.map((s, i) => {
                  const p = placed[i];
                  const isSel = !!p && sel === p.id;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => clickSlot(i)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 text-center w-[22%] max-w-[110px]"
                      style={{ left: `${s.x}%`, top: `${s.y}%` }}
                    >
                      <span
                        className={`mx-auto flex w-9 h-9 md:w-11 md:h-11 rounded-full items-center justify-center text-sm font-black border-[3px] ${
                          p
                            ? i === 0
                              ? "bg-red text-white border-white"
                              : "bg-gold text-bg border-white"
                            : "border-dashed border-white/70 text-white/80 text-[10px] bg-black/10"
                        } ${isSel ? "ring-4 ring-white scale-110" : ""}`}
                      >
                        {p ? p.jersey_number ?? "–" : s.role}
                      </span>
                      {p && (
                        <span className="block mt-0.5 text-[10px] md:text-[11px] font-extrabold bg-black/55 rounded px-1 truncate">
                          {shortName(p.full_name)}
                        </span>
                      )}
                      {p && subChain(subs, p.id).length > 0 && byId.get(subChain(subs, p.id)[0].in) && (
                        <span className="inline-flex items-center gap-1 mt-0.5 bg-white text-bg rounded-full pl-1 pr-2 py-px text-[9px] md:text-[10px] font-black shadow">
                          <b className="w-3.5 h-3.5 rounded-full bg-ok flex items-center justify-center text-[8px]">↑</b>
                          {shortName(byId.get(subChain(subs, p.id)[0].in)!.full_name)}
                          {subChain(subs, p.id)[0].minute != null ? ` · ${subChain(subs, p.id)[0].minute}'` : ""}
                          {subChain(subs, p.id).length > 1 && <span className="text-red"> +{subChain(subs, p.id).length - 1}</span>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div>
                {sel && byId.get(sel) && (
                  <div className="bg-goldBgDim border border-goldBorderDim rounded-xl p-3 mb-3">
                    <div className="text-xs font-bold text-goldText mb-2">
                      {`${byId.get(sel)!.full_name}: toca otro jugador o una posición para cambiarlos.`}
                    </div>
                    <div className="flex gap-2 flex-wrap">

                      <button type="button" onClick={() => sendTo("bench")} className="bg-bg border border-border rounded-md px-2.5 py-1 text-[11px] font-bold">
                        A suplentes
                      </button>
                      <button type="button" onClick={() => sendTo("out")} className="bg-bg border border-border rounded-md px-2.5 py-1 text-[11px] font-bold">
                        No convocado
                      </button>
                      <button type="button" onClick={clearSel} className="text-[11px] font-bold text-muted px-2">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                <div className="text-[11px] font-extrabold text-gold tracking-widest mb-2">SUPLENTES ({bench.length})</div>
                <div className="flex flex-col gap-1.5 mb-4">
                  {bench.length === 0 && <div className="text-xs text-muted">Sin suplentes.</div>}
                  {bench.map((p) => {
                    const mine = subs.filter((x) => x.in === p.id);
                    const who = mine[0] ? byId.get(mine[0].out) : null;
                    const note = mine.length === 0 || !who ? null : mine.length > 1 ? `Entra ${mine.length} veces` : `Entra por ${shortName(who.full_name).split(" ")[0]}${mine[0].minute != null ? ` · ${mine[0].minute}'` : ""}`;
                    return chip(p, "", note);
                  })}
                </div>
                <div className="text-[11px] font-extrabold text-gold tracking-widest mb-2">NO CONVOCADOS ({outPlayers.length})</div>
                <div className="flex flex-col gap-1.5">
                  {outPlayers.length === 0 && <div className="text-xs text-muted">Nadie.</div>}
                  {outPlayers.map((p) => chip(p, "opacity-80"))}
                </div>
                <div className="text-[11px] font-extrabold text-gold tracking-widest mt-4 mb-1">CAMBIOS ({subs.length})</div>
                <div className="text-[10px] text-muted mb-2">Sin límite: un jugador puede salir y volver a entrar.</div>
                <div className="flex flex-col gap-1.5">
                  {subs.map((x, k) => (
                    <div key={k} className="grid grid-cols-[52px_1fr_1fr_22px] gap-1.5 items-center bg-bg border border-border rounded-lg px-2 py-1.5 text-[11px] font-bold">
                      <input
                        inputMode="numeric"
                        value={x.minute ?? ""}
                        onChange={(e) => setMinute(k, e.target.value)}
                        placeholder="min"
                        aria-label="Minuto del cambio (opcional)"
                        className="w-full box-border bg-panel2 rounded-md text-center py-1 font-black"
                      />
                      <span className="text-[#ff9b93] truncate">↓ {shortName(byId.get(x.out)?.full_name ?? "?")}</span>
                      <span className="text-ok truncate">↑ {shortName(byId.get(x.in)?.full_name ?? "?")}</span>
                      <button type="button" onClick={() => removeSub(k)} className="text-muted" aria-label="Quitar cambio">
                        ✕
                      </button>
                    </div>
                  ))}
                  {slotIds.some(Boolean) ? (
                    <div className="bg-panel2 border border-dashed border-border rounded-xl p-2.5 mt-1">
                      <div className="text-[10px] font-extrabold text-gold tracking-widest mb-1.5">AGREGAR CAMBIO</div>
                      <div className="grid grid-cols-[52px_1fr_1fr] gap-1.5 mb-2">
                        <input
                          inputMode="numeric"
                          value={newMin}
                          onChange={(e) => setNewMin(e.target.value)}
                          placeholder="min"
                          aria-label="Minuto (opcional)"
                          className="w-full box-border bg-bg border border-border rounded-md text-center py-1 text-[11px] font-black"
                        />
                        <select value={newOut} onChange={(e) => setNewOut(e.target.value)} className="min-w-0 bg-bg border border-border rounded-md px-1 py-1 text-[11px] font-bold text-[#ff9b93]">
                          <option value="">↓ Sale</option>
                          {outOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.jersey_number != null ? `${p.jersey_number} ` : ""}
                              {shortName(p.full_name)}
                            </option>
                          ))}
                        </select>
                        <select value={newIn} onChange={(e) => setNewIn(e.target.value)} className="min-w-0 bg-bg border border-border rounded-md px-1 py-1 text-[11px] font-bold text-ok">
                          <option value="">↑ Entra</option>
                          {inOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.jersey_number != null ? `${p.jersey_number} ` : ""}
                              {shortName(p.full_name)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={addSub}
                        disabled={!newOut || !newIn}
                        className="bg-gold text-bg rounded-md px-3 py-1 text-[11px] font-extrabold disabled:opacity-40"
                      >
                        + Agregar
                      </button>
                      <div className="text-[10px] text-muted mt-2">
                        El minuto es opcional. “Sale” muestra quién está en el campo y “Entra” quién está en la banca después del último cambio.
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted">Primero pon a los titulares en el campo.</div>
                  )}
                </div>
              </div>
            </div>

            <label className="block text-xs font-bold text-muted mt-4 mb-1.5">Notas del entrenador (salen en la hoja impresa)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold resize-none"
            />

            <div className="flex items-center gap-3 flex-wrap mt-4">
              <button
                type="button"
                onClick={saveLineup}
                disabled={busy || !dirty}
                className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-50"
              >
                {busy ? "Guardando..." : "Guardar alineación"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-bg border border-border rounded-lg px-5 py-2.5 text-sm font-bold"
              >
                Imprimir hoja
              </button>
              {dirty && <span className="text-xs text-goldText font-bold">Cambios sin guardar</span>}
              {msg && <span className={`text-xs font-bold ${msg.ok ? "text-ok" : "text-red"}`}>{msg.text}</span>}
            </div>
          </div>

          {/* ---------- Estadísticas del partido ---------- */}
          <div className="bg-panel border border-border rounded-2xl p-5 mb-8">
            <div className="font-display text-lg font-semibold mb-1">Estadísticas del partido</div>
            {!eventId ? (
              <div className="text-sm text-muted">Elige un partido arriba para capturar sus estadísticas después del juego.</div>
            ) : (
              <>
                <div className="text-xs text-muted mb-4">{game?.title} · {game?.details}. Anota lo que quieras; los cuadros vacíos no cuentan.</div>
                <div className="flex flex-wrap items-end gap-3 mb-5">
                  <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2">
                    <span className="text-xs font-bold">{teamName}</span>
                    <input inputMode="numeric" value={res.goals_for} onChange={(e) => setRes({ ...res, goals_for: e.target.value })} className={inp} />
                    <span className="font-bold">—</span>
                    <input inputMode="numeric" value={res.goals_against} onChange={(e) => setRes({ ...res, goals_against: e.target.value })} className={inp} />
                    <span className="text-xs font-bold">Rival</span>
                  </div>
                  {RES_FIELDS.map((f) => (
                    <label key={f.k} className="text-[11px] font-bold text-muted">
                      {f.label}
                      <input inputMode="numeric" value={res[f.k]} onChange={(e) => setRes({ ...res, [f.k]: e.target.value })} className={`${inp} block mt-1`} />
                    </label>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[560px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-muted text-left">
                        <th className="py-1.5 pr-2">Jugador</th>
                        {STAT_COLS.map((c) => (
                          <th key={c.k} className="py-1.5 px-1 text-center">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statPlayers.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="py-1.5 pr-2 font-bold whitespace-nowrap">
                            <span className="text-gold">{p.jersey_number != null ? `#${p.jersey_number} ` : ""}</span>
                            {p.full_name}
                          </td>
                          {STAT_COLS.map((c) => (
                            <td key={c.k} className="py-1 px-1 text-center">
                              <input
                                inputMode="numeric"
                                value={stats[p.id]?.[c.k] ?? ""}
                                onChange={(e) => setStats({ ...stats, [p.id]: { ...stats[p.id], [c.k]: e.target.value } })}
                                className={inp}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {goalsFor !== null && goalsSum !== goalsFor && (
                  <div className="text-xs text-goldText font-bold mt-3">
                    Ojo: el marcador dice {goalsFor} gol{goalsFor === 1 ? "" : "es"} pero los goles de los jugadores suman {goalsSum} (pueden ser autogoles o goles sin anotar).
                  </div>
                )}
                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={saveStats}
                    disabled={sBusy}
                    className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold disabled:opacity-50"
                  >
                    {sBusy ? "Guardando..." : "Guardar estadísticas"}
                  </button>
                  {sMsg && <span className={`text-xs font-bold ${sMsg.ok ? "text-ok" : "text-red"}`}>{sMsg.text}</span>}
                </div>
              </>
            )}
          </div>

          {after}
        </div>
      </div>

      <LineupSheet
        teamName={teamName}
        formation={formation}
        slots={slots}
        placed={placed}
        bench={bench}
        out={outPlayers}
        game={game ? { title: game.title, details: game.details } : null}
        code={gameCode(ageCategory, game?.startAt ?? null)}
        notes={notes}
        subs={subs
          .map((x) => ({ minute: x.minute, out: byId.get(x.out), inn: byId.get(x.in) }))
          .filter((x): x is { minute: number | null; out: P; inn: P } => !!x.out && !!x.inn)}
      />
    </>
  );
}
