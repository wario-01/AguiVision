// Ficha técnica del jugador (tarjeta). Es un SVG: se ve igual en pantalla e impresa.
// Colores institucionales: dorado con rayos, texto azul marino y franja azul/roja/amarilla.

import { FichaStat } from "@/lib/ficha-shared";

// Zona de la foto: un arco grande que llena el centro-derecha de la tarjeta.
const PHOTO = "M102 252 L102 112 A70 70 0 0 1 242 112 L242 252 Z";

const SHIELD =
  "M130 10 C150 10 160 22 190 24 L236 30 C244 32 246 38 246 46 L246 380 C246 430 200 470 130 510 C60 470 14 430 14 380 L14 46 C14 38 16 32 24 30 L70 24 C100 22 110 10 130 10Z";

export default function PlayerCard({
  uid,
  ovr,
  pos,
  team,
  name,
  sub,
  photoUrl,
  stats,
}: {
  uid: string; // identificador único si hay varias tarjetas en la misma página
  ovr: number | null;
  pos: string;
  team: string;
  name: string; // ya en formato de tarjeta (apellido en mayúsculas)
  sub: string;
  photoUrl?: string | null;
  stats: FichaStat[];
}) {
  const nameSize = name.length <= 9 ? 36 : name.length <= 12 ? 29 : name.length <= 16 ? 23 : 19;
  const rays = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const a = i * 0.9;
    const b = a + 0.3;
    return `150,150 ${(150 + 260 * Math.cos(a)).toFixed(1)},${(150 + 260 * Math.sin(a)).toFixed(1)} ${(150 + 260 * Math.cos(b)).toFixed(1)},${(150 + 260 * Math.sin(b)).toFixed(1)}`;
  });

  return (
    <svg viewBox="0 0 260 520" width="100%" style={{ display: "block", fontFamily: "Oswald, 'Arial Narrow', sans-serif" }}>
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE98F" />
          <stop offset=".55" stopColor="#F2C94C" />
          <stop offset="1" stopColor="#C99A1E" />
        </linearGradient>
        <clipPath id={`cl-${uid}`}>
          <path d={SHIELD} />
        </clipPath>
        <clipPath id={`ph-${uid}`}>
          <path d={PHOTO} />
        </clipPath>
      </defs>

      <path d={SHIELD} fill={`url(#bg-${uid})`} stroke="#14284B" strokeWidth="3" />
      <g clipPath={`url(#cl-${uid})`}>
        <circle cx="150" cy="150" r="120" fill="#FFF6CC" opacity=".4" />
        <g opacity=".24">
          {rays.map((p, i) => (
            <polygon key={i} points={p} fill="#fff" />
          ))}
        </g>
        <polygon points="246,46 186,28 246,28" fill="#2B4F9E" />
        <polygon points="246,28 214,28 246,60" fill="#E0585A" />
        <rect x="14" y="324" width="76" height="5" fill="#2B4F9E" />
        <rect x="90" y="324" width="76" height="5" fill="#E0585A" />
        <rect x="166" y="324" width="80" height="5" fill="#F2C85B" />
      </g>

      <text x="40" y="88" fontSize="52" fontWeight="700" fill="#14284B">
        {ovr ?? "--"}
      </text>
      <text x="42" y="112" fontSize="20" fontWeight="600" fill="#0A1830" letterSpacing="2">
        {pos}
      </text>
      <line x1="40" y1="122" x2="76" y2="122" stroke="#14284B" opacity=".5" />
      <image href="/logo.png" x="38" y="130" width="40" height="40" />
      <text x="58" y="196" fontSize="14" fontWeight="600" fill="#3A3115" textAnchor="middle" letterSpacing="1">
        {team}
      </text>

      <path d={PHOTO} fill="#FFF6CC" opacity=".6" />
      {photoUrl ? (
        <image href={photoUrl} x="102" y="42" width="140" height="210" preserveAspectRatio="xMidYMin slice" clipPath={`url(#ph-${uid})`} />
      ) : (
        <g clipPath={`url(#ph-${uid})`}>
          <circle cx="172" cy="116" r="38" fill="#14284B" />
          <path d="M96 260 C98 190 134 170 172 170 C210 170 246 190 248 260Z" fill="#14284B" />
        </g>
      )}
      <path d={PHOTO} fill="none" stroke="#14284B" strokeWidth="2" />

      <text x="130" y="290" fontSize={nameSize} fontWeight="700" fill="#0A1830" textAnchor="middle" letterSpacing="1">
        {name}
      </text>
      <text x="130" y="312" fontSize="13" fontWeight="500" fill="#3A3115" textAnchor="middle" fontFamily="Manrope, sans-serif">
        {sub}
      </text>

      <line x1="132" y1="344" x2="132" y2="410" stroke="#14284B" opacity=".35" />
      {stats.map((s, i) => {
        const col = i < 3 ? 0 : 1;
        const row = i % 3;
        const x = col ? 170 : 82;
        const y = 388 + row * 32;
        return (
          <g key={s.label}>
            <text x={x} y={y} fontSize="24" fontWeight="700" fill="#14284B" textAnchor="end">
              {s.value ?? "--"}
            </text>
            <text x={x + 7} y={y} fontSize="16" fontWeight="600" fill="#0A1830" letterSpacing="1">
              {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
