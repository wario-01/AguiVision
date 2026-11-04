import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess, agreedTotalCents, toCents, seasonOptions } from "@/lib/finance";

// GET  /api/recibos/cuotas?playerId=...&season=2026-27  → cuota vigente + historial
// POST /api/recibos/cuotas {playerId, season, monthly, months, joinedOn, note, totalOverride?}
// Solo el dueño y quienes expiden recibos. Cada cambio queda sellado (quién, cuándo, por qué).
export async function GET(req: Request) {
  const access = await getFinanceAccess();
  if (!access) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const u = new URL(req.url);
  const playerId = u.searchParams.get("playerId");
  const season = u.searchParams.get("season");
  const admin = createAdminClient();
  if (!admin || !playerId || !season) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const { data } = await admin
    .from("player_fees")
    .select("*")
    .eq("player_id", playerId)
    .eq("season", season)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ history: data ?? [] });
}

export async function POST(req: Request) {
  const access = await getFinanceAccess();
  if (!access || !(access.level === "owner" || access.canIssue)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const playerId = String(b.playerId ?? "");
  const season = String(b.season ?? "");
  const note = String(b.note ?? "").trim();
  const monthly = toCents(b.monthly);
  const months = Number(b.months);
  const joinedOn = /^\d{4}-\d{2}-\d{2}$/.test(String(b.joinedOn ?? "")) ? String(b.joinedOn) : null;
  if (!playerId || !seasonOptions().includes(season)) return NextResponse.json({ error: "Jugador o temporada inválidos" }, { status: 400 });
  if (monthly === null) return NextResponse.json({ error: "Cuota mensual inválida" }, { status: 400 });
  if (!Number.isFinite(months) || months < 0 || months > 12) return NextResponse.json({ error: "Meses inválidos (0 a 12)" }, { status: 400 });
  if (note.length < 3) return NextResponse.json({ error: "Escribe el motivo del cambio" }, { status: 400 });

  // Total: cuota × meses, o un monto ajustado a mano.
  let total = agreedTotalCents(monthly, months);
  if (b.totalOverride !== undefined && b.totalOverride !== null && b.totalOverride !== "") {
    const t = toCents(b.totalOverride);
    if (t === null) return NextResponse.json({ error: "Total inválido" }, { status: 400 });
    total = t;
  }

  const { data: player } = await admin.from("players").select("id").eq("id", playerId).maybeSingle();
  if (!player) return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });

  const { data, error } = await admin
    .from("player_fees")
    .insert({
      player_id: playerId, season, monthly_cents: monthly, months, total_cents: total,
      joined_on: joinedOn, note: note.slice(0, 300),
      set_by_name: access.name, set_by_email: access.email,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ fee: data });
}
