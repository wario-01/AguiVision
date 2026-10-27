// Cambio por área frente al ciclo anterior del mismo jugador.
import { AREA_LABELS } from "@/lib/eval-shared";

export default function FormativeProgress({
  current,
  previous,
  previousName,
}: {
  current: Record<string, number>;
  previous: Record<string, number>;
  previousName: string;
}) {
  const rows = Object.entries(current).map(([area, v]) => {
    const prev = previous[area];
    const diff = prev == null ? null : Math.round((v - prev) * 10) / 10;
    return { area, v, prev, diff };
  });
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="text-xs text-muted mb-2">
        Cambio contra <span className="font-bold text-text">{previousName}</span> (línea punteada en la gráfica)
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.area} className="flex items-center justify-between text-sm">
            <span className="font-semibold">{AREA_LABELS[r.area] ?? r.area}</span>
            <span className="flex items-center gap-2">
              <span className="text-muted text-xs">
                {r.prev != null ? `${r.prev.toFixed(1)} → ` : ""}
                {r.v.toFixed(1)}
              </span>
              {r.diff === null ? (
                <span className="text-xs font-bold text-muted">nuevo</span>
              ) : r.diff > 0 ? (
                <span className="text-xs font-extrabold text-ok">▲ +{r.diff.toFixed(1)}</span>
              ) : r.diff < 0 ? (
                <span className="text-xs font-extrabold text-red">▼ {r.diff.toFixed(1)}</span>
              ) : (
                <span className="text-xs font-bold text-muted">= igual</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
