"use client";

// Ficha técnica (tarjeta estilo FIFA) con colores institucionales y efecto holográfico.
// Es un SVG: se ve igual en pantalla e impresa. En pantalla se inclina y brilla con el dedo/mouse.
import React, { useEffect, useRef, useState } from "react";
import { FichaStat } from "@/lib/ficha-shared";

const BLUE = "#003C71";
const YEL = "#F9E547";
const RED = "#E03C31";
const PHOTO = "M106 268 L106 106 A64 64 0 0 1 234 106 L234 268 Z";
const SHIELD =
  "M130 10 C150 10 160 22 190 24 L236 30 C244 32 246 38 246 46 L246 380 C246 430 200 470 130 510 C60 470 14 430 14 380 L14 46 C14 38 16 32 24 30 L70 24 C100 22 110 10 130 10Z";

export default function PlayerCard({ uid, ovr, pos, team, name, sub, photoUrl, stats }: { uid: string; ovr: number | null; pos: string; team: string; name: string; sub: string; photoUrl?: string | null; stats: FichaStat[]; }) {
  const ref = useRef<SVGSVGElement>(null);
  const [p, setP] = useState<{ x: number; y: number } | null>(null);
  const touching = useRef(false);
  const gotOrientation = useRef(false);
  const toXY = (px: number, py: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    setP({ x: ((px - r.left) / r.width) * 260, y: ((py - r.top) / r.height) * 520 });
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    touching.current = true;
    toXY(e.clientX, e.clientY);
  };
  const leave = () => {
    touching.current = false;
    setP(null);
  };

  // En el celular no hay "mouse": el brillo se mueve con la inclinación del teléfono
  // y, si no la hay, con el scroll de la página.
  useEffect(() => {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const onOrient = (e: DeviceOrientationEvent) => {
      if (touching.current || e.gamma == null || e.beta == null) return;
      gotOrientation.current = true;
      setP({ x: 130 + (clamp(e.gamma, -25, 25) / 25) * 130, y: 260 + (clamp(e.beta - 45, -25, 25) / 25) * 260 });
    };
    const onScroll = () => {
      if (touching.current || gotOrientation.current) return;
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const t = clamp((r.top + r.height / 2) / window.innerHeight, 0, 1); // 0 arriba, 1 abajo
      setP({ x: 40 + t * 180, y: 60 + t * 400 });
    };
    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true }); // el contenido de la app hace scroll dentro de su propio contenedor
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // iPhone: el permiso de movimiento solo se puede pedir al tocar la tarjeta.
  const askMotion = () => {
    const D: any = typeof window !== "undefined" ? (window as any).DeviceOrientationEvent : null;
    if (D && typeof D.requestPermission === "function") D.requestPermission().catch(() => {});
  };
  const dx = p ? p.x - 130 : 0;
  const dy = p ? p.y - 260 : 0;
  const nameSize = name.length <= 9 ? 33 : name.length <= 12 ? 27 : name.length <= 16 ? 21 : 17;
  const rays = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const a = -0.2 + i * 0.62; const b = a + 0.22;
    return `170,130 ${(170 + 300 * Math.cos(a)).toFixed(1)},${(130 + 300 * Math.sin(a)).toFixed(1)} ${(170 + 300 * Math.cos(b)).toFixed(1)},${(130 + 300 * Math.sin(b)).toFixed(1)}`;
  });
  return (
    <svg
      ref={ref}
      viewBox="0 0 260 520"
      width="100%"
      onPointerMove={move}
      onPointerDown={(e) => { askMotion(); move(e); }}
      onPointerLeave={leave}
      onPointerUp={(e) => { if (e.pointerType !== "mouse") leave(); }}
      onPointerCancel={leave}
      style={{
        display: "block",
        fontFamily: "'Avant Garde', 'Century Gothic', Arial, sans-serif",
        touchAction: "pan-y",
        transform: p ? `perspective(700px) rotateY(${(dx / 130) * 9}deg) rotateX(${(-dy / 260) * 9}deg)` : "perspective(700px)",
        transition: p ? "transform .08s linear" : "transform .4s ease-out",
      }}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF9B8" /><stop offset=".5" stopColor={YEL} /><stop offset="1" stopColor="#E8CF1F" />
        </linearGradient>
        <linearGradient id={`bl-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B5399" /><stop offset="1" stopColor="#002A52" />
        </linearGradient>
        <linearGradient id={`sh-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".38" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`ho-${uid}`} gradientUnits="userSpaceOnUse" x1={0 - dx * 1.2} y1={40 - dy * 0.6} x2={260 - dx * 1.2} y2={300 - dy * 0.6}>
          <stop offset="0" stopColor="#5FE3FF" stopOpacity=".5" /><stop offset=".22" stopColor="#FF8AD8" stopOpacity=".5" /><stop offset=".45" stopColor="#FFF38A" stopOpacity=".45" />
          <stop offset=".68" stopColor="#7DF2B8" stopOpacity=".5" /><stop offset=".86" stopColor="#8FAEFF" stopOpacity=".5" /><stop offset="1" stopColor="#FF8AD8" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id={`sw-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".6" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`sp-${uid}`} gradientUnits="userSpaceOnUse" cx={p ? p.x : 130} cy={p ? p.y : 200} r="120">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".5" stopColor="#fff" stopOpacity=".18" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`cl-${uid}`}><path d={SHIELD} /></clipPath>
        <clipPath id={`ph-${uid}`}><path d={PHOTO} /></clipPath>
      </defs>
      <path d={SHIELD} fill={`url(#bg-${uid})`} />
      <g clipPath={`url(#cl-${uid})`}>
        <g opacity=".3">{rays.map((p, i) => (<polygon key={i} points={p} fill="#fff" />))}</g>
        <polygon points="0,150 260,20 260,120 0,260" fill={`url(#sh-${uid})`} />
        {/* panel azul inferior con corte diagonal */}
        <polygon points="0,352 260,318 260,520 0,520" fill={`url(#bl-${uid})`} />
        <polygon points="0,346 260,312 260,320 0,354" fill={RED} />
        <polygon points="0,354 260,320 260,324 0,358" fill="#fff" opacity=".85" />
        <polygon points="260,40 196,22 260,22" fill={RED} />
      </g>

      <g clipPath={`url(#cl-${uid})`} style={{ pointerEvents: "none" }}>
        <rect x="0" y="0" width="260" height="330" fill={`url(#ho-${uid})`} opacity=".8" />
        <rect x="0" y="330" width="260" height="190" fill={`url(#ho-${uid})`} opacity=".22" />
        <g opacity=".14">
          {[0, 1, 2, 3, 4, 5].map((i) => (<rect key={i} x={-40 + i * 60} y="-20" width="14" height="560" fill="#fff" transform="rotate(25 130 260)" />))}
        </g>
        {!p && <rect className="holo-sweep" x="0" y="0" width="80" height="520" fill={`url(#sw-${uid})`} />}
        {p && <rect x="0" y="0" width="260" height="520" fill={`url(#sp-${uid})`} opacity=".9" />}
        {[[210,60,5],[48,236,4],[198,246,3],[96,320,3],[222,300,4]].map(([x,y,r],i)=>(<path key={i} d={`M${x} ${y-r*2} L${x+r*.5} ${y-r*.5} L${x+r*2} ${y} L${x+r*.5} ${y+r*.5} L${x} ${y+r*2} L${x-r*.5} ${y+r*.5} L${x-r*2} ${y} L${x-r*.5} ${y-r*.5}Z`} fill="#fff" opacity=".85" />))}
      </g>
      <path d={SHIELD} fill="none" stroke={BLUE} strokeWidth="12" clipPath={`url(#cl-${uid})`} />
      <path d={SHIELD} fill="none" stroke="#fff" strokeWidth="1.5" opacity=".9" transform="translate(130 260) scale(.955) translate(-130 -260)" />
      {/* valoración */}
      <text x="32" y="90" fontSize="50" fill={BLUE}>{ovr ?? "--"}</text>
      <text x="34" y="116" fontSize="19" fill={BLUE} letterSpacing="2">{pos}</text>
      <rect x="34" y="125" width="34" height="3" fill={RED} />
      <image href="/logo.png" x="30" y="136" width="44" height="44" />
      <text x="52" y="202" fontSize="13" fill={BLUE} textAnchor="middle" letterSpacing="1">{team}</text>

      {/* foto */}
      <path d={PHOTO} fill="#FFFBD0" opacity=".7" />
      {photoUrl ? (
        <image href={photoUrl} x="106" y="42" width="128" height="226" preserveAspectRatio="xMidYMin slice" clipPath={`url(#ph-${uid})`} />
      ) : (
        <g clipPath={`url(#ph-${uid})`}>
          <circle cx="170" cy="112" r="34" fill={BLUE} />
          <path d="M100 280 C102 205 134 172 170 172 C206 172 236 205 238 280Z" fill={BLUE} />
        </g>
      )}
      <path d={PHOTO} fill="none" stroke="#fff" strokeWidth="3" />
      <path d={PHOTO} fill="none" stroke={BLUE} strokeWidth="1.5" />

      {/* nombre */}
      <text x="130" y="304" fontSize={nameSize} fill={BLUE} textAnchor="middle" letterSpacing="1">{name}</text>
      <text x="130" y="324" fontSize="11" fill={BLUE} textAnchor="middle" fontFamily="Montserrat, Arial, sans-serif" fontWeight="700" opacity=".85">{sub}</text>

      {/* datos */}
      <line x1="130" y1="372" x2="130" y2="440" stroke="#fff" opacity=".3" />
      {stats.map((s, i) => {
        const col = i < 3 ? 0 : 1; const row = i % 3;
        const x = col ? 172 : 86; const y = 392 + row * 31;
        return (
          <g key={s.label}>
            <text x={x} y={y} fontSize="26" fill={YEL} textAnchor="end">{s.value ?? "--"}</text>
            <text x={x + 7} y={y} fontSize="14" fill="#fff" letterSpacing="1">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
