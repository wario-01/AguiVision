import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isR2Configured, r2Delete } from "@/lib/r2";

// Una vez por día (ver vercel.json). Borra las fotos de más de 60 días que
// NO están marcadas como "Guardar", tanto de Cloudflare R2 como de la base
// de datos — así el almacenamiento no crece sin parar. La copia en la
// Buffalo (si la hay) no se toca.
const RETENTION_DAYS = 60;

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isAdminConfigured || !isR2Configured) {
    return NextResponse.json({ error: "Falta configurar el servidor o las fotos" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: old, error } = await admin
    .from("photos")
    .select("id, r2_key, thumb_key")
    .eq("keep", false)
    .lt("created_at", cutoff)
    .limit(500);
  if (error) return NextResponse.json({ error: "Error consultando fotos" }, { status: 500 });

  let deleted = 0;
  for (const p of old ?? []) {
    const a = await r2Delete(p.r2_key);
    const b = await r2Delete(p.thumb_key);
    // Solo se borra el registro si los archivos ya no están (si R2 falló, se reintenta mañana).
    if (a && b) {
      await admin.from("photos").delete().eq("id", p.id);
      deleted++;
    }
  }
  return NextResponse.json({ checked: (old ?? []).length, deleted });
}
