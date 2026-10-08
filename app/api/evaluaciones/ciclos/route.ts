// app/api/evaluaciones/ciclos/route.ts
//
// Crea un nuevo ciclo de evaluación formativa junto con su currículo
// (periodos x áreas). La RLS en Supabase ya exige que quien llama sea
// coach del equipo (policy "eval_cycles_write_coaches"), así que no hace
// falta volver a checar el rol aquí — si no es coach, el insert falla.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PeriodoInput {
  period_label: string;
  period_order: number;
  items: { area: string; descripcion: string }[];
}

interface Body {
  team_id: string;
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  periodos: PeriodoInput[];
}

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

  if (!body.team_id || !body.name || !body.start_date || !body.end_date) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const name = String(body.name).trim().slice(0, 100);
  const periodos = Array.isArray(body.periodos) ? body.periodos.slice(0, 12) : [];
  if (!name) {
    return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 });
  }
  if (isNaN(Date.parse(body.start_date)) || isNaN(Date.parse(body.end_date))) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'Tenés que iniciar sesión' }, { status: 401 });
  }

  // 1) Crear el ciclo
  const { data: cycle, error: cycleError } = await supabase
    .from('eval_cycles')
    .insert({
      team_id: body.team_id,
      name,
      period_type: body.period_type || 'trimestral',
      start_date: body.start_date,
      end_date: body.end_date,
    })
    .select()
    .single();

  if (cycleError || !cycle) {
    console.error('Error creando ciclo', cycleError);
    return NextResponse.json(
      { error: 'No se pudo crear el ciclo (¿tenés permiso de entrenador?)' },
      { status: 403 }
    );
  }

  // 2) Crear los items de currículo (puede venir vacío si lo cargan después)
  const rows = periodos.flatMap((p) =>
    (Array.isArray(p.items) ? p.items.slice(0, 40) : [])
      .filter((it) => typeof it.descripcion === 'string' && it.descripcion.trim().length > 0)
      .map((it) => ({
        cycle_id: cycle.id,
        period_label: String(p.period_label ?? '').slice(0, 60),
        period_order: p.period_order,
        area: String(it.area ?? '').slice(0, 60),
        descripcion: it.descripcion.trim().slice(0, 300),
      }))
  );

  if (rows.length > 0) {
    const { error: itemsError } = await supabase.from('eval_curriculum_items').insert(rows);
    if (itemsError) {
      console.error('Error creando currículo', itemsError);
      return NextResponse.json(
        { error: 'El ciclo se creó pero falló el currículo', cycle_id: cycle.id },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ cycle_id: cycle.id });
}

// DELETE /api/evaluaciones/ciclos
// json: { cycleId }
// Borra el ciclo con su currículo y las calificaciones formativas de ese ciclo
// (en cascada). Los resultados físico-técnicos NO se borran: solo pierden la
// asociación con el ciclo. La RLS exige ser coach del equipo.
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 500 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body.cycleId !== 'string') {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'Tenés que iniciar sesión' }, { status: 401 });
  }

  const { data, error } = await supabase.from('eval_cycles').delete().eq('id', body.cycleId).select('id');
  if (error) {
    console.error('Error borrando ciclo', error);
    return NextResponse.json({ error: 'No se pudo borrar el ciclo' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'No tenés permiso para borrar este ciclo, o ya no existe' }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
