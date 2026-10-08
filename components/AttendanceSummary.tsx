// components/AttendanceSummary.tsx
//
// Asistencia de UN jugador: porcentajes, gráfica por mes y faltas con fecha.
// Lo ven el cuerpo técnico y la familia (la base de datos solo deja leer a ellos).

import AttendanceMonthlyChart from "@/components/charts/AttendanceMonthlyChart";
import {
  AttRecord,
  Counts,
  eventName,
  formatEventDate,
  LOW_THRESHOLD,
  monthlySeries,
  statsOf,
  STATUS_LABELS,
} from "@/lib/asistencia";

function Card({ title, c }: { title: string; c: Counts }) {
  const low = c.pct !== null && c.pct < LOW_THRESHOLD;
  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="text-xs text-muted mb-1">{title}</div>
      <div className={`font-display text-3xl font-bold leading-none ${low ? "text-red" : "text-gold"}`}>
        {c.pct === null ? "—" : `${c.pct}%`}
      </div>
      <div className="text-[11px] text-muted mt-1.5">
        {c.contables > 0 ? `${c.presente + c.tarde} de ${c.contables}` : "Sin eventos"}
        {c.justificado > 0 && ` · ${c.justificado} justif.`}
      </div>
    </div>
  );
}

export default function AttendanceSummary({
  records,
  year,
}: {
  records: AttRecord[];
  year: number;
}) {
  if (records.length === 0) {
    return (
      <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-6 text-center">
        Todavía no hay asistencia registrada en {year}.
      </div>
    );
  }
  const s = statsOf(records);
  const months = monthlySeries(records);
  const incidents = records.filter((r) => r.status !== "presente").reverse();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card title="Entrenamientos" c={s.entrenamientos} />
        <Card title="Juegos" c={s.juegos} />
        <Card title="Total" c={s.total} />
      </div>

      {months.length > 0 && (
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="text-xs text-muted mb-2">Asistencia por mes · la línea roja marca {LOW_THRESHOLD}%</div>
          <AttendanceMonthlyChart data={months} />
        </div>
      )}

      {incidents.length > 0 && (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2 text-[11px] font-bold text-muted uppercase tracking-wide border-b border-border">
            Faltas y retardos
          </div>
          {incidents.map((r, i) => (
            <div
              key={r.event_id}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                i < incidents.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="font-semibold truncate">{eventName(r)}</div>
                <div className="text-xs text-muted">{formatEventDate(r.start_at)}</div>
              </div>
              <span className="text-xs font-bold shrink-0">{STATUS_LABELS[r.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
