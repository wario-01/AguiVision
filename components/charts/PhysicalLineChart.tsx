"use client";

// components/charts/PhysicalLineChart.tsx
//
// Progreso en el tiempo de UNA métrica física (ej. Sprint 20m) a lo
// largo de todos los resultados guardados del jugador.

import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function PhysicalLineChart({
  data,
  unidad,
}: {
  data: { fecha: string; valor: number }[];
  unidad: string;
}) {
  // El historial viene del más reciente al más viejo — para la línea
  // de progreso lo queremos en orden cronológico.
  const ordenado = [...data].reverse();

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={ordenado} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#234070" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="fecha" tick={{ fill: "#8CA0C7", fontSize: 10 }} />
        <YAxis tick={{ fill: "#8CA0C7", fontSize: 10 }} width={36} />
        <Tooltip
          contentStyle={{ background: "#12284D", border: "1px solid #234070", borderRadius: 8 }}
          labelStyle={{ color: "#F5EFD6" }}
          formatter={(value: number) => [`${value} ${unidad}`, "Resultado"]}
        />
        <Line type="monotone" dataKey="valor" stroke="#F0D875" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
