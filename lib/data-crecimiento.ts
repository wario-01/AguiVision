// lib/data-crecimiento.ts
//
// Mediciones de un jugador (peso, altura, cintura, IMC) con su percentil del CDC
// y el aviso para la familia. Usa el cliente normal: la base de datos solo deja
// leer a entrenador/asistente y al papá/jugador vinculado a ese jugador.

import { createClient } from "@/lib/supabase/server";
import { assess, Assessment, bmiPercentile, bmiStatus, bmiZ, BmiStatus, waistToHeight } from "@/lib/bmi";

export interface Measurement {
  id: string;
  measured_on: string;
  peso_lb: number;
  altura_in: number;
  cintura_in: number | null;
  whtr: number | null; // cintura / altura
  bmi: number;
  age_months: number | null;
  sex: "M" | "F" | null;
  percentile: number | null;
  z: number | null;
  status: BmiStatus | null;
  prevPercentile: number | null; // percentil de la medición anterior (si hay)
  dz: number | null; // cambio de z contra la medición anterior
  assessment: Assessment | null;
}

// De la más vieja a la más reciente.
export async function getMeasurements(playerId: string): Promise<Measurement[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("player_measurements")
    .select("id, measured_on, peso_lb, altura_in, cintura_in, bmi, age_months, sex")
    .eq("player_id", playerId)
    .order("measured_on", { ascending: true });
  if (error || !data) return [];

  const out: Measurement[] = [];
  for (const r of data as any[]) {
    const bmi = Number(r.bmi);
    const age = r.age_months === null ? null : Number(r.age_months);
    const altura = Number(r.altura_in);
    const cintura = r.cintura_in === null || r.cintura_in === undefined ? null : Number(r.cintura_in);
    const z = age !== null && r.sex ? bmiZ(bmi, r.sex, age) : null;
    const pct = age !== null && r.sex ? bmiPercentile(bmi, r.sex, age) : null;
    const prev = out.length > 0 ? out[out.length - 1] : null;
    const dz = z !== null && prev && prev.z !== null ? z - prev.z : null;
    const whtr = cintura !== null ? waistToHeight(cintura, altura) : null;
    out.push({
      id: r.id,
      measured_on: r.measured_on,
      peso_lb: Number(r.peso_lb),
      altura_in: altura,
      cintura_in: cintura,
      whtr,
      bmi,
      age_months: age,
      sex: r.sex,
      percentile: pct,
      z,
      status: pct === null ? null : bmiStatus(pct),
      prevPercentile: prev?.percentile ?? null,
      dz,
      assessment: assess({ percentile: pct, whtr, dz }),
    });
  }
  return out;
}
