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
        <CartesianGrid stroke="#234070" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="metrica" tick={{ fill: "#8CA0C7", fontSize: 10 }} />
        <YAxis tick={{ fill: "#8CA0C7", fontSize: 10 }} width={32} />
        <Tooltip
          contentStyle={{ background: "#12284D", border: "1px solid #234070", borderRadius: 8 }}
          labelStyle={{ color: "#F5EFD6" }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#8CA0C7" }} />
        <Bar dataKey="jugador" name="Jugador" fill="#F0D875" radius={[4, 4, 0, 0]} />
        <Bar dataKey="equipo" name="Promedio del equipo" fill="#2A4A7E" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
