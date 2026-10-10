import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { linkPendingInvitations, safeNext } from "@/lib/postLogin";

// Enlace del correo basado en token (no depende de cookies previas), así que
// funciona aunque se abra en otro navegador (p. ej. el de la app de Gmail).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    if (supabase) {
      const { error, data } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        if (data.user) await linkPendingInvitations(data.user);
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
