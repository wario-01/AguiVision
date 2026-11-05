// lib/annotations.ts
//
// Dibujos sobre un highlight (flechas, cuadros, círculos, texto y trazo libre).
// El video no se modifica: se guardan los dibujos con el segundo del clip en que
// aparecen y se dibujan encima al reproducir. Las coordenadas van de 0 a 1
// (proporción del ancho y el alto del video), así se ven igual en cualquier pantalla.

export type AnnoType = "arrow" | "rect" | "circle" | "text" | "free";
export type Pt = [number, number];

export type Anno = {
  id: string;
  type: AnnoType;
  color: string;
  t: number; // segundo del clip en que aparece
  d: number; // cuántos segundos se queda en pantalla
  pause: number; // segundos que se pausa el video al aparecer (0 = no pausa)
  pts: Pt[]; // flecha/cuadro/círculo: 2 puntos · texto: 1 punto · libre: varios
  text?: string;
  follow?: boolean; // false = se queda fija en la pantalla (por defecto sigue el movimiento de la cámara)
};

export const ANNO_COLORS = ["#F9E547", "#FFFFFF", "#E6483C", "#4ADE80"];
export const PAUSE_OPTIONS = [0, 2, 3, 5];
export const MAX_ANNOS = 60;
export const DEFAULT_DURATION = 4;

export const TYPE_LABELS: Record<AnnoType, string> = {
  arrow: "Flecha",
  rect: "Cuadro",
  circle: "Círculo",
  text: "Texto",
  free: "Trazo",
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

export const isActive = (a: Anno, t: number) => t >= a.t && t <= a.t + a.d;

// Color del texto sobre el fondo de la etiqueta.
export const inkFor = (color: string) => (color.toUpperCase() === "#E6483C" ? "#FFFFFF" : "#003C71");

// Valida lo que llega de la base de datos o del navegador. Lo que no sirve se descarta.
export function cleanAnnotations(raw: unknown): Anno[] {
  const out: Anno[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_ANNOS) break;
    const type = x?.type as AnnoType;
    if (!["arrow", "rect", "circle", "text", "free"].includes(type)) continue;
    const ptsRaw: unknown[] = Array.isArray(x?.pts) ? x.pts : [];
    let pts: Pt[] = [];
    for (const p of ptsRaw) {
      const a = Array.isArray(p) ? Number(p[0]) : NaN;
      const b = Array.isArray(p) ? Number(p[1]) : NaN;
      if (Number.isFinite(a) && Number.isFinite(b)) pts.push([r4(clamp(a, 0, 1)), r4(clamp(b, 0, 1))]);
    }
    if (type === "text") {
      if (pts.length < 1) continue;
      pts = [pts[0]];
    } else if (type === "free") {
      if (pts.length < 2) continue;
      if (pts.length > 400) {
        const step = pts.length / 400;
        pts = Array.from({ length: 400 }, (_, i) => pts[Math.floor(i * step)]);
      }
    } else {
      if (pts.length < 2) continue;
      pts = [pts[0], pts[1]];
    }
    const color = ANNO_COLORS.find((c) => c.toUpperCase() === String(x?.color).toUpperCase()) ?? ANNO_COLORS[0];
    const text = type === "text" ? String(x?.text ?? "").trim().slice(0, 60) : undefined;
    if (type === "text" && !text) continue;
    let id = typeof x?.id === "string" && x.id ? x.id.slice(0, 40) : "";
    if (!id || seen.has(id)) id = `a${out.length}_${Math.random().toString(36).slice(2, 8)}`;
    seen.add(id);
    const pause = Number(x?.pause);
    out.push({
      id,
      type,
      color,
      t: r1(clamp(Number(x?.t) || 0, 0, 3600)),
      d: r1(clamp(Number(x?.d) || DEFAULT_DURATION, 0.5, 60)),
      pause: Number.isFinite(pause) ? Math.round(clamp(pause, 0, 10)) : 0,
      pts,
      ...(text ? { text } : {}),
      ...(x?.follow === false ? { follow: false } : {}),
    });
  }
  return out;
}

export const newId = () => `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
