import { NextResponse } from "next/server";
import { getTeamBySlug, getPlayers } from "@/lib/data";
import { getTeamAttendance } from "@/lib/data-asistencia";
import {
  eventName,
  monthOf,
  statsOf,
  STATUS_LABELS,
  chicagoYMD,
  Counts,
} from "@/lib/asistencia";

// GET /api/asistencia/export?team=u11&y=2026&m=10&detalle=1
// Descarga la asistencia en CSV (se abre en Excel). Solo coach/assistant.
//  - sin "detalle": una fila por jugador con sus porcentajes.
//  - con detalle=1: una fila por jugador y por evento (historial completo).
function csvCell(v: string | number | null) {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function line(cells: (string | number | null)[]) {
  return cells.map(csvCell).join(",");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("team") ?? "";
  const year = Number(url.searchParams.get("y")) || new Date().getFullYear();
  const month = Number(url.searchParams.get("m")) || null;
  const detalle = url.searchParams.get("detalle") === "1";

  const team = await getTeamBySlug(slug);
  if (!team || (team.role !== "coach" && team.role !== "assistant")) {
    return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });
  }

  const players = await getPlayers(team.slug);
  let records = await getTeamAttendance(team.id, year);
  if (month) records = records.filter((r) => monthOf(r.start_at).month === month);

  const rows: string[] = [];
  if (detalle) {
    rows.push(line(["Fecha", "Evento", "Tipo", "Jugador", "Número", "Estado"]));
    const byId = new Map(players.map((p) => [p.id, p]));
    const sorted = [...records].sort((a, b) => a.start_at.localeCompare(b.start_at));
    for (const r of sorted) {
      const p = byId.get(r.player_id);
      if (!p) continue;
      rows.push(
        line([
          chicagoYMD(r.start_at),
          eventName(r),
          r.event_type,
          p.full_name,
          p.jersey_number ?? "",
          STATUS_LABELS[r.status],
        ])
      );
    }
  } else {
    const head = ["Jugador", "Número"];
    for (const g of ["Entrenamientos", "Juegos", "Total"]) {
      head.push(`${g} %`, `${g} presente`, `${g} tarde`, `${g} ausente`, `${g} justificado`);
    }
    rows.push(line(head));
    for (const p of players) {
      const s = statsOf(records.filter((r) => r.player_id === p.id));
      const cells: (string | number | null)[] = [p.full_name, p.jersey_number ?? ""];
      for (const c of [s.entrenamientos, s.juegos, s.total] as Counts[]) {
        cells.push(c.pct === null ? "" : c.pct, c.presente, c.tarde, c.ausente, c.justificado);
      }
      rows.push(line(cells));
    }
  }

  // BOM para que Excel respete los acentos.
  const csv = "﻿" + rows.join("\r\n") + "\r\n";
  const name = `asistencia-${team.slug}-${year}${month ? "-" + String(month).padStart(2, "0") : ""}${detalle ? "-detalle" : ""}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
