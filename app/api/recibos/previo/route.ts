import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess, seasonOf } from "@/lib/finance";
import { clubParts } from "@/lib/tz";

// GET /api/recibos/previo?reason=anualidad&playerId=...&playerName=...&teamName=...&date=YYYY-MM-DD
// Cuánto lleva pagado esa persona en esa temporada (para mostrar el saldo antes de guardar).
export async function GET(req: Request) {
  const access = await getFinanceAccess();
  if (!access || !access.canIssue) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const u = new URL(req.url);
  const reason = u.searchParams.get("reason") ?? "";
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  const date = u.searchParams.get("date") || clubParts(new Date()).ymd;
  const season = seasonOf(date);
  const playerId = u.searchParams.get("playerId");

  // ¿Está exento de este pago en esta temporada?
  let exempt = false;
  if (playerId && reason === "anualidad") {
    const { data: ex } = await admin
      .from("finance_exemptions")
      .select("id")
      .eq("player_id", playerId)
      .eq("reason", reason)
      .eq("season", season)
      .maybeSingle();
    exempt = !!ex;
  }
  if (reason !== "anualidad" && reason !== "membresia") {
    return NextResponse.json({ previousCents: 0, lastTotalCents: null, exempt });
  }
  let q = admin
    .from("receipts")
    .select("amount_cents, total_cents, created_at")
    .eq("reason", reason)
    .eq("season", season)
    .eq("voided", false)
    .order("created_at", { ascending: false });
  if (playerId) q = q.eq("player_id", playerId);
  else q = q.eq("player_name", u.searchParams.get("playerName") ?? "").eq("team_name", u.searchParams.get("teamName") ?? "");
  const { data } = await q;
  const rows = data ?? [];
  return NextResponse.json({
    previousCents: rows.reduce((n: number, r: any) => n + r.amount_cents, 0),
    lastTotalCents: rows[0]?.total_cents ?? null,
    exempt,
  });
}
