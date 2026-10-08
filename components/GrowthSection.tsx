// components/GrowthSection.tsx
//
// IMC e historial de crecimiento de UN jugador. Lo ven el cuerpo técnico y la
// familia (papá/jugador vinculado) — la base de datos solo deja leer a ellos.

import BmiChart from "@/components/charts/BmiChart";
import { cdcDataAvailable, formatHeight, STATUS_INFO, WHTR_LIMIT, Z_JUMP } from "@/lib/bmi";
import type { Measurement } from "@/lib/data-crecimiento";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

export default function GrowthSection({
  measurements,
  audience,
}: {
  measurements: Measurement[];
  audience: "staff" | "familia";
}) {
  if (measurements.length === 0) {
    return (
      <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-6 text-center">
        {audience === "staff"
          ? "Todavía no hay mediciones. Captura peso y altura en “Editar datos”."
          : "Todavía no hay mediciones de tu hijo. El entrenador las registra con su peso y altura."}
      </div>
    );
  }

  const last = measurements[measurements.length - 1];
  const info = last.status ? STATUS_INFO[last.status] : null;
  const a = last.assessment;
  const chartSex = last.sex;
  const chartPoints = measurements
    .filter((m) => m.age_months !== null)
    .map((m) => ({ ageMonths: m.age_months as number, bmi: m.bmi }));
  const canChart = chartSex !== null && chartPoints.length > 0 && cdcDataAvailable();
  const newestFirst = [...measurements].reverse();

  return (
    <div className="flex flex-col gap-4">
      {a && a.level === "aviso" && (
        <div className="bg-goldBgDim border border-goldBorderDim rounded-xl p-4">
          <div className="text-sm font-bold text-gold mb-1">
            {audience === "staff" ? "Aviso que verá la familia: " : "Conviene prestarle atención: "}
            {a.title}
          </div>
          <div className="text-sm leading-relaxed">{a.message}</div>
        </div>
      )}
      {a && a.level === "info" && (
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="text-sm font-bold mb-1">{a.title}</div>
          <div className="text-sm leading-relaxed text-muted">{a.message}</div>
        </div>
      )}

      <div className="bg-panel border border-border rounded-xl p-4">
        <div className="text-xs text-muted mb-2">Última medición · {fmtDate(last.measured_on)}</div>
        <div className="flex items-end gap-6 flex-wrap">
          <div>
            <div className="font-display text-4xl font-bold text-gold leading-none">{last.bmi}</div>
            <div className="text-xs text-muted mt-1">IMC</div>
          </div>
          <div className="text-sm">
            <div>{last.peso_lb} lb</div>
            <div>{formatHeight(last.altura_in)}</div>
            {last.cintura_in !== null && <div>Cintura {last.cintura_in} pulg</div>}
          </div>
          {last.percentile !== null && info && (
            <div className="text-sm">
              <div className="font-bold">{info.label}</div>
              <div className="text-xs text-muted">Percentil {Math.round(last.percentile)} para su edad (CDC)</div>
            </div>
          )}
        </div>
        {last.whtr !== null && (
          <div className="text-xs mt-3">
            <span className="text-muted">Cintura ÷ altura: </span>
            <span className="font-bold">{last.whtr}</span>
            <span className="text-muted">
              {last.whtr >= WHTR_LIMIT ? " · por encima de 0.50 (señal de atención)" : " · en rango (menos de 0.50)"}
            </span>
          </div>
        )}
        {last.percentile !== null && last.prevPercentile !== null && last.dz !== null && (
          <div className="text-xs mt-2">
            <span className="text-muted">Desde la medición anterior: percentil </span>
            <span className="font-bold">
              {Math.round(last.prevPercentile)} → {Math.round(last.percentile)}
            </span>
            <span className="text-muted">
              {last.dz >= Z_JUMP ? " · subió rápido" : last.dz <= -Z_JUMP ? " · bajó" : " · estable"}
            </span>
          </div>
        )}
        {audience === "staff" && last.cintura_in === null && last.percentile !== null && (
          <div className="text-xs text-muted mt-2">
            Tip: mide la cintura (a la altura del ombligo) y captúrala en “Editar datos”. Ayuda a saber si un IMC alto es
            músculo o grasa.
          </div>
        )}
        {last.percentile === null && (
          <div className="text-xs text-muted mt-3">
            {!cdcDataAvailable()
              ? "La comparación con los percentiles del CDC todavía no está disponible."
              : audience === "staff"
              ? "Para compararlo con los percentiles del CDC falta la edad y el sexo (en “Editar datos”)."
              : "Para compararlo con los percentiles del CDC el entrenador debe registrar su edad."}
          </div>
        )}
      </div>

      {measurements.length > 1 && (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 gap-2 px-4 py-2 text-[11px] font-bold text-muted uppercase tracking-wide border-b border-border">
            <div>Fecha</div>
            <div>Peso</div>
            <div>Altura</div>
            <div>Cintura</div>
            <div>IMC</div>
          </div>
          {newestFirst.map((m, i) => (
            <div
              key={m.id}
              className={`grid grid-cols-5 gap-2 px-4 py-2.5 text-sm ${i < newestFirst.length - 1 ? "border-b border-border" : ""}`}
            >
              <div>{fmtDate(m.measured_on)}</div>
              <div>{m.peso_lb} lb</div>
              <div>{formatHeight(m.altura_in)}</div>
              <div>{m.cintura_in !== null ? `${m.cintura_in} pulg` : "—"}</div>
              <div className="font-bold">
                {m.bmi}
                {m.percentile !== null && <span className="text-xs text-muted font-medium"> · p{Math.round(m.percentile)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {canChart && chartSex && (
        <details className="bg-panel border border-border rounded-xl">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-gold">
            Ver gráfica de percentiles (CDC, EE. UU.)
          </summary>
          <div className="px-4 pb-4">
            <BmiChart sex={chartSex} points={chartPoints} playerLabel={audience === "staff" ? "Jugador" : "Tu hijo"} />
            <div className="text-xs text-muted mt-2 leading-relaxed">
              Las líneas son los percentiles de IMC para la edad del CDC: por debajo de la de abajo (5) está por debajo
              del rango típico; entre la 5 y la 85, rango saludable; arriba de la 85, por encima del rango típico.
              El IMC es una referencia, no un diagnóstico.
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
