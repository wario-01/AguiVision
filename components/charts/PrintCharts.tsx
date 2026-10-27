"use client";

// components/charts/PrintCharts.tsx
//
// Gráficas para el informe imprimible (PDF). A diferencia de las de la
// pantalla: tamaño fijo (el informe está oculto en pantalla, así que no se
// puede medir el ancho), sin animación y con colores para papel blanco.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import { AREA_LABELS } from "@/lib/eval-shared";

const NAVY = "#0A1830";
const GOLD = "#B8963A";
const GRID = "#cfc8b0";
const INK = "#1a1a1a";


export function PrintRadar({ areas }: { areas: Record<string, number> }) {
  const data = Object.entries(areas).map(([area, valor]) => ({
    area: AREA_LABELS[area] ?? area,
    nivel: valor,
  }));
  return (
    <RadarChart width={340} height={250} data={data} outerRadius={85}>
      <PolarGrid stroke={GRID} />
      <PolarAngleAxis dataKey="area" tick={{ fill: INK, fontSize: 11, fontWeight: 700 }} />
      <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fill: "#6b6450", fontSize: 9 }} axisLine={false} />
      <Radar dataKey="nivel" stroke={NAVY} strokeWidth={2} fill={GOLD} fillOpacity={0.5} isAnimationActive={false} />
    </RadarChart>
  );
}

export function PrintCompareBar({
  data,
}: {
  data: { metrica: string; jugador: number; equipo: number }[];
}) {
  return (
    <BarChart width={680} height={220} data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
      <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="metrica" tick={{ fill: INK, fontSize: 10 }} />
      <YAxis tick={{ fill: INK, fontSize: 10 }} width={32} />
      <Legend wrapperStyle={{ fontSize: 11, color: INK }} />
      <Bar dataKey="jugador" name="Jugador" fill={NAVY} isAnimationActive={false} />
      <Bar dataKey="equipo" name="Promedio del equipo" fill={GOLD} isAnimationActive={false} />
    </BarChart>
  );
}

export function PrintLine({ data }: { data: { fecha: string; valor: number }[] }) {
  const ordenado = [...data].reverse(); // el historial viene del más reciente al más viejo
  return (
    <LineChart width={330} height={150} data={ordenado} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
      <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="fecha" tick={{ fill: INK, fontSize: 9 }} />
      <YAxis tick={{ fill: INK, fontSize: 9 }} width={36} />
      <Line type="monotone" dataKey="valor" stroke={NAVY} strokeWidth={2.5} dot={{ r: 3, fill: GOLD, stroke: NAVY }} isAnimationActive={false} />
    </LineChart>
  );
}
