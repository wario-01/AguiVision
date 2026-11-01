// lib/lineup.ts
//
// Formaciones del campograma y utilidades compartidas (pantalla, API e impresión).

export type Slot = { x: number; y: number; role: "POR" | "DEF" | "MED" | "DEL" };

export const FORMATION_GROUPS: { label: string; items: string[] }[] = [
  { label: "11 contra 11", items: ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"] },
  { label: "9 contra 9", items: ["3-3-2", "3-4-1", "2-4-2"] },
  { label: "7 contra 7", items: ["2-3-1", "3-2-1", "2-2-2"] },
];
const ALL = FORMATION_GROUPS.flatMap((g) => g.items);
export const isFormation = (f: unknown): f is string => typeof f === "string" && ALL.includes(f);

// Formato más usado por categoría (se puede cambiar en la pantalla).
export function defaultFormation(ageCategory?: string | null): string {
  const n = parseInt((ageCategory ?? "").replace(/\D/g, ""), 10);
  if (!n || n >= 13) return "4-3-3";
  if (n >= 11) return "3-3-2";
  return "2-3-1";
}

function spread(k: number): number[] {
  if (k === 1) return [50];
  if (k === 2) return [32, 68];
  if (k === 3) return [22, 50, 78];
  return Array.from({ length: k }, (_, i) => 12 + (i * 76) / (k - 1));
}

// Posiciones en el campo (x e y en %, el ataque va arriba). El portero es la posición 0.
export function formationSlots(f: string): Slot[] {
  const lines = (isFormation(f) ? f : "4-3-3").split("-").map(Number);
  const slots: Slot[] = [{ x: 50, y: 89, role: "POR" }];
  const top = 14;
  const bottom = 68;
  lines.forEach((k, li) => {
    const y = lines.length === 1 ? top : bottom - (li * (bottom - top)) / (lines.length - 1);
    const role = li === 0 ? "DEF" : li === lines.length - 1 ? "DEL" : "MED";
    spread(k).forEach((x) => slots.push({ x, y, role }));
  });
  return slots;
}

// "Mateo Rodríguez López" -> "Mateo R."
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length > 2 ? 1 : parts.length - 1][0].toUpperCase()}.`;
}

export function gameCode(ageCategory: string, iso: string | null): string {
  const base = `NA-${(ageCategory || "EQ").toUpperCase()}`;
  if (!iso) return base;
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const m = p.find((x) => x.type === "month")?.value;
  const dd = p.find((x) => x.type === "day")?.value;
  return `${base}-${m}${dd}`;
}

// Limpia una alineación: sin repetidos, solo jugadores del equipo, tamaño correcto.
export function cleanLineup(formation: string, slots: unknown, out: unknown, validIds: Set<string>) {
  const n = formationSlots(formation).length;
  const used = new Set<string>();
  const arr = Array.isArray(slots) ? slots : [];
  const cleanSlots: (string | null)[] = Array.from({ length: n }, (_, i) => {
    const v = arr[i];
    if (typeof v === "string" && validIds.has(v) && !used.has(v)) {
      used.add(v);
      return v;
    }
    return null;
  });
  const cleanOut: string[] = [];
  for (const v of Array.isArray(out) ? out : []) {
    if (typeof v === "string" && validIds.has(v) && !used.has(v)) {
      used.add(v);
      cleanOut.push(v);
    }
  }
  return { slots: cleanSlots, out: cleanOut };
}

// Cambios planeados, en orden: quién sale y quién entra (sin límite; un jugador puede volver a entrar).
// El minuto es opcional. Cada cambio se valida contra quién está en el campo en ese momento.
export type PlannedSub = { out: string; in: string; minute: number | null };

export function cleanSubs(subs: unknown, slots: (string | null)[], out: string[], validIds: Set<string>): PlannedSub[] {
  const field = new Set(slots.filter(Boolean) as string[]);
  const res: PlannedSub[] = [];
  for (const raw of Array.isArray(subs) ? subs : []) {
    const o = raw?.out;
    const i = raw?.in;
    if (typeof o !== "string" || typeof i !== "string") continue;
    if (!field.has(o) || !validIds.has(i) || field.has(i) || out.includes(i)) continue;
    const m = raw?.minute;
    const minute = typeof m === "number" && Number.isInteger(m) && m >= 0 && m <= 120 ? m : null;
    field.delete(o);
    field.add(i);
    res.push({ out: o, in: i, minute });
    if (res.length >= 60) break;
  }
  return res;
}

// Quién queda en el campo después de todos los cambios.
export function fieldAfter(subs: PlannedSub[], slots: (string | null)[]): Set<string> {
  const field = new Set(slots.filter(Boolean) as string[]);
  for (const s of subs) {
    field.delete(s.out);
    field.add(s.in);
  }
  return field;
}

// Cadena de cambios de un puesto: el titular sale, entra X, X sale, entra Y...
export function subChain<T extends { out: string; in: string }>(subs: T[], starterId: string): T[] {
  const chain: T[] = [];
  let cur = starterId;
  for (const s of subs) {
    if (s.out === cur) {
      chain.push(s);
      cur = s.in;
    }
  }
  return chain;
}
