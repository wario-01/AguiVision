// app/[teamSlug]/asistencia/page.tsx
//
// Staff (entrenador/asistente): reporte de asistencia del equipo, por año y mes.
// Familia (papá/jugador vinculado): la asistencia de su propio jugador.

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PrintButton from "@/components/PrintButton";
import AttendanceSummary from "@/components/AttendanceSummary";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import { getPendingEvents, getPlayerAttendance, getTeamAttendance } from "@/lib/data-asistencia";
import {
  countRecords,
  eventName,
  formatEventDate,
  LOW_THRESHOLD,
  MESES_CORTOS,
  MESES_LARGOS,
  monthOf,
  statsOf,
} from "@/lib/asistencia";

const FIRST_YEAR = 2026;

function pctText(pct: number | null) {
  return pct === null ? "—" : `${pct}%`;
}

export default async function AsistenciaPage({
  params,
  searchParams,
}: {
  params: { teamSlug: string };
  searchParams: { y?: string; m?: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const currentYear = new Date().getFullYear();
  const reqYear = Number(searchParams.y);
  const year = Number.isInteger(reqYear) && reqYear >= FIRST_YEAR && reqYear <= currentYear + 1 ? reqYear : currentYear;
  const reqMonth = Number(searchParams.m);
  const month = Number.isInteger(reqMonth) && reqMonth >= 1 && reqMonth <= 12 ? reqMonth : null;
  const years: number[] = [];
  for (let y = FIRST_YEAR; y <= Math.max(currentYear, year); y++) years.push(y);

  const isStaff = team.role === "coach" || team.role === "assistant";
  const isFamily = (team.role === "parent" || team.role === "player") && !!team.player_id;
  if (!isStaff && !isFamily) notFound();

  const base = `/${team.slug}/asistencia`;
  const qs = (y: number, m: number | null) => `${base}?y=${y}${m ? `&m=${m}` : ""}`;

  // ---------- Familia ----------
  if (!isStaff) {
    const players = await getPlayers(team.slug);
    const me = players.find((p) => p.id === team.player_id);
    const records = await getPlayerAttendance(team.player_id as string, year);
    return (
      <div className="flex h-screen w-full">
        <Sidebar currentTeamSlug={team.slug} active="asistencia" />
        <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
          <div className="font-display text-2xl font-bold mb-1">Asistencia</div>
          <div className="text-sm text-muted mb-5">
            {me?.full_name ?? "Jugador"} · {team.name}
          </div>
          <div className="flex gap-2 mb-5 flex-wrap">
            {years.map((y) => (
              <Link
                key={y}
                href={`${base}?y=${y}`}
                className={`text-xs font-bold rounded-full px-3 py-1.5 border ${
                  y === year ? "bg-panel border-border text-text" : "border-borderMuted text-muted"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
          <AttendanceSummary records={records} year={year} />
          <div className="text-xs text-muted mt-4 leading-relaxed">
            El porcentaje cuenta presente y tarde entre todos los eventos con asistencia tomada. Las faltas
            justificadas no bajan el porcentaje.
          </div>
        </div>
      </div>
    );
  }

  // ---------- Staff ----------
  const [players, allRecords, pending] = await Promise.all([
    getPlayers(team.slug),
    getTeamAttendance(team.id, year),
    getPendingEvents(team.id),
  ]);
  const records = month ? allRecords.filter((r) => monthOf(r.start_at).month === month) : allRecords;

  const rows = players
    .map((p) => ({ p, s: statsOf(records.filter((r) => r.player_id === p.id)) }))
    .sort((a, b) => a.p.full_name.localeCompare(b.p.full_name));
  const teamTotal = countRecords(records);
  const periodo = month ? `${MESES_LARGOS[month - 1]} ${year}` : `Año ${year}`;
  const exportQs = `team=${team.slug}&y=${year}${month ? `&m=${month}` : ""}`;

  return (
    <div className="flex h-screen w-full">
      <div className="no-print">
        <Sidebar currentTeamSlug={team.slug} active="asistencia" />
      </div>
      <div className="print-area flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-3xl">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <div className="font-display text-2xl font-bold">Asistencia</div>
          <PrintButton />
        </div>
        <div className="text-sm text-muted mb-5">
          {team.name} · {periodo}
        </div>

        <div className="no-print flex flex-col gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {years.map((y) => (
              <Link
                key={y}
                href={qs(y, month)}
                className={`text-xs font-bold rounded-full px-3 py-1.5 border ${
                  y === year ? "bg-panel border-border text-text" : "border-borderMuted text-muted"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Link
              href={qs(year, null)}
              className={`text-xs font-bold rounded-full px-3 py-1.5 border ${
                !month ? "bg-panel border-border text-text" : "border-borderMuted text-muted"
              }`}
            >
              Todo el año
            </Link>
            {MESES_CORTOS.map((label, i) => (
              <Link
                key={label}
                href={qs(year, i + 1)}
                className={`text-xs font-bold rounded-full px-3 py-1.5 border ${
                  month === i + 1 ? "bg-panel border-border text-text" : "border-borderMuted text-muted"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="flex gap-4 flex-wrap text-xs font-bold">
            <a href={`/api/asistencia/export?${exportQs}`} className="text-gold hover:underline">
              Descargar resumen (Excel)
            </a>
            <a href={`/api/asistencia/export?${exportQs}&detalle=1`} className="text-gold hover:underline">
              Descargar detalle por evento (Excel)
            </a>
          </div>
        </div>

        {pending.length > 0 && (
          <div className="no-print bg-goldBgDim border border-goldBorderDim rounded-xl p-4 mb-6">
            <div className="text-sm font-bold text-gold mb-2">Falta tomar asistencia ({pending.length})</div>
            <div className="flex flex-col gap-1.5">
              {pending.slice(0, 8).map((e) => (
                <Link
                  key={e.id}
                  href={`${base}/evento/${e.id}`}
                  className="flex items-center justify-between gap-3 text-sm hover:underline"
                >
                  <span className="truncate">
                    {eventName({ event_type: e.type, title: e.title, opponent: e.opponent })}
                  </span>
                  <span className="text-xs text-muted shrink-0">{formatEventDate(e.start_at)} →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {records.length === 0 ? (
          <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
            Todavía no hay asistencia registrada en este periodo. Entra al <b>Calendario</b>, abre un evento y toca
            “Tomar asistencia”.
          </div>
        ) : (
          <div className="bg-panel border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_64px_64px_64px_44px] gap-2 px-4 py-2 text-[11px] font-bold text-muted uppercase tracking-wide border-b border-border">
              <div>Jugador</div>
              <div className="text-right">Entren.</div>
              <div className="text-right">Juegos</div>
              <div className="text-right">Total</div>
              <div className="text-right">Faltas</div>
            </div>
            {rows.map(({ p, s }, i) => {
              const low = s.total.pct !== null && s.total.pct < LOW_THRESHOLD;
              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-[1fr_64px_64px_64px_44px] gap-2 px-4 py-2.5 text-sm items-center ${
                    i < rows.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <Link href={`/${team.slug}/jugador/${p.id}`} className="font-semibold truncate hover:underline">
                    {p.jersey_number != null && <span className="text-gold">#{p.jersey_number} </span>}
                    {p.full_name}
                  </Link>
                  <div className="text-right">{pctText(s.entrenamientos.pct)}</div>
                  <div className="text-right">{pctText(s.juegos.pct)}</div>
                  <div className={`text-right font-bold ${low ? "text-red" : ""}`}>{pctText(s.total.pct)}</div>
                  <div className="text-right text-muted">{s.total.ausente + s.total.justificado || "—"}</div>
                </div>
              );
            })}
            <div className="grid grid-cols-[1fr_64px_64px_64px_44px] gap-2 px-4 py-2.5 text-sm font-bold bg-panel2 border-t border-border">
              <div>Equipo</div>
              <div className="text-right">{pctText(statsOf(records).entrenamientos.pct)}</div>
              <div className="text-right">{pctText(statsOf(records).juegos.pct)}</div>
              <div className="text-right">{pctText(teamTotal.pct)}</div>
              <div />
            </div>
          </div>
        )}

        <div className="text-xs text-muted mt-4 leading-relaxed">
          Porcentaje = (presente + tarde) ÷ (presente + tarde + ausente). Las faltas justificadas no bajan el
          porcentaje. En rojo, quien está por debajo de {LOW_THRESHOLD}%. Cuenta desde el primer evento en que el
          jugador tiene asistencia.
        </div>
      </div>
    </div>
  );
}
