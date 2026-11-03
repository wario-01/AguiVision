// Dibuja los dibujos activos en el instante `now` encima del video.
// El SVG usa un ancho fijo de 1000 unidades y el alto según la proporción del video,
// así los trazos escalan parejo en cualquier pantalla.
import React from "react";
import { Anno, isActive, inkFor } from "@/lib/annotations";

const W = 1000;
const SW = 6; // grosor de línea
const FONT = 38;

export function annoOpacity(a: Anno, now: number) {
  // Aparece de golpe (así se ve al pausar justo en ese instante) y se desvanece al terminar.
  const fadeOut = (a.t + a.d - now) / 0.25;
  return Math.max(0, Math.min(1, fadeOut));
}

function Shape({ a, aspect, ghost }: { a: Anno; aspect: number; ghost?: boolean }) {
  const H = W / aspect;
  const P = a.pts.map(([x, y]) => [x * W, y * H] as [number, number]);
  const c = a.color;
  const common = { stroke: c, strokeWidth: SW, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const halo = { stroke: "#000", strokeOpacity: 0.35, strokeWidth: SW + 5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const dash = ghost ? { strokeDasharray: "14 10" } : {};

  if (a.type === "arrow" && P.length >= 2) {
    const [[x0, y0], [x1, y1]] = P;
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.max(34, SW * 6);
    const hx = (k: number) => [x1 - len * Math.cos(ang - k), y1 - len * Math.sin(ang - k)];
    const [ax, ay] = hx(0.45);
    const [bx, by] = hx(-0.45);
    const lx = x1 - len * 0.6 * Math.cos(ang);
    const ly = y1 - len * 0.6 * Math.sin(ang);
    const head = `${x1},${y1} ${ax},${ay} ${bx},${by}`;
    return (
      <g {...dash}>
        <line x1={x0} y1={y0} x2={lx} y2={ly} {...halo} />
        <polygon points={head} fill="#000" fillOpacity={0.35} stroke="#000" strokeOpacity={0.35} strokeWidth={5} strokeLinejoin="round" />
        <line x1={x0} y1={y0} x2={lx} y2={ly} {...common} />
        <polygon points={head} fill={c} stroke={c} strokeWidth={2} strokeLinejoin="round" />
      </g>
    );
  }
  if (a.type === "rect" && P.length >= 2) {
    const x = Math.min(P[0][0], P[1][0]);
    const y = Math.min(P[0][1], P[1][1]);
    const w = Math.abs(P[1][0] - P[0][0]);
    const h = Math.abs(P[1][1] - P[0][1]);
    return (
      <g {...dash}>
        <rect x={x} y={y} width={w} height={h} rx={6} {...halo} />
        <rect x={x} y={y} width={w} height={h} rx={6} {...common} fill={c} fillOpacity={0.1} />
      </g>
    );
  }
  if (a.type === "circle" && P.length >= 2) {
    const cx = (P[0][0] + P[1][0]) / 2;
    const cy = (P[0][1] + P[1][1]) / 2;
    const rx = Math.abs(P[1][0] - P[0][0]) / 2;
    const ry = Math.abs(P[1][1] - P[0][1]) / 2;
    return (
      <g {...dash}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...halo} />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...common} fill={c} fillOpacity={0.1} />
      </g>
    );
  }
  if (a.type === "free" && P.length >= 2) {
    const d = P.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return (
      <g {...dash}>
        <path d={d} {...halo} />
        <path d={d} {...common} />
      </g>
    );
  }
  if (a.type === "text" && P.length >= 1) {
    const text = a.text ?? "";
    const w = text.length * FONT * 0.58 + 28;
    const h = FONT + 20;
    const x = Math.min(P[0][0], W - w);
    const y = Math.min(P[0][1], H - h);
    return (
      <g {...dash}>
        <rect x={x} y={y} width={w} height={h} rx={10} fill={c} stroke="#000" strokeOpacity={0.25} strokeWidth={3} />
        <text x={x + 14} y={y + h / 2 + FONT * 0.35} fontSize={FONT} fontWeight={800} fill={inkFor(c)} fontFamily="Montserrat, Arial, sans-serif">
          {text}
        </text>
      </g>
    );
  }
  return null;
}

export default function AnnotationLayer({
  annos,
  aspect,
  now,
  selectedId,
  extra,
}: {
  annos: Anno[];
  aspect: number;
  now: number;
  selectedId?: string | null;
  extra?: Anno[]; // dibujos en construcción (se ven completos)
}) {
  const H = W / aspect;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden="true"
    >
      {annos.map((a) => {
        if (isActive(a, now)) {
          return (
            <g key={a.id} opacity={annoOpacity(a, now)}>
              <Shape a={a} aspect={aspect} />
            </g>
          );
        }
        // El dibujo seleccionado se ve "fantasma" aunque no le toque aparecer en este segundo.
        if (a.id === selectedId) {
          return (
            <g key={a.id} opacity={0.35}>
              <Shape a={a} aspect={aspect} ghost />
            </g>
          );
        }
        return null;
      })}
      {(extra ?? []).map((a) => (
        <g key={a.id}>
          <Shape a={a} aspect={aspect} />
        </g>
      ))}
    </svg>
  );
}
