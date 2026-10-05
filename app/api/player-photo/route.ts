import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { checkImage } from "@/lib/imageUpload";

// POST /api/player-photo
// form-data: { playerId, file }
// Solo coach/assistant del equipo de ese jugador puede subir su foto.
export async function POST(req: Request) {
  const formData = await req.formData();
  const playerId = formData.get("playerId");
  const file = formData.get("file");

  if (typeof playerId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const image = checkImage(file);
  if (!image.ok) {
    return NextResponse.json({ error: image.error }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "No se pudo conectar con la base de datos" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión" }, { status: 401 });
  }

  const { data: player } = await supabase.from("players").select("id, team_id").eq("id", playerId).single();
  if (!player) {
    return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", player.team_id)
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "coach" && membership.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso para cambiar esta foto" }, { status: 403 });
  }

  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
  }

  const path = `players/${player.id}-${Date.now()}.${image.ext}`;

  const { error: uploadError } = await admin.storage
    .from("photos")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 });
  }

  const { data: publicUrl } = admin.storage.from("photos").getPublicUrl(path);
  await admin.from("players").update({ photo_url: publicUrl.publicUrl }).eq("id", player.id);

  return NextResponse.json({ url: publicUrl.publicUrl });
}
