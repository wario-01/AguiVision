// app/api/evaluaciones/mensaje/route.ts
//
// Guarda (o borra, si viene vacío) el mensaje del entrenador para un jugador
// en un ciclo de evaluación. Lo muestra el informe en PDF.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 500 });

  let body: { player_id?: string; cycle_id?: string; mensaje?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.player_id || !body.cycle_id) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Tienes que iniciar sesión' }, { status: 401 });

  // El jugador y el ciclo deben ser del mismo equipo.
  const { data: player } = await supabase.from('players').select('team_id').eq('id', body.player_id).maybeSingle();
  const { data: cycle } = await supabase.from('eval_cycles').select('team_id').eq('id', body.cycle_id).maybeSingle();
  if (!player || !cycle || player.team_id !== cycle.team_id) {
    return NextResponse.json({ error: 'Jugador o ciclo inválido' }, { status: 400 });
  }

  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim().slice(0, 1200) : '';

  if (!mensaje) {
    const { data, error } = await supabase
      .from('player_cycle_messages')
      .delete()
      .eq('player_id', body.player_id)
      .eq('cycle_id', body.cycle_id)
      .select('id');
    if (error) return NextResponse.json({ error: 'No se pudo borrar el mensaje' }, { status: 403 });
    return NextResponse.json({ ok: true, deleted: (data ?? []).length });
  }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();

  const { data, error } = await supabase
    .from('player_cycle_messages')
    .upsert(
      {
        player_id: body.player_id,
        cycle_id: body.cycle_id,
        mensaje,
        author_name: profile?.full_name ?? null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,cycle_id' }
    )
    .select('id');

  if (error || !data || data.length === 0) {
    console.error('Error guardando mensaje', error);
    return NextResponse.json(
      { error: 'No se pudo guardar (¿corriste el SQL del mensaje? ¿tienes permiso de entrenador?)' },
      { status: 403 }
    );
  }
  return NextResponse.json({ ok: true });
}
