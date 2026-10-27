// Última prueba física contra la anterior del MISMO jugador (su propio avance).
// Verde = mejoró (según la métrica: menos tiempo o más distancia), rojo = bajó.

type Metric = { id: string; nombre: string; unidad: string; mejor_direccion: "menor" | "mayor" };
type Row = { valor: number; fecha: string };

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export default function PhysicalProgress({
  metrics,
  historial,
}: {
  metrics: Metric[];
  historial: Record<string, Row[]>; // del más reciente al más viejo
}) {
  const items = metrics
    .map((m) => ({ m, rows: historial[m.id] ?? [] }))
    .filter((x) => x.rows.length > 0);
  if (items.length === 0) return null;
  return (
    <div className="bg-panel border border-border rounded-xl p-4 mb-4">
      <div className="text-xs text-muted mb-3">Su avance: última prueba contra la anterior</div>
      <div className="flex flex-col gap-2.5">
        {items.map(({ m, rows }) => {
          const last = rows[0];
          const prev = rows[1];
          const diff = prev ? Math.round((last.valor - prev.valor) * 100) / 100 : null;
          const better = diff === null || diff === 0 ? null : m.mejor_direccion === "menor" ? diff < 0 : diff > 0;
          return (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{m.nombre}</div>
                <div className="text-[11px] text-muted">
                  {prev ? `${fmt(prev.valor)} → ${fmt(last.valor)} ${m.unidad}` : `${fmt(last.valor)} ${m.unidad} · primera medición`}
                </div>
              </div>
              {diff !== null && (
                <span
                  className={`text-xs font-extrabold shrink-0 ${
                    better === null ? "text-muted" : better ? "text-ok" : "text-red"
                  }`}
                >
                  {better === null ? "= igual" : `${better ? "▲" : "▼"} ${diff > 0 ? "+" : ""}${fmt(diff)}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
