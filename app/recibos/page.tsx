// Reportes de recibos: una pestaña por motivo (Anualidad, Torneos, Arbitraje,
// Membresía, Otro) con lo pagado a la fecha por jugador, más el historial.

import Link from "next/link";
import { redirect } from "next/navigation";
import RecibosShell from "@/components/RecibosShell";
import PrintButton from "@/components/PrintButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess, ANNUAL_FEE_CENTS, REASONS, REASON_KEYS, METHODS, money, receiptNo, seasonOf, seasonOptions, Receipt } from "@/lib/finance";
import { clubParts } from "@/lib/tz";

const usDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-");
  return `${m}/${d}/${y}`;
};

export default async function RecibosPage({
  searchParams,
}: {
  searchParams: { tab?: string; season?: string; team?: string };
}) {
  const access = await getFinanceAccess();
  if (!access) redirect("/");

  const seasons = seasonOptions();
  const currentSeason = seasonOf(clubParts(new Date()).ymd);
  const season = seasons.includes(searchParams.season ?? "") ? (searchParams.season as string) : currentSeason;
  const tab = searchParams.tab === "historial" || REASON_KEYS.includes(searchParams.tab as any) ? (searchParams.tab as string) : "anualidad";
  const teamFilter = searchParams.team ?? "";

  const admin = createAdminClient()!;
  const { data } = await admin
    .from("receipts")
    .select("*")
    .eq("season", season)
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  const all = (data ?? []) as Receipt[];
  const valid = all.filter((r) => !r.voided);

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ tab, season, ...(teamFilter ? { team: teamFilter } : {}), ...over });
    if (!p.get("team")) p.delete("team");
    return `/recibos?${p}`;
  };
  const pill = (on: boolean) =>
    `text-xs font-bold rounded-full px-3 py-1.5 border whitespace-nowrap ${on ? "bg-panel border-border text-text" : "border-borderMuted text-muted"}`;

  // ---------- resumen por motivo (arriba de todo) ----------
  const paidBy = (reason: string) => valid.filter((r) => r.reason === reason).reduce((n, r) => n + r.amount_cents, 0);

  // ---------- cuerpo ----------
  let body: React.ReactNode;
  if (tab === "historial") {
    body = (
      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        {all.map((r, i) => (
          <Link
            key={r.id}
            href={r.legacy ? "/recibos?tab=historial" : `/recibos/${r.id}`}
            className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 hover:bg-panel2 ${i < all.length - 1 ? "border-b border-border" : ""}`}
          >
            <div className="min-w-0">
              <div className={`text-sm font-bold truncate ${r.voided ? "line-through text-muted" : ""}`}>
                {r.legacy ? "Pago previo" : `#${receiptNo(r.number)}`} · {r.player_name}
              </div>
              <div className="text-xs text-muted truncate">
                {usDate(r.receipt_date)} · {r.team_name} · {REASONS[r.reason]}
                {r.description ? ` · ${r.description}` : ""}{r.method ? ` · ${METHODS[r.method]}` : ""} · {r.issued_by_name}
              </div>
            </div>
            <div className="text-sm font-extrabold text-gold">
              {r.voided ? <span className="text-red">Anulado</span> : money(r.amount_cents)}
            </div>
          </Link>
        ))}
        {all.length === 0 && <div className="px-5 py-4 text-sm text-muted">Todavía no hay recibos en esta temporada.</div>}
      </div>
    );
  } else {
    const rows = valid.filter((r) => r.reason === tab);
    const shown = teamFilter ? rows.filter((r) => r.team_name === teamFilter) : rows;
    const tracksBalance = tab === "anualidad" || tab === "membresia";

    // Exentos de la anualidad en esta temporada (por ejemplo, hijos de entrenadores).
    const { data: exData } = tab !== "anualidad" ? { data: [] as any[] } : await admin
      .from("finance_exemptions")
      .select("player_id, note")
      .eq("reason", tab)
      .eq("season", season);
    const exempt = new Map<string, string>((exData ?? []).map((e: any) => [e.player_id, e.note ?? ""] as [string, string]));

    type G = { key: string; team: string; player: string; playerId: string | null; paid: number; count: number; lastTotal: number; items: Receipt[] };
    const groups = new Map<string, G>();
    // `shown` viene del más nuevo al más viejo: el primero de cada jugador es su último recibo.
    for (const r of shown) {
      const key = `${r.team_name}|${r.player_id ?? r.player_name.toLowerCase()}`;
      let g = groups.get(key);
      if (!g) {
        g = { key, team: r.team_name, player: r.player_name, playerId: r.player_id, paid: 0, count: 0, lastTotal: r.total_cents, items: [] };
        groups.set(key, g);
      }
      g.paid += r.amount_cents;
      g.count += 1;
      g.items.push(r);
    }
    // En Anualidad se muestra TODA la plantilla (también quien aún no ha pagado y los exentos),
    // para ver de un vistazo quién debe.
    if (tab === "anualidad") {
      const [{ data: teamRows }, { data: playerRows }] = await Promise.all([
        admin.from("teams").select("id, name, active"),
        admin.from("players").select("id, team_id, full_name"),
      ]);
      const teamName = new Map<string, string>((teamRows ?? []).filter((t: any) => t.active !== false).map((t: any) => [t.id, t.name] as [string, string]));
      for (const p of (playerRows ?? []) as any[]) {
        const tn = teamName.get(p.team_id);
        if (!tn || (teamFilter && tn !== teamFilter)) continue;
        const key = `${tn}|${p.id}`;
        if (!groups.has(key)) {
          groups.set(key, { key, team: tn, player: p.full_name, playerId: p.id, paid: 0, count: 0, lastTotal: ANNUAL_FEE_CENTS, items: [] });
        }
      }
    }
    const teams = Array.from(new Set(Array.from(groups.values()).map((g) => g.team))).sort();
    const list = Array.from(groups.values()).sort((a, b) => a.team.localeCompare(b.team) || a.player.localeCompare(b.player));
    const totalPaid = list.reduce((n, g) => n + g.paid, 0);
    // Saldo = total de su último recibo menos todo lo pagado (incluye pagos previos).
    const isExempt = (g: G) => !!g.playerId && exempt.has(g.playerId);
    const pendingOf = (g: G) => (isExempt(g) ? 0 : Math.max(0, g.lastTotal - g.paid));
    const exemptCount = list.filter(isExempt).length;
    const totalPending = list.reduce((n, g) => n + pendingOf(g), 0);
    let lastTeam = "";

    body = (
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Pagado a la fecha</div>
            <div className="font-display text-2xl font-bold text-gold">{money(totalPaid)}</div>
          </div>
          {tracksBalance && (
            <div className="bg-panel border border-border rounded-xl p-4">
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Saldo pendiente</div>
              <div className="font-display text-2xl font-bold">{money(totalPending)}</div>
            </div>
          )}
          {exemptCount > 0 && (
            <div className="bg-panel border border-border rounded-xl p-4">
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Exentos</div>
              <div className="font-display text-2xl font-bold">{exemptCount}</div>
            </div>
          )}
          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Recibos</div>
            <div className="font-display text-2xl font-bold">{shown.length}</div>
          </div>
        </div>

        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
          {list.map((g, i) => {
            const header = g.team !== lastTeam;
            lastTeam = g.team;
            return (
              <div key={g.key}>
                {header && (
                  <div className="px-5 py-2 bg-panel2 text-xs font-extrabold tracking-wider uppercase text-gold">{g.team}</div>
                )}
                <div className={`px-5 py-3 ${i < list.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-bold">{g.player}</div>
                    <div className="flex items-baseline gap-4 shrink-0">
                      {isExempt(g) && (
                        <span className="text-[11px] font-extrabold rounded-full px-2.5 py-1 border border-goldBorderDim text-goldText bg-goldBgDim">
                          Exento{exempt.get(g.playerId as string) ? ` · ${exempt.get(g.playerId as string)}` : ""}
                        </span>
                      )}
                      {tracksBalance && !isExempt(g) && (
                        <span className="text-xs text-muted">
                          de {money(g.lastTotal)} · saldo <b className={pendingOf(g) > 0 ? "text-amberText" : "text-goldText"}>{money(pendingOf(g))}</b>
                        </span>
                      )}
                      <span className="text-sm font-extrabold text-gold">{money(g.paid)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-3">
                    {g.items.map((r) =>
                      r.legacy ? (
                        <span key={r.id}>
                          Pago previo{r.legacy_ref ? ` (recibo ${r.legacy_ref})` : ""} · {money(r.amount_cents)}
                        </span>
                      ) : (
                        <Link key={r.id} href={`/recibos/${r.id}`} className="hover:text-text">
                          #{receiptNo(r.number)} · {usDate(r.receipt_date)} · {money(r.amount_cents)}
                          {r.description ? ` · ${r.description}` : ""}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <div className="px-5 py-4 text-sm text-muted">Todavía no hay recibos de {REASONS[tab as keyof typeof REASONS]} en esta temporada.</div>}
        </div>
        {teams.length > 1 && (
          <div className="no-print flex gap-1.5 flex-wrap mt-5">
            <Link href={qs({ team: "" })} className={pill(!teamFilter)}>Todos los equipos</Link>
            {teams.map((t) => (
              <Link key={t} href={qs({ team: t })} className={pill(teamFilter === t)}>{t}</Link>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <RecibosShell access={access} active="reportes" wide>
      <div className="print-only mb-4" style={{ borderBottom: "2px solid #14284B", paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="" style={{ width: 52, height: 52, borderRadius: "50%" }} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#14284B" }}>NIDO AGUILA USA AUSTIN</div>
            <div style={{ fontSize: 12 }}>
              Reporte de pagos · {tab === "historial" ? "Historial de recibos" : REASONS[tab as keyof typeof REASONS]} · Temporada {season}
              {teamFilter ? ` · ${teamFilter}` : ""} · Generado el {usDate(clubParts(new Date()).ymd)}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="font-display text-2xl font-bold">
          {tab === "historial" ? "Historial de recibos" : `Recibos · ${REASONS[tab as keyof typeof REASONS]}`}
        </div>
        <PrintButton />
      </div>
      <div className="text-sm text-muted mb-5">Temporada {season}</div>

      <div className="no-print flex flex-col gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {seasons.map((s) => (
            <Link key={s} href={qs({ season: s })} className={pill(s === season)}>{s}</Link>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {REASON_KEYS.map((k) => (
            <Link key={k} href={qs({ tab: k, team: "" })} className={pill(tab === k)}>
              {REASONS[k]} · {money(paidBy(k))}
            </Link>
          ))}
          <Link href={qs({ tab: "historial", team: "" })} className={pill(tab === "historial")}>Historial</Link>
        </div>
        <div className="text-xs font-bold flex flex-wrap gap-x-5 gap-y-1">
          {tab !== "historial" && (
            <a href={`/api/recibos/export?season=${season}&reason=${tab}&resumen=1${teamFilter ? `&team=${encodeURIComponent(teamFilter)}` : ""}`} className="text-gold hover:underline">
              Descargar resumen por jugador (Excel)
            </a>
          )}
          <a href={`/api/recibos/export?season=${season}`} className="text-gold hover:underline">
            Descargar todos los recibos de la temporada (Excel)
          </a>
        </div>
      </div>

      {body}
    </RecibosShell>
  );
}
