import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isR2Configured, r2ViewUrl } from "@/lib/r2";

// GET /api/highlights/voice/file?id=<highlightId>
// Entrega el audio de la voz desde nuestro propio sitio (así el navegador lo puede leer y decodificar
// sin necesitar permisos CORS en Cloudflare R2). Lo puede pedir cualquier miembro del equipo.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id || !isR2Configured) return new NextResponse("No encontrado", { status: 404 });
  const supabase = await createClient();
  if (!supabase) return new NextResponse("Error", { status: 500 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new NextResponse("Inicia sesión", { status: 401 });
  // RLS: solo devuelve el highlight si la persona pertenece a ese equipo.
  const { data } = await supabase.from("highlights").select("voice_key").eq("id", id).maybeSingle();
  const key = (data as any)?.voice_key as string | null | undefined;
  if (!key) return new NextResponse("No encontrado", { status: 404 });
  const upstream = await fetch(r2ViewUrl(key));
  if (!upstream.ok) return new NextResponse("No se pudo leer el audio", { status: 502 });
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=600",
    },
  });
}
