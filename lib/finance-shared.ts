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


// Membresía: se paga de un solo golpe. El precio cambia solo de una temporada a otra.
export const MEMBERSHIP_FEE_CENTS: Record<string, number> = { "2026-27": 9000 };
export const MEMBERSHIP_DEFAULT_CENTS = 9000;
export const membershipFor = (season: string) => MEMBERSHIP_FEE_CENTS[season] ?? MEMBERSHIP_DEFAULT_CENTS;

/**
 * Meses de cobro de la temporada (junio a mayo) para quien entra en `joinedYmd`.
 * Los meses completos después del de ingreso cuentan enteros; el mes de ingreso se
 * divide en 4 semanas (días 1-7 → 4/4, 8-14 → 3/4, 15-21 → 2/4) y la semana de
 * ingreso cuenta. Si entra del día 22 en adelante, ese mes no se cobra.
 * Sin fecha, o si entra antes de la temporada → 12 meses.
 */
export function monthsOwed(joinedYmd: string | null | undefined, season: string): number {
  if (!joinedYmd) return 12;
  const [y, m, d] = joinedYmd.split("-").map(Number);
  if (!y || !m || !d) return 12;
  const start = Number(season.slice(0, 4));
  const idx = (y - start) * 12 + (m - 6); // 0 = junio, 11 = mayo
  if (idx <= 0) return 12;
  if (idx > 11) return 0;
  const weeks = d <= 7 ? 4 : d <= 14 ? 3 : d <= 21 ? 2 : 0;
  return 11 - idx + weeks / 4;
}

/** Total acordado = cuota mensual × meses (puede tener cuartos de mes). */
export const agreedTotalCents = (monthlyCents: number, months: number) => Math.round(monthlyCents * months);

export type PlayerFee = {
  id: string;
  player_id: string;
  season: string;
  monthly_cents: number;
  months: number;
  total_cents: number;
  joined_on: string | null;
  note: string;
  set_by_name: string;
  set_by_email: string;
  created_at: string;
};
