// Cálculo de la ficha técnica (tarjeta del jugador). Sin dependencias del servidor.
//
// Cada dato va de 40 a 99:
//  - Pruebas físicas: el entrenador define qué resultado vale 40 ("flojo") y cuál vale 99
//    ("excelente"); lo que queda en medio se calcula. Funciona igual para tiempos
//    (menos es mejor: bajo > alto) y para distancias (más es mejor: bajo < alto).
//  - Evaluación formativa: nivel promedio 1–5 del área, llevado a 40–99.
//  - Asistencia: porcentaje llevado a 40–99 (solo equipos sin pruebas físicas).

export type FichaStat = { label: string; value: number | null };

export type FichaMetric = {
  id: string;
  grupo: string | null; // vel | res | pot | flx
  valor_bajo: number | null;
  valor_alto: number | null;
};

export function scoreFromRange(v: number, low: number, high: number): number {
  if (low === high) return 40;
  const t = (v - low) / (high - low);
  return Math.round(40 + 59 * Math.min(1, Math.max(0, t)));
}

export function levelToScore(avg: number): number {
  return Math.round(40 + 59 * Math.min(1, Math.max(0, (avg - 1) / 4)));
}

export function pctToScore(pct: number): number {
  return Math.round(40 + 59 * Math.min(1, Math.max(0, pct / 100)));
}

export function isGoalkeeper(position?: string | null): boolean {
  return !!position && /portero|arquero|goalkeeper/i.test(position);
}

export function positionAbbr(position?: string | null): string {
  if (!position) return "JUG";
  const p = position.toLowerCase();
  if (isGoalkeeper(p)) return "POR";
  if (p.includes("lateral")) return "LAT";
  if (p.includes("defensa") || p.includes("central")) return "DEF";
  if (p.includes("medio")) return "MED";
  if (p.includes("extremo")) return "EXT";
  if (p.includes("delantero")) return "DEL";
  return position.slice(0, 3).toUpperCase();
}

// Nombre corto para la tarjeta: apellido (la última o las dos últimas palabras).
export function cardName(fullName: string): string {
  const w = fullName.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "";
  if (w.length <= 2) return w[w.length - 1].toUpperCase();
  return w.slice(-2).join(" ").toUpperCase();
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeFicha(input: {
  metrics: FichaMetric[];
  latest: Record<string, number>; // metric_id -> último resultado
  areas: Record<string, number>; // área -> nivel promedio 1–5 del último ciclo
  attendancePct: number | null;
  goalkeeper: boolean;
}): { ovr: number | null; stats: FichaStat[] } {
  const { metrics, latest, areas, attendancePct, goalkeeper } = input;

  const phys = (grupo: string): number | null => {
    const scores = metrics
      .filter((m) => m.grupo === grupo && m.valor_bajo != null && m.valor_alto != null && latest[m.id] != null)
      .map((m) => scoreFromRange(latest[m.id], Number(m.valor_bajo), Number(m.valor_alto)));
    const m = mean(scores);
    return m === null ? null : Math.round(m);
  };
  const lvl = (...keys: string[]): number | null => {
    for (const k of keys) if (areas[k] != null) return levelToScore(areas[k]);
    return null;
  };

  const hasPhysical = metrics.some((m) => m.grupo);
  const arq = lvl("portero");
  let stats: FichaStat[];
  if (hasPhysical) {
    stats = goalkeeper
      ? [
          { label: "ARQ", value: arq },
          { label: "VEL", value: phys("vel") },
          { label: "POT", value: phys("pot") },
          { label: "FLX", value: phys("flx") },
          { label: "TAC", value: lvl("tactico_cognitivo", "tactico") },
          { label: "ACT", value: lvl("transversales", "actitudinal") },
        ]
      : [
          { label: "VEL", value: phys("vel") },
          { label: "RES", value: phys("res") },
          { label: "POT", value: phys("pot") },
          { label: "FLX", value: phys("flx") },
          { label: "TAC", value: lvl("tactico_cognitivo", "tactico") },
          { label: "ACT", value: lvl("transversales", "actitudinal") },
        ];
  } else {
    stats = [
      ...(goalkeeper ? [{ label: "ARQ", value: arq }] : []),
      { label: "TAC", value: lvl("tactico_cognitivo", "tactico") },
      { label: "TEC", value: lvl("tecnico") },
      { label: "FIS", value: lvl("fisico") },
      { label: "ACT", value: lvl("actitudinal", "transversales") },
      { label: "ASI", value: attendancePct == null ? null : pctToScore(attendancePct) },
    ];
  }
  const vals = stats.map((s) => s.value).filter((v): v is number => v != null);
  const m = mean(vals);
  return { ovr: vals.length >= 2 && m !== null ? Math.round(m) : null, stats };
}
