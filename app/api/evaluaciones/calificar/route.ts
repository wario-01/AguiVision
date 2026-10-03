// app/api/evaluaciones/calificar/route.ts
//
// Guarda (crea o actualiza) el nivel de un jugador para un ítem de
// currículo específico. Usa upsert sobre la restricción única
// (player_id, curriculum_item_id) que ya está en el esquema.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Body {
  player_id: string;
  curriculum_item_id: string;
  nivel: string;
  notas?: string;
}

const NIVELES_VALIDOS = [
  'emergente',
  'en_desarrollo',
  'consistente',
  'autonomo_funcional',
  'competente',
];

export async function POST(req: NextRequest) {
  const supabase = createClient();

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.player_id || !body.curriculum_item_id || !body.nivel) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  if (!NIVELES_VALIDOS.includes(body.nivel)) {
    return NextResponse.json({ error: 'Nivel inválido' }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('formative_evaluations').upsert(
    {
      player_id: body.player_id,
      curriculum_item_id: body.curriculum_item_id,
      nivel: body.nivel,
      notas: body.notas ?? null,
      evaluated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'player_id,curriculum_item_id' }
  );

  if (error) {
    console.error('Error guardando evaluación', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
