import Link from "next/link";
import { redirect } from "next/navigation";
import RecibosShell from "@/components/RecibosShell";
import BackfillForm from "@/components/BackfillForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess, REASON_KEYS, REASONS, seasonOf, seasonOptions } from "@/lib/finance";
import { clubParts } from "@/lib/tz";

export default async function PagosAnteriores({
  searchParams,
}: {
  searchParams: { team?: string; reason?: string; season?: string };
}) {
  const access = await getFinanceAccess();
  if (!access) redirect("/");
  if (!(access.canIssue || access.level === "owner")) redirect("/recibos");
  const admin = createAdminClient()!;

  const today = clubParts(new Date()).ymd;
  const seasons = seasonOptions();
  const season = seasons.includes(searchParams.season ?? "") ? (searchParams.season as string) : seasonOf(today);
  const reason = REASON_KEYS.includes(searchParams.reason as any) ? (searchParams.reason as string) : "anualidad";

  const { data: teams } = await admin.from("teams").select("id, name, active").order("name");
  const activeTeams = (teams ?? []).filter((t: any) => t.active !== false);
  const team = activeTeams.find((t: any) => t.id === searchParams.team) ?? activeTeams[0];

  let players: { id: string; full_name: string }[] = [];
  const existing: Record<string, { amount: number; ref: string }> = {};
  const exempt: Record<string, string> = {}; // playerId → nota
  if (team) {
    const { data: ps } = await admin.from("players").select("id, full_name").eq("team_id", team.id).order("full_name");
    players = (ps ?? []) as any;
    // Lo que ya está registrado (pagos previos y recibos de la app) para mostrarlo.
    const { data: rs } = await admin
      .from("receipts")
      .select("player_id, amount_cents, legacy, legacy_ref")
      .eq("team_id", team.id)
      .eq("reason", reason)
      .eq("season", season)
      .eq("voided", false);
    const { data: exs } = reason !== "anualidad" ? { data: [] } : await admin
      .from("finance_exemptions")
      .select("player_id, note")
      .eq("reason", reason)
      .eq("season", season)
      .in("player_id", players.map((p) => p.id));
    for (const e of (exs ?? []) as any[]) exempt[e.player_id] = e.note ?? "";
    const paidByApp: Record<string, number> = {};
    for (const r of (rs ?? []) as any[]) {
      if (!r.player_id) continue;
      if (r.legacy) existing[r.player_id] = { amount: r.amount_cents, ref: r.legacy_ref ?? "" };
      else paidByApp[r.player_id] = (paidByApp[r.player_id] ?? 0) + r.amount_cents;
    }
    for (const id of Object.keys(paidByApp)) existing[id] = { ...(existing[id] ?? { amount: 0, ref: "" }), app: paidByApp[id] } as any;
  }

  const pill = (on: boolean) =>
    `text-xs font-bold rounded-full px-3 py-1.5 border whitespace-nowrap ${on ? "bg-panel border-border text-text" : "border-borderMuted text-muted"}`;
  const link = (over: Record<string, string>) =>
    `/recibos/anteriores?${new URLSearchParams({ team: team?.id ?? "", reason, season, ...over })}`;

  return (
    <RecibosShell access={access} active="anteriores">
      <div className="font-display text-2xl font-bold mb-1">Pagos anteriores</div>
      <div className="text-sm text-muted mb-5">
        Para los jugadores que ya pagaron antes de usar la app (con recibo de papel). Anota cuánto lleva pagado cada uno y el reporte
        queda correcto. En Anualidad también marcas a los jugadores <b>exentos</b> (por ejemplo, hijos de entrenadores). Puedes volver a guardar para corregir.
      </div>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex gap-1.5 flex-wrap">
          {activeTeams.map((t: any) => (
            <Link key={t.id} href={link({ team: t.id })} className={pill(t.id === team?.id)}>{t.name}</Link>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {REASON_KEYS.map((k) => (
            <Link key={k} href={link({ reason: k })} className={pill(k === reason)}>{REASONS[k]}</Link>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {seasons.map((s) => (
            <Link key={s} href={link({ season: s })} className={pill(s === season)}>{s}</Link>
          ))}
        </div>
      </div>
      {team ? (
        <BackfillForm
          key={`${team.id}-${reason}-${season}`}
          teamId={team.id}
          reason={reason}
          season={season}
          today={today}
          players={players}
          existing={existing as any}
          exempt={exempt}
        />
      ) : (
        <div className="text-sm text-muted">No hay equipos.</div>
      )}
    </RecibosShell>
  );
}
