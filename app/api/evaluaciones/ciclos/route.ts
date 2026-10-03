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

  // 1) Crear el ciclo
  const { data: cycle, error: cycleError } = await supabase
    .from('eval_cycles')
    .insert({
      team_id: body.team_id,
      name: body.name,
      period_type: body.period_type || 'trimestral',
      start_date: body.start_date,
      end_date: body.end_date,
    })
    .select()
    .single();

  if (cycleError || !cycle) {
    console.error('Error creando ciclo', cycleError);
    return NextResponse.json(
      { error: cycleError?.message || 'No se pudo crear el ciclo' },
      { status: 500 }
    );
  }

  // 2) Crear los items de currículo (puede venir vacío si lo cargan después)
  const rows = (body.periodos || []).flatMap((p) =>
    p.items
      .filter((it) => it.descripcion && it.descripcion.trim().length > 0)
      .map((it) => ({
        cycle_id: cycle.id,
        period_label: p.period_label,
        period_order: p.period_order,
        area: it.area,
        descripcion: it.descripcion.trim(),
      }))
  );

  if (rows.length > 0) {
    const { error: itemsError } = await supabase.from('eval_curriculum_items').insert(rows);
    if (itemsError) {
      console.error('Error creando currículo', itemsError);
      return NextResponse.json(
        { error: itemsError.message, cycle_id: cycle.id },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ cycle_id: cycle.id });
}
