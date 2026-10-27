// app/api/evaluaciones/curriculo/route.ts
//
// Edita las competencias (currículo) de un ciclo que ya existe: cambiar el texto,
// agregar nuevas o quitar. Las calificaciones ya capturadas de las competencias que
// se conservan NO se pierden. Quitar una competencia borra sus calificaciones.
// La RLS exige ser entrenador del equipo (policy "curriculum_write_coaches").

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Body {
  cycleId: string;
  updates?: { id: string; descripcion: string }[];
  additions?: { period_label: string; period_order: number; area: string; descripcion: string; item_order: number }[];
  removals?: string[];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 500 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.cycleId !== 'string') {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Tienes que iniciar sesión' }, { status: 401 });

  const updates = Array.isArray(body.updates) ? body.updates.slice(0, 100) : [];
  const additions = Array.isArray(body.additions) ? body.additions.slice(0, 100) : [];
  const removals = Array.isArray(body.removals) ? body.removals.slice(0, 100) : [];

  for (const u of updates) {
    const text = String(u.descripcion ?? '').trim().slice(0, 400);
    if (!text || typeof u.id !== 'string') continue;
    const { data, error } = await supabase
      .from('eval_curriculum_items')
      .update({ descripcion: text })
      .eq('id', u.id)
      .eq('cycle_id', body.cycleId)
      .select('id');
    if (error || !data || data.length === 0) {
      return NextResponse.json({ error: 'No se pudo guardar (¿tienes permiso de entrenador?)' }, { status: 403 });
    }
  }

  if (removals.length > 0) {
    const { error } = await supabase
      .from('eval_curriculum_items')
      .delete()
      .eq('cycle_id', body.cycleId)
      .in('id', removals.filter((r) => typeof r === 'string'));
    if (error) return NextResponse.json({ error: 'No se pudieron quitar las competencias' }, { status: 500 });
  }

  const rows = additions
    .filter((a) => typeof a.descripcion === 'string' && a.descripcion.trim())
    .map((a) => ({
      cycle_id: body.cycleId,
      period_label: String(a.period_label ?? '').slice(0, 60),
      period_order: Number.isFinite(a.period_order) ? a.period_order : 0,
      area: String(a.area ?? '').slice(0, 60),
      descripcion: a.descripcion.trim().slice(0, 400),
      item_order: Number.isFinite(a.item_order) ? a.item_order : 0,
    }));
  if (rows.length > 0) {
    const { error } = await supabase.from('eval_curriculum_items').insert(rows);
    if (error) {
      console.error('Error agregando competencias', error);
      return NextResponse.json({ error: 'No se pudieron agregar las competencias' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
