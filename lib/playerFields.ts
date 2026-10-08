// lib/playerFields.ts
//
// Validación compartida de los datos de un jugador (alta y edición).
// Peso en libras, altura en pulgadas totales.

export const PERFILES_VALIDOS = ["derecho", "izquierdo", "ambidiestro"];

export type PlayerFields = {
  jersey_number: number | null;
  position: string | null;
  peso: number | null; // libras
  altura: number | null; // pulgadas
  cintura: number | null; // pulgadas (opcional)
  perfil: string | null;
  age_months: number | null; // edad al medir, en meses (años*12 + meses)
  sex: "M" | "F" | null;
};

function blank(v: unknown) {
  return v === "" || v === null || v === undefined;
}

export function parsePlayerFields(
  body: Record<string, unknown>
): { ok: true; fields: PlayerFields } | { ok: false; error: string } {
  let jersey_number: number | null = null;
  if (!blank(body.jersey_number)) {
    const n = Number(body.jersey_number);
    if (!Number.isInteger(n) || n < 0 || n > 99) {
      return { ok: false, error: "El número tiene que ser un entero entre 0 y 99" };
    }
    jersey_number = n;
  }

  let peso: number | null = null;
  if (!blank(body.peso)) {
    const n = Number(body.peso);
    if (!Number.isFinite(n) || n < 20 || n > 400) {
      return { ok: false, error: "El peso tiene que estar entre 20 y 400 libras" };
    }
    peso = Math.round(n * 10) / 10;
  }

  let altura: number | null = null;
  if (!blank(body.altura)) {
    const n = Number(body.altura);
    if (!Number.isFinite(n) || n < 30 || n > 96) {
      return { ok: false, error: "La altura tiene que estar entre 2 pies 6 pulgadas y 8 pies" };
    }
    altura = Math.round(n * 10) / 10;
  }

  let cintura: number | null = null;
  if (!blank(body.cintura)) {
    const n = Number(body.cintura);
    if (!Number.isFinite(n) || n < 10 || n > 70) {
      return { ok: false, error: "La cintura tiene que estar entre 10 y 70 pulgadas" };
    }
    cintura = Math.round(n * 10) / 10;
  }

  let position: string | null = null;
  if (!blank(body.position)) {
    const s = String(body.position).trim();
    if (s.length > 40) return { ok: false, error: "La posición es demasiado larga" };
    position = s || null;
  }

  let perfil: string | null = null;
  if (!blank(body.perfil)) {
    if (!PERFILES_VALIDOS.includes(String(body.perfil))) {
      return { ok: false, error: "Perfil inválido" };
    }
    perfil = String(body.perfil);
  }

  // Solo la edad (no la fecha de nacimiento): años + meses.
  let age_months: number | null = null;
  if (!blank(body.edad_anios)) {
    const years = Number(body.edad_anios);
    const extra = blank(body.edad_meses) ? 0 : Number(body.edad_meses);
    if (!Number.isInteger(years) || years < 3 || years > 20) {
      return { ok: false, error: "La edad tiene que estar entre 3 y 20 años" };
    }
    if (!Number.isInteger(extra) || extra < 0 || extra > 11) {
      return { ok: false, error: "Los meses de la edad van de 0 a 11" };
    }
    age_months = years * 12 + extra;
  }

  let sex: "M" | "F" | null = null;
  if (!blank(body.sex)) {
    if (body.sex !== "M" && body.sex !== "F") {
      return { ok: false, error: "Sexo inválido" };
    }
    sex = body.sex;
  }

  return { ok: true, fields: { jersey_number, position, peso, altura, cintura, perfil, age_months, sex } };
}

export function parseFullName(v: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof v === "string" ? v.trim() : "";
  if (!name) return { ok: false, error: "Falta el nombre del jugador" };
  if (name.length > 100) return { ok: false, error: "El nombre es demasiado largo" };
  return { ok: true, name };
}
