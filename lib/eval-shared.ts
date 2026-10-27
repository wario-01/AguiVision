// Constantes de evaluación que usan tanto el servidor como los componentes de cliente.
// (lib/data-evaluaciones.ts importa Supabase del servidor, por eso esto va aparte.)

export const AREA_LABELS: Record<string, string> = {
  // Equipos menores (U12 e inferiores)
  tactico: "Táctico",
  tecnico: "Técnico",
  fisico: "Físico",
  actitudinal: "Actitudinal",
  // U14 (competencias por cuatrimestre)
  tactico_cognitivo: "Táctico-técnico-cognitiva",
  condicional_motriz: "Condicional motriz",
  transversales: "Criterios transversales",
  portero: "Portero",
};

export const U14_AREAS = ["tactico_cognitivo", "condicional_motriz", "transversales"] as const;

export const PORTERO_AREA = "portero";

export type CompetenciaInput = { area: string; descripcion: string };

// Competencias U14 (documento "Competencias U14 — Prof. Mario Dena"). Solo son el
// punto de partida: se pueden editar, quitar o agregar al crear cada ciclo, y el
// siguiente ciclo se precarga con lo que se usó en el anterior.
export const U14_TEMPLATE: CompetenciaInput[] = [
  {
    area: "tactico_cognitivo",
    descripcion:
      "Ataque organizado: decide cuándo conservar el balón y cuándo acelerar hacia la portería a partir de la lectura del rival, para progresar y aprovechar situaciones de superioridad.",
  },
  {
    area: "tactico_cognitivo",
    descripcion:
      "Transición defensa-ataque: decide entre asegurar la posesión o atacar el espacio de forma directa según la zona donde recupera el balón.",
  },
  {
    area: "tactico_cognitivo",
    descripcion:
      "Transición ataque-defensa / Defensa organizada: elige cómo y cuándo presionar tras la pérdida para reducir el tiempo y el espacio del rival y dificultar su progresión.",
  },
  {
    area: "condicional_motriz",
    descripcion:
      "Coordinación: ajusta sus apoyos y disocia sus movimientos para mantener el control del balón en espacios reducidos.",
  },
  {
    area: "condicional_motriz",
    descripcion:
      "Velocidad: regula su reacción y sus aceleraciones cortas con cambios de dirección para resolver el duelo directo.",
  },
  {
    area: "condicional_motriz",
    descripcion:
      "Resistencia y fuerza: sostiene la calidad de sus acciones y el control de su cuerpo cuando aparece la fatiga propia del juego.",
  },
  {
    area: "transversales",
    descripcion:
      "Esfuerzo y responsabilidad (individual): decide asumir su esfuerzo personal y poner su crecimiento al servicio del equipo.",
  },
  {
    area: "transversales",
    descripcion:
      "Respeto e identidad (grupal): decide respetar a sus compañeros y aportar a la identidad del grupo dentro del campo.",
  },
  {
    area: "transversales",
    descripcion:
      "Lateralidad eficaz – perfil dominante: utiliza con eficacia su pierna hábil para controlar, orientar y manejar el balón según lo que exige la jugada.",
  },
  {
    area: "transversales",
    descripcion:
      "Lateralidad eficaz – perfil menos hábil: recurre a su pierna menos hábil cuando la jugada lo requiere, buscando progresivamente mayor control y fluidez.",
  },
];

// Competencias de portero: son EJEMPLOS mientras se definen los parámetros reales.
// Se editan, quitan o agregan igual que las demás. Solo se califican a los porteros.
export const PORTERO_TEMPLATE: CompetenciaInput[] = [
  { area: "portero", descripcion: "Posicionamiento: ocupa la posición adecuada según la ubicación del balón y de los atacantes." },
  { area: "portero", descripcion: "Manejo y blocaje: atrapa o desvía el balón con seguridad en tiros y centros." },
  { area: "portero", descripcion: "Reflejos y estirada: reacciona con rapidez ante tiros cercanos y llega a balones lejanos." },
  { area: "portero", descripcion: "Salidas y juego aéreo: decide cuándo salir a cortar balones y lo hace con seguridad." },
  { area: "portero", descripcion: "Juego con los pies: participa en la salida con pases y controles seguros bajo presión." },
  { area: "portero", descripcion: "Comunicación: organiza y guía a su defensa con la voz." },
];

// ---------- Duración de los ciclos (libre: se elige al crear cada ciclo) ----------
export const DURACIONES = [
  { value: "mensual", label: "Mensual", meses: 1 },
  { value: "bimestral", label: "Bimestral", meses: 2 },
  { value: "trimestral", label: "Trimestral", meses: 3 },
  { value: "cuatrimestral", label: "Cuatrimestral", meses: 4 },
  { value: "semestral", label: "Semestral", meses: 6 },
  { value: "anual", label: "Anual", meses: 12 },
  { value: "personalizado", label: "Personalizado (elijo las fechas)", meses: 0 },
];

// Fecha de fin sugerida: inicio + N meses - 1 día (ej. 1 jul + 2 meses = 31 ago).
export function endDateFor(start: string, meses: number): string {
  const [y, m, d] = start.split("-").map(Number);
  if (!y || !m || !d || meses <= 0) return "";
  const dt = new Date(Date.UTC(y, m - 1 + meses, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// Cuántos meses toca el rango [inicio, fin] (mínimo 1, máximo 12).
export function monthsSpan(start: string, end: string): number {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  if (!sy || !ey) return 1;
  return Math.min(12, Math.max(1, (ey - sy) * 12 + (em - sm) + 1));
}
