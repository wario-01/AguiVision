import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess, REASONS, REASON_KEYS, METHODS, ANNUAL_FEE_CENTS, seasonOptions, receiptNo, Receipt } from "@/lib/finance";

// GET /api/recibos/export?season=2026-27 → CSV (se abre en Excel) con todos los recibos.
function csvCell(v: string | number | null) {
  let s = v === null ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita fórmulas en Excel
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const access = await getFinanceAccess();
  if (!access) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const season = new URL(req.url).searchParams.get("season") ?? "";
  if (!seasonOptions().includes(season)) return NextResponse.json({ error: "Temporada inválida" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el servidor" }, { status: 500 });
  const sp = new URL(req.url).searchParams;
  const resumenReason = sp.get("resumen") === "1" ? sp.get("reason") ?? "" : "";
  if (resumenReason) return resumen(admin, season, resumenReason, sp.get("team") ?? "");

  const { data } = await admin
    .from("receipts")
    .select("*")
    .eq("season", season)
    .order("receipt_date", { ascending: true })
    .limit(5000);
  const rows = (data ?? []) as Receipt[];
  const head = ["Recibo", "Fecha", "Equipo", "Jugador", "Motivo", "Descripción", "Total", "Monto pagado", "Saldo", "Método", "Expidió", "Estado"];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.legacy ? `Previo${r.legacy_ref ? " " + r.legacy_ref : ""}` : receiptNo(r.number), r.receipt_date, r.team_name, r.player_name, REASONS[r.reason], r.description,
        (r.total_cents / 100).toFixed(2), (r.amount_cents / 100).toFixed(2), (r.balance_cents / 100).toFixed(2),
        r.method ? METHODS[r.method] : "", r.issued_by_name, r.voided ? `Anulado: ${r.void_reason ?? ""}` : "Válido",
      ].map(csvCell).join(",")
    );
  }
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recibos-${season}.csv"`,
    },
  });
}

// Resumen por jugador de UN motivo: lo pagado a la fecha, saldo y exentos.
// En Anualidad incluye a toda la plantilla (también quien no ha pagado).
async function resumen(admin: any, season: string, reason: string, teamFilter: string) {
  if (!(REASON_KEYS as string[]).includes(reason)) return NextResponse.json({ error: "Motivo inválido" }, { status: 400 });
  const { data } = await admin
    .from("receipts")
    .select("*")
    .eq("season", season)
    .eq("reason", reason)
    .eq("voided", false)
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as Receipt[];

  type G = { team: string; player: string; playerId: string | null; paid: number; count: number; total: number };
  const groups = new Map<string, G>();
  for (const r of rows) {
    if (teamFilter && r.team_name !== teamFilter) continue;
    const key = `${r.team_name}|${r.player_id ?? r.player_name.toLowerCase()}`;
    const g = groups.get(key) ?? { team: r.team_name, player: r.player_name, playerId: r.player_id, paid: 0, count: 0, total: r.total_cents };
    g.paid += r.amount_cents;
    g.count += 1;
    groups.set(key, g);
  }
  const exempt = new Map<string, string>();
  if (reason === "anualidad") {
    const [{ data: teams }, { data: players }, { data: ex }] = await Promise.all([
      admin.from("teams").select("id, name, active"),
      admin.from("players").select("id, team_id, full_name"),
      admin.from("finance_exemptions").select("player_id, note").eq("reason", "anualidad").eq("season", season),
    ]);
    for (const e of (ex ?? []) as any[]) exempt.set(e.player_id, e.note ?? "");
    const tn = new Map<string, string>((teams ?? []).filter((t: any) => t.active !== false).map((t: any) => [t.id, t.name] as [string, string]));
    for (const p of (players ?? []) as any[]) {
      const team = tn.get(p.team_id);
      if (!team || (teamFilter && team !== teamFilter)) continue;
      const key = `${team}|${p.id}`;
      if (!groups.has(key)) groups.set(key, { team, player: p.full_name, playerId: p.id, paid: 0, count: 0, total: ANNUAL_FEE_CENTS });
    }
  }
  const list = Array.from(groups.values()).sort((a, b) => a.team.localeCompare(b.team) || a.player.localeCompare(b.player));
  const tracks = reason === "anualidad" || reason === "membresia";
  const head = ["Equipo", "Jugador", "Pagado a la fecha", ...(tracks ? ["Total", "Saldo"] : []), "Recibos", ...(reason === "anualidad" ? ["Exento"] : [])];
  const lines = [head.join(",")];
  for (const g of list) {
    const isEx = !!g.playerId && exempt.has(g.playerId);
    lines.push(
      [
        g.team, g.player, (g.paid / 100).toFixed(2),
        ...(tracks ? [(g.total / 100).toFixed(2), (isEx ? 0 : Math.max(0, g.total - g.paid) / 100).toFixed(2)] : []),
        g.count,
        ...(reason === "anualidad" ? [isEx ? `Sí${exempt.get(g.playerId as string) ? ": " + exempt.get(g.playerId as string) : ""}` : "No"] : []),
      ].map(csvCell).join(",")
    );
  }
  return new NextResponse("\uFEFF" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resumen-${reason}-${season}.csv"`,
    },
  });
}
