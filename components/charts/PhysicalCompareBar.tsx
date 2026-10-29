"use client";

// components/charts/PhysicalCompareBar.tsx
//
// Compara el resultado más reciente del jugador en cada métrica contra
// el promedio del equipo en esa misma métrica.

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function PhysicalCompareBar({
  data,
}: {
  data: { metrica: string; jugador: number; equipo: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#2467A8" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="metrica" tick={{ fill: "#A9C0DD", fontSize: 10 }} />
        <YAxis tick={{ fill: "#A9C0DD", fontSize: 10 }} width={32} />
        <Tooltip
          contentStyle={{ background: "#0A2F5C", border: "1px solid #2467A8", borderRadius: 8 }}
          labelStyle={{ color: "#FFFFFF" }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#A9C0DD" }} />
        <Bar dataKey="jugador" name="Jugador" fill="#F9E547" radius={[4, 4, 0, 0]} />
        <Bar dataKey="equipo" name="Promedio del equipo" fill="#2F74B8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
