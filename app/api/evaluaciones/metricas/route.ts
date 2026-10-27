// app/api/evaluaciones/metricas/route.ts
//
// Guarda la escala de la ficha técnica de cada prueba física: qué resultado vale 40
// ("flojo") y cuál vale 99 ("excelente"). La RLS exige ser entrenador del equipo.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const updates = Array.isArray(body?.updates) ? body.updates.slice(0, 30) : [];
  if (updates.length === 0) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Tienes que iniciar sesión' }, { status: 401 });

  for (const u of updates) {
    const low = Number(u?.valor_bajo);
    const high = Number(u?.valor_alto);
    if (typeof u?.id !== 'string' || !Number.isFinite(low) || !Number.isFinite(high) || low === high) {
      return NextResponse.json({ error: 'Los dos valores deben ser números distintos' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('physical_metrics')
      .update({ valor_bajo: low, valor_alto: high })
      .eq('id', u.id)
      .select('id');
    if (error || !data || data.length === 0) {
      return NextResponse.json({ error: 'No se pudo guardar (¿tienes permiso de entrenador?)' }, { status: 403 });
    }
  }
  return NextResponse.json({ ok: true });
}
