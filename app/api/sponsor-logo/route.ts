import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// POST /api/sponsor-logo
// form-data: { teamSlug, file }
// 1) confirma que quien llama sea coach/assistant de ese equipo (con el
//    cliente normal, que respeta RLS — así la subida en sí queda protegida)
// 2) sube el archivo al bucket público "sponsors" con el cliente admin
//    (Storage necesita permisos que el usuario normal no tiene)
// 3) guarda la URL pública en teams.sponsor_logo_url
export async function POST(req: Request) {
  const formData = await req.formData();
  const teamSlug = formData.get("teamSlug");
  const file = formData.get("file");

  if (typeof teamSlug !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "El archivo tiene que ser una imagen" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: team } = await supabase.from("teams").select("id").eq("slug", teamSlug).single();
  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para cambiar el patrocinador de este equipo" }, { status: 403 });
  }

  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${team.id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("sponsors")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 });
  }

  const { data: publicUrl } = admin.storage.from("sponsors").getPublicUrl(path);

  await admin.from("teams").update({ sponsor_logo_url: publicUrl.publicUrl }).eq("id", team.id);

  return NextResponse.json({ url: publicUrl.publicUrl });
}
