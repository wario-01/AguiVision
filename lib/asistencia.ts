// lib/asistencia.ts
//
// Reglas de cálculo de la asistencia (funciones puras, sin base de datos).
//
//  - Porcentaje = (presente + tarde) ÷ (presente + tarde + ausente).
//  - "Justificado" NO baja el porcentaje: sale del total y se muestra aparte.
//  - Solo cuentan los eventos donde el jugador tiene un registro: un jugador que
//    llega a media temporada cuenta desde su primer evento con asistencia tomada.
//  - Entrenamientos = tipo "practice"; Juegos = "game" y "tournament".

export const STATUSES = ["presente", "tarde", "ausente", "justificado"] as const;
export type AttStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<AttStatus, string> = {
  presente: "Presente",
  tarde: "Tarde",
  ausente: "Ausente",
  justificado: "Justificado",
};

export const LOW_THRESHOLD = 75; // por debajo de este % se marca al jugador

export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type AttRecord = {
  event_id: string;
  player_id: string;
  status: AttStatus;
  event_type: string; // game | practice | tournament | other
  start_at: string;
  title: string | null;
  opponent: string | null;
};

export type Counts = {
  presente: number;
  tarde: number;
  ausente: number;
  justificado: number;
  contables: number; // presente + tarde + ausente
  pct: number | null; // null si no hay eventos contables
};

export function countRecords(rs: { status: AttStatus }[]): Counts {
  const c = { presente: 0, tarde: 0, ausente: 0, justificado: 0 };
  for (const r of rs) c[r.status]++;
  const contables = c.presente + c.tarde + c.ausente;
  return {
    ...c,
    contables,
    pct: contables > 0 ? Math.round(((c.presente + c.tarde) / contables) * 100) : null,
  };
}

export type Group = "entrenamiento" | "juego" | "otro";
export function groupOf(type: string): Group {
  if (type === "practice") return "entrenamiento";
  if (type === "game" || type === "tournament") return "juego";
  return "otro";
}

export function statsOf(rs: AttRecord[]) {
  return {
    entrenamientos: countRecords(rs.filter((r) => groupOf(r.event_type) === "entrenamiento")),
    juegos: countRecords(rs.filter((r) => groupOf(r.event_type) === "juego")),
    total: countRecords(rs),
  };
}

// Fecha del evento en hora de Austin (no en UTC).
export function chicagoYMD(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export function monthOf(iso: string): { year: number; month: number } {
  const [y, m] = chicagoYMD(iso).split("-").map(Number);
  return { year: y, month: m }; // month 1–12
}

export function eventName(r: { event_type: string; title: string | null; opponent: string | null }): string {
  if (r.event_type === "game") return `Partido vs ${r.opponent ?? "?"}`;
  if (r.event_type === "tournament") return r.title || "Torneo";
  if (r.event_type === "practice") return r.title || "Entrenamiento";
  return r.title || "Evento";
}

export function formatEventDate(iso: string): string {
  const [y, m, d] = chicagoYMD(iso).split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1].toLowerCase()} ${y}`;
}

// Porcentaje por mes (para la gráfica), en orden cronológico.
export function monthlySeries(rs: AttRecord[]): { key: string; label: string; pct: number | null; n: number }[] {
  const byMonth = new Map<string, AttRecord[]>();
  for (const r of rs) {
    const { year, month } = monthOf(r.start_at);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(r);
  }
  return Array.from(byMonth.keys())
    .sort()
    .map((key) => {
      const c = countRecords(byMonth.get(key)!);
      return { key, label: MESES_CORTOS[Number(key.slice(5)) - 1], pct: c.pct, n: c.contables };
    });
}
