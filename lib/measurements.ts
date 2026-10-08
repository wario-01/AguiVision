// lib/measurements.ts
//
// Historial de mediciones (peso, altura, IMC). Solo se usa desde el servidor
// con el cliente admin: cada vez que el cuerpo técnico cambia el peso o la
// altura de un jugador queda una fila nueva con la fecha de hoy y la edad
// que se capturó en ese momento (no se guarda fecha de nacimiento).

import type { SupabaseClient } from "@supabase/supabase-js";
import { calcBmi } from "@/lib/bmi";

type Next = {
  peso: number | null;
  altura: number | null;
  cintura: number | null;
  age_months: number | null;
  sex: "M" | "F" | null;
};

function todayInAustin(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export async function syncMeasurements(
  admin: SupabaseClient,
  playerId: string,
  next: Next,
  prev: { peso: number | null; altura: number | null; cintura: number | null } | null
): Promise<{ error?: string }> {
  const changed =
    next.peso !== null && next.altura !== null && (!prev || prev.peso !== next.peso || prev.altura !== next.altura || prev.cintura !== next.cintura);

  if (changed) {
    const { error } = await admin.from("player_measurements").upsert(
      {
        player_id: playerId,
        measured_on: todayInAustin(),
        peso_lb: next.peso,
        altura_in: next.altura,
        cintura_in: next.cintura,
        bmi: calcBmi(next.peso as number, next.altura as number),
        age_months: next.age_months,
        sex: next.sex,
      },
      { onConflict: "player_id,measured_on" }
    );
    if (error) return { error: "No se pudo guardar la medición" };
    return {};
  }

  // Sin cambio de peso/altura: si la última medición no tenía edad o sexo y ahora sí, se completa.
  if (next.age_months !== null || next.sex !== null) {
    const { data: last } = await admin
      .from("player_measurements")
      .select("id, age_months, sex")
      .eq("player_id", playerId)
      .order("measured_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && (last.age_months === null || last.sex === null)) {
      await admin
        .from("player_measurements")
        .update({
          age_months: last.age_months ?? next.age_months,
          sex: last.sex ?? next.sex,
        })
        .eq("id", last.id);
    }
  }
  return {};
}
