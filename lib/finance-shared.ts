// Constantes y funciones puras de Recibos (se pueden usar en el navegador).
export type FinanceLevel = "owner" | "admin";
export type FinanceAccess = { level: FinanceLevel; name: string; email: string; canIssue: boolean };

// Anualidad: $1,320 por temporada, en pagos de $110 al mes.
export const ANNUAL_FEE_CENTS = 132000;
export const MONTHLY_FEE_CENTS = 11000;

export const REASONS = {
  anualidad: "Anualidad",
  torneos: "Torneos",
  arbitraje: "Arbitraje",
  membresia: "Membresía",
  otro: "Otro",
} as const;
export type Reason = keyof typeof REASONS;
export const REASON_KEYS = Object.keys(REASONS) as Reason[];

export const METHODS = { cash: "Efectivo", zelle: "Zelle" } as const;
export type Method = keyof typeof METHODS;

export const LEVEL_LABELS: Record<FinanceLevel, string> = {
  owner: "Superusuario",
  admin: "Administrador (ve reportes)",
};

export type Receipt = {
  id: string;
  number: number | null; // null en los pagos previos (de antes de la app)
  team_id: string | null;
  team_name: string;
  player_id: string | null;
  player_name: string;
  reason: Reason;
  description: string;
  season: string;
  total_cents: number;
  amount_cents: number;
  balance_cents: number;
  method: Method | null;
  issued_by_name: string;
  issued_by_email: string;
  receipt_date: string; // YYYY-MM-DD
  voided: boolean;
  void_reason: string | null;
  legacy: boolean;
  legacy_ref: string | null;
  created_at: string;
};

/** Temporada (junio a mayo): 2026-06-15 → "2026-27"; 2027-03-01 → "2026-27". */
export function seasonOf(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  const start = m >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// Primera temporada que se muestra. Para agregar años más viejos, baja este número
// (por ejemplo, 2025 agrega la 2025-26). Las nuevas temporadas se agregan solas:
// cada junio aparece la siguiente.
export const FIRST_SEASON_START = 2026;

export function seasonOptions(now = new Date()): string[] {
  const cur = Number(seasonOf(now.toISOString().slice(0, 10)).slice(0, 4));
  const out: string[] = [];
  for (let s = cur + 1; s >= FIRST_SEASON_START; s--) out.push(`${s}-${String((s + 1) % 100).padStart(2, "0")}`);
  return out;
}

export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const receiptNo = (n: number | null) => (n === null ? "—" : String(n).padStart(4, "0"));

/** Dólares escritos por una persona → centavos. null si no es válido. */
export function toCents(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
  return Math.round(n * 100);
}

