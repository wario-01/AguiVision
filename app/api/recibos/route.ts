import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess, seasonOf, toCents, REASONS, METHODS, Reason, Method } from "@/lib/finance";
import { clubParts } from "@/lib/tz";

// POST /api/recibos
// body: { teamId, playerId?, playerName, reason, description?, total, amount, method, date? }
// Solo quien puede expedir recibos. El "expedido por" es quien inició sesión. El número de recibo lo asigna la base
// de datos (consecutivo, no se puede repetir).
export async function POST(req: Request) {
  const access = await getFinanceAccess();
  if (!access || !access.canIssue) {
    return NextResponse.json({ error: "No tenés permiso para expedir recibos" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });

  const reason = body.reason as Reason;
  const method = body.method as Method;
  if (!(reason in REASONS)) return NextResponse.json({ error: "Motivo inválido" }, { status: 400 });
  if (!(method in METHODS)) return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });

  const amount = toCents(body.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
  let total = body.total === "" || body.total === undefined ? amount : toCents(body.total);
  if (total === null) return NextResponse.json({ error: "El total no es válido" }, { status: 400 });

  const playerName = typeof body.playerName === "string" ? body.playerName.trim().slice(0, 100) : "";
  if (!playerName) return NextResponse.json({ error: "Falta el nombre del jugador" }, { status: 400 });
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 200) : "";
  if (reason === "otro" && !description) {
    return NextResponse.json({ error: "Describe el motivo en 'Descripción'" }, { status: 400 });
  }

  // Equipo y jugador: se leen de la base (no se confía en el nombre que manda el navegador).
  let teamId: string | null = null;
  let teamName = "";
  if (typeof body.teamId === "string" && body.teamId) {
    const { data: team } = await admin.from("teams").select("id, name").eq("id", body.teamId).maybeSingle();
    if (!team) return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    teamId = team.id;
    teamName = team.name;
  } else {
    teamName = typeof body.teamName === "string" ? body.teamName.trim().slice(0, 60) : "";
    if (!teamName) return NextResponse.json({ error: "Elige el equipo" }, { status: 400 });
  }
  let playerId: string | null = null;
  let finalName = playerName;
  if (typeof body.playerId === "string" && body.playerId) {
    const { data: p } = await admin.from("players").select("id, full_name, team_id").eq("id", body.playerId).maybeSingle();
    if (!p || (teamId && p.team_id !== teamId)) {
      return NextResponse.json({ error: "Jugador no encontrado en ese equipo" }, { status: 404 });
    }
    playerId = p.id;
    finalName = p.full_name;
  }

  const today = clubParts(new Date()).ymd;
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : today;
  const season = seasonOf(date);

  // Saldo: en anualidad y membresía se descuentan los pagos anteriores de la misma temporada.
  let previous = 0;
  if (reason === "anualidad" || reason === "membresia") {
    let q = admin
      .from("receipts")
      .select("amount_cents")
      .eq("reason", reason)
      .eq("season", season)
      .eq("voided", false);
    q = playerId ? q.eq("player_id", playerId) : q.eq("player_name", finalName).eq("team_name", teamName);
    const { data: prev } = await q;
    previous = (prev ?? []).reduce((n: number, r: any) => n + r.amount_cents, 0);
  }
  const balance = Math.max(0, total - previous - amount);

  const { data: row, error } = await admin
    .from("receipts")
    .insert({
      team_id: teamId,
      team_name: teamName,
      player_id: playerId,
      player_name: finalName,
      reason,
      description,
      season,
      total_cents: total,
      amount_cents: amount,
      balance_cents: balance,
      method,
      issued_by_name: access.name,
      issued_by_email: access.email,
      receipt_date: date,
    })
    .select("id, number")
    .single();
  if (error || !row) {
    console.error("Error creando recibo", error);
    return NextResponse.json({ error: "No se pudo guardar el recibo" }, { status: 500 });
  }
  return NextResponse.json({ id: row.id, number: row.number });
}
