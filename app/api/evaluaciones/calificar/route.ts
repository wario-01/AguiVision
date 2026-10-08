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
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 500 });
  }

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
  if (!user) {
    return NextResponse.json({ error: 'Tenés que iniciar sesión' }, { status: 401 });
  }

  const notas = typeof body.notas === 'string' ? body.notas.trim().slice(0, 1000) : '';

  // El jugador y el ítem del currículo tienen que ser del MISMO equipo
  // (la RLS solo mira el jugador; esto evita mezclar equipos).
  const { data: player } = await supabase
    .from('players')
    .select('team_id')
    .eq('id', body.player_id)
    .maybeSingle();
  const { data: item } = await supabase
    .from('eval_curriculum_items')
    .select('id, eval_cycles(team_id)')
    .eq('id', body.curriculum_item_id)
    .maybeSingle();
  const itemTeam = (item as any)?.eval_cycles?.team_id;
  if (!player || !item || !itemTeam || itemTeam !== player.team_id) {
    return NextResponse.json({ error: 'Jugador o ítem inválido' }, { status: 400 });
  }

  const { error } = await supabase.from('formative_evaluations').upsert(
    {
      player_id: body.player_id,
      curriculum_item_id: body.curriculum_item_id,
      nivel: body.nivel,
      notas: notas || null,
      evaluated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'player_id,curriculum_item_id' }
  );

  if (error) {
    console.error('Error guardando evaluación', error);
    return NextResponse.json({ error: 'No se pudo guardar (¿tenés permiso de entrenador?)' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
