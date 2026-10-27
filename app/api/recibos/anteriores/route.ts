import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess, ANNUAL_FEE_CENTS, REASONS, Reason, seasonOptions, toCents } from "@/lib/finance";
import { clubParts } from "@/lib/tz";

// POST /api/recibos/anteriores
// body: { teamId, reason, season, date, rows: [{ playerId, amount, ref?, exempt? }] }
// Registra "lo pagado a la fecha" de jugadores que pagaron ANTES de usar la
// app (con recibo de papel). Por cada jugador queda UN registro de pago
// previo: si ya había uno, se reemplaza (el anterior se anula), así que se
// puede corregir volviendo a guardar. Un monto de 0 quita el registro.
export async function POST(req: Request) {
  const access = await getFinanceAccess();
  if (!access || !(access.canIssue || access.level === "owner")) {
    return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !(body.reason in REASONS) || !seasonOptions().includes(body.season) || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const reason = body.reason as Reason;
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : clubParts(new Date()).ymd;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });

  const { data: team } = await admin.from("teams").select("id, name").eq("id", body.teamId).maybeSingle();
  if (!team) return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });

  let saved = 0;
  for (const row of body.rows.slice(0, 80)) {
    const cents = toCents(row?.amount);
    if (cents === null || typeof row?.playerId !== "string") continue;
    const { data: player } = await admin.from("players").select("id, full_name, team_id").eq("id", row.playerId).maybeSingle();
    if (!player || player.team_id !== team.id) continue;

    // Exento de este pago en esta temporada (por ejemplo, hijo de un entrenador).
    if (reason === "anualidad" && row.exempt === true) {
      await admin.from("finance_exemptions").upsert(
        {
          player_id: player.id,
          reason,
          season: body.season,
          note: typeof row.note === "string" ? row.note.trim().slice(0, 100) || null : null,
          created_by: access.email,
        },
        { onConflict: "player_id,reason,season" }
      );
    } else if (reason === "anualidad") {
      await admin.from("finance_exemptions").delete().eq("player_id", player.id).eq("reason", reason).eq("season", body.season);
    }

    // Anula el pago previo anterior de este jugador (si había uno).
    await admin
      .from("receipts")
      .update({ voided: true, void_reason: "Reemplazado por un registro de pago previo nuevo", voided_by: access.email })
      .eq("player_id", player.id)
      .eq("reason", reason)
      .eq("season", body.season)
      .eq("legacy", true)
      .eq("voided", false);

    if (cents > 0) {
      const total = reason === "anualidad" ? ANNUAL_FEE_CENTS : cents;
      const { error } = await admin.from("receipts").insert({
        number: null,
        team_id: team.id,
        team_name: team.name,
        player_id: player.id,
        player_name: player.full_name,
        reason,
        description: "Pago previo",
        season: body.season,
        total_cents: total,
        amount_cents: cents,
        balance_cents: Math.max(0, total - cents),
        method: null,
        issued_by_name: access.name,
        issued_by_email: access.email,
        receipt_date: date,
        legacy: true,
        legacy_ref: typeof row.ref === "string" ? row.ref.trim().slice(0, 40) || null : null,
      });
      if (error) {
        console.error("Error en pago previo", error);
        return NextResponse.json({ error: `No se pudo guardar a ${player.full_name}` }, { status: 500 });
      }
    }
    saved++;
  }
  return NextResponse.json({ ok: true, saved });
}
