"use client";

// components/charts/BmiChart.tsx
//
// IMC del jugador sobre las curvas de percentiles del CDC (5, 50, 85 y 95)
// para su sexo. La curva se calcula con la tabla oficial del CDC.

import { useMemo } from "react";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bmiAtPercentile, Sex } from "@/lib/bmi";

export default function BmiChart({
  sex,
  points,
  playerLabel = "Jugador",
}: {
  playerLabel?: string;
  sex: Sex;
  points: { ageMonths: number; bmi: number }[];
}) {
  const { curves, child } = useMemo(() => {
    const ages = points.map((p) => p.ageMonths);
    const min = Math.max(24, Math.floor((Math.min(...ages) - 9) / 3) * 3);
    const max = Math.min(240, Math.ceil((Math.max(...ages) + 9) / 3) * 3);
    const rows: { age: number; p5: number | null; p50: number | null; p85: number | null; p95: number | null }[] = [];
    for (let m = min; m <= max; m += 3) {
      rows.push({
        age: Math.round((m / 12) * 100) / 100,
        p5: bmiAtPercentile(5, sex, m),
        p50: bmiAtPercentile(50, sex, m),
        p85: bmiAtPercentile(85, sex, m),
        p95: bmiAtPercentile(95, sex, m),
      });
    }
    return {
      curves: rows,
      child: points.map((p) => ({ age: Math.round((p.ageMonths / 12) * 100) / 100, bmi: p.bmi })),
    };
  }, [sex, points]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={curves} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#234070" strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="age"
          domain={["dataMin", "dataMax"]}
          tick={{ fill: "#8CA0C7", fontSize: 10 }}
          tickFormatter={(v: number) => `${Math.round(v * 10) / 10}`}
          label={{ value: "Edad (años)", position: "insideBottom", offset: -2, fill: "#8CA0C7", fontSize: 10 }}
          height={36}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fill: "#8CA0C7", fontSize: 10 }}
          width={32}
          tickFormatter={(v: number) => `${Math.round(v)}`}
        />
        <Tooltip
          contentStyle={{ background: "#12284D", border: "1px solid #234070", borderRadius: 8 }}
          labelStyle={{ color: "#F5EFD6" }}
          labelFormatter={(v: number) => `${Math.round(v * 10) / 10} años`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line name="Percentil 5" dataKey="p5" stroke="#8CA0C7" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
        <Line name="Percentil 50" dataKey="p50" stroke="#8CA0C7" dot={false} strokeWidth={1.5} />
        <Line name="Percentil 85" dataKey="p85" stroke="#C9A94E" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
        <Line name="Percentil 95" dataKey="p95" stroke="#E6483C" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
        <Line
          name={playerLabel}
          data={child}
          dataKey="bmi"
          stroke="#F0D875"
          strokeWidth={3}
          dot={{ r: 4, fill: "#F0D875" }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
