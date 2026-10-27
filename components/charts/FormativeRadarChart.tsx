"use client";

// components/charts/FormativeRadarChart.tsx
//
// Gráfica de radar con el nivel (1-5) por área del ciclo formativo más
// reciente del jugador.

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { AREA_LABELS } from "@/lib/eval-shared";


const NIVEL_LABELS = ["", "Emergente", "En desarrollo", "Consistente", "Autónomo", "Competente"];

export default function FormativeRadarChart({
  areas,
  previous,
}: {
  areas: Record<string, number>;
  previous?: Record<string, number> | null;
}) {
  const data = Object.entries(areas).map(([area, valor]) => ({
    area: AREA_LABELS[area] ?? area,
    nivel: valor,
    anterior: previous?.[area] ?? undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="#234070" />
        <PolarAngleAxis dataKey="area" tick={{ fill: "#8CA0C7", fontSize: 12, fontWeight: 600 }} />
        <PolarRadiusAxis
          domain={[0, 5]}
          tickCount={6}
          tick={{ fill: "#4A5A7E", fontSize: 10 }}
          tickFormatter={(v) => NIVEL_LABELS[v] ?? ""}
        />
        {previous && (
          <Radar dataKey="anterior" stroke="#8CA0C7" strokeDasharray="5 4" fill="#8CA0C7" fillOpacity={0.12} />
        )}
        <Radar dataKey="nivel" stroke="#F0D875" fill="#F0D875" fillOpacity={0.35} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
