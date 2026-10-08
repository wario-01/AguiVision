// app/api/evaluaciones/fisico/route.ts
//
// Guarda uno o varios resultados físico-técnicos de un jugador para
// una fecha. La RLS exige ser coach del equipo del jugador.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Body {
  player_id: string;
  fecha: string;
  resultados: { metric_id: string; valor: number }[];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase no está configurado" }, { status: 500 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.player_id || !body.fecha || !Array.isArray(body.resultados) || body.resultados.length === 0) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = body.resultados
    .filter((r) => r.metric_id && typeof r.valor === "number" && !Number.isNaN(r.valor))
    .map((r) => ({
      player_id: body.player_id,
      metric_id: r.metric_id,
      valor: r.valor,
      fecha: body.fecha,
      recorded_by: user?.id ?? null,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "No hay resultados válidos para guardar" }, { status: 400 });
  }

  const { error } = await supabase.from("physical_results").insert(rows);

  if (error) {
    console.error("Error guardando resultados físicos", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, guardados: rows.length });
}

// DELETE /api/evaluaciones/fisico
// json: { resultId }
// Borra un resultado físico-técnico. La RLS exige ser coach del equipo del jugador.
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase no está configurado" }, { status: 500 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body.resultId !== "string") {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data, error } = await supabase.from("physical_results").delete().eq("id", body.resultId).select("id");
  if (error) {
    console.error("Error borrando resultado físico", error);
    return NextResponse.json({ error: "No se pudo borrar el resultado" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "No tenés permiso para borrar este resultado, o ya no existe" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
