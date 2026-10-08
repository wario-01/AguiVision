"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LOW_THRESHOLD } from "@/lib/asistencia";

export default function AttendanceMonthlyChart({
  data,
}: {
  data: { label: string; pct: number | null; n: number }[];
}) {
  const rows = data.map((d) => ({ ...d, pct: d.pct ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#234070" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#8CA0C7", fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: "#8CA0C7", fontSize: 10 }} width={34} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip
          contentStyle={{ background: "#12284D", border: "1px solid #234070", borderRadius: 8 }}
          labelStyle={{ color: "#F5EFD6" }}
          formatter={(v: number, _n: string, item: any) => [`${v}% (${item.payload.n} eventos)`, "Asistencia"]}
        />
        <ReferenceLine y={LOW_THRESHOLD} stroke="#E6483C" strokeDasharray="4 4" />
        <Bar dataKey="pct" fill="#F0D875" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
