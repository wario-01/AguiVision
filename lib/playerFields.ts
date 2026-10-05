// lib/playerFields.ts
//
// Validación compartida de los datos de un jugador (alta y edición).

export const PERFILES_VALIDOS = ["derecho", "izquierdo", "ambidiestro"];

export type PlayerFields = {
  jersey_number: number | null;
  position: string | null;
  peso: number | null;
  altura: number | null;
  perfil: string | null;
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
    if (!Number.isFinite(n) || n <= 0 || n > 200) {
      return { ok: false, error: "El peso tiene que estar entre 1 y 200 kg" };
    }
    peso = n;
  }

  let altura: number | null = null;
  if (!blank(body.altura)) {
    const n = Number(body.altura);
    if (!Number.isFinite(n) || n <= 0 || n > 250) {
      return { ok: false, error: "La altura tiene que estar entre 1 y 250 cm" };
    }
    altura = n;
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

  return { ok: true, fields: { jersey_number, position, peso, altura, perfil } };
}

export function parseFullName(v: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof v === "string" ? v.trim() : "";
  if (!name) return { ok: false, error: "Falta el nombre del jugador" };
  if (name.length > 100) return { ok: false, error: "El nombre es demasiado largo" };
  return { ok: true, name };
}
