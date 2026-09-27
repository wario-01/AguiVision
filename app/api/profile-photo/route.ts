import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// POST /api/profile-photo
// form-data: { file }
// Cualquier persona logueada puede subir SU PROPIA foto de perfil — no la
// de nadie más (no recibe ningún id de otra persona).
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
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

  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta configurar el almacenamiento" }, { status: 500 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `profiles/${userData.user.id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("photos")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 });
  }

  const { data: publicUrl } = admin.storage.from("photos").getPublicUrl(path);

  // Esto sí respeta RLS con el cliente normal (cada uno actualiza su propia
  // fila de todos modos, así que no hace falta el cliente admin acá).
  await supabase.from("profiles").update({ avatar_url: publicUrl.publicUrl }).eq("id", userData.user.id);

  return NextResponse.json({ url: publicUrl.publicUrl });
}
