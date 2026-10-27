// Recibo oficial de Nido Aguila USA Austin: mismo diseño del recibo de papel
// (logo, franjas de las esquinas, NAME / TEAM / DESCRIPTION, TOTAL / AMOUNT /
// BALANCE, forma de pago, RECEIVED BY, DATE y RECEIPT#), dibujado en SVG para
// que se vea igual en pantalla y al guardar como PDF.

import { money, receiptNo, REASONS, Reason, Method } from "@/lib/finance-shared";

const NAVY = "#14284B";
const BLUE = "#2B4F9E";
const RED = "#E0585A";
const GOLD = "#F2C85B";

export type ReceiptData = {
  number: number;
  playerName: string;
  teamName: string;
  reason: Reason;
  description: string;
  season: string;
  totalCents: number;
  amountCents: number;
  balanceCents: number;
  method: Method;
  issuedBy: string;
  date: string; // YYYY-MM-DD
  voided?: boolean;
};

function usDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${m}/${d}/${y}`;
}

// Texto que se achica si es largo para no salirse de la línea.
function Fit({ x, y, max, size, children, ...rest }: { x: number; y: number; max: number; size: number; children: string } & React.SVGProps<SVGTextElement>) {
  const approx = children.length * size * 0.56;
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      {...(approx > max ? { textLength: max, lengthAdjust: "spacingAndGlyphs" as const } : {})}
      {...rest}
    >
      {children}
    </text>
  );
}

export default function ReceiptCard({ r }: { r: ReceiptData }) {
  const line1 = `${REASONS[r.reason]} ${r.season}`;
  const line2 = r.description;
  const font = "Arial Black, Arial, Helvetica, sans-serif";
  return (
    <svg viewBox="0 0 600 900" width="100%" role="img" aria-label={`Recibo ${receiptNo(r.number)}`} style={{ display: "block", background: "#FFFDF7" }}>
      <defs>
        <clipPath id="card">
          <rect x="22" y="22" width="556" height="856" rx="26" />
        </clipPath>
        <clipPath id="logoClip">
          <circle cx="300" cy="150" r="66" />
        </clipPath>
      </defs>

      {/* franjas de las esquinas */}
      <g clipPath="url(#card)">
        <polygon points="22,22 196,22 22,300" fill={NAVY} />
        <polygon points="22,22 160,22 22,236" fill={BLUE} />
        <polygon points="22,22 118,22 22,170" fill={RED} />
        <polygon points="22,22 78,22 22,108" fill={GOLD} />
        <polygon points="578,22 404,22 578,300" fill={NAVY} />
        <polygon points="578,22 440,22 578,236" fill={BLUE} />
        <polygon points="578,22 482,22 578,170" fill={RED} />
        <polygon points="578,22 522,22 578,108" fill={GOLD} />
      </g>
      {/* "escudo" blanco que recorta las franjas */}
      <polygon points="40,330 120,200 214,40 386,40 480,200 560,330 560,860 40,860" fill="#FFFDF7" />
      <rect x="22" y="22" width="556" height="856" rx="26" fill="none" stroke={NAVY} strokeWidth="6" />

      {/* logo y encabezado */}
      <circle cx="300" cy="150" r="70" fill={NAVY} />
      <image href="/logo.png" x="234" y="84" width="132" height="132" clipPath="url(#logoClip)" preserveAspectRatio="xMidYMid slice" />
      <text x="300" y="255" textAnchor="middle" fontSize="25" fontWeight="900" fill={NAVY} fontFamily={font}>AUSTIN TX</text>
      <text x="300" y="300" textAnchor="middle" fontSize="33" fontWeight="900" fontStyle="italic" fill={NAVY} fontFamily={font}>NIDO AGUILA USA AUSTIN</text>
      <text x="300" y="344" textAnchor="middle" fontSize="38" fontWeight="900" fontStyle="italic" fill="#8E9CA0" fontFamily={font} letterSpacing="2">RECEIPT</text>

      {/* datos */}
      <g fontFamily={font} fill={NAVY} fontWeight="900" fontSize="22">
        <text x="56" y="410">NAME:</text>
        <text x="56" y="458">TEAM:</text>
        <text x="56" y="506">DESCRIPTION:</text>
      </g>
      <g stroke={NAVY} strokeWidth="2">
        <line x1="150" y1="414" x2="548" y2="414" />
        <line x1="140" y1="462" x2="548" y2="462" />
        <line x1="236" y1="510" x2="548" y2="510" />
        <line x1="56" y1="552" x2="548" y2="552" />
      </g>
      <g fontFamily="Arial, Helvetica, sans-serif" fill="#111" fontWeight="700">
        <Fit x={158} y={408} max={384} size={23}>{r.playerName}</Fit>
        <Fit x={148} y={456} max={394} size={23}>{r.teamName}</Fit>
        <Fit x={244} y={504} max={298} size={21}>{line1}</Fit>
        <Fit x={60} y={546} max={484} size={21}>{line2}</Fit>
      </g>

      {/* montos */}
      <g fontFamily={font} fill={NAVY} fontWeight="900" fontSize="22">
        <text x="56" y="610">TOTAL</text>
        <text x="56" y="668">AMOUNT</text>
        <text x="56" y="726">BALANCE</text>
      </g>
      {[580, 638, 696].map((y, i) => {
        const v = [r.totalCents, r.amountCents, r.balanceCents][i];
        return (
          <g key={y}>
            <rect x="190" y={y} width="206" height="42" rx="9" fill="#E4E7EA" stroke={NAVY} strokeWidth="3" />
            <text x="204" y={y + 30} fontSize="24" fontWeight="900" fill={NAVY} fontFamily={font}>$</text>
            <text x="384" y={y + 30} textAnchor="end" fontSize="23" fontWeight="800" fill="#111" fontFamily="Arial, Helvetica, sans-serif">
              {money(v).replace("$", "")}
            </text>
          </g>
        );
      })}

      {/* forma de pago */}
      {(
        [
          ["cash", "CASH", 603],
          ["zelle", "ZELLE", 665],
        ] as const
      ).map(([key, label, cy]) => (
        <g key={key}>
          <circle cx="440" cy={cy} r="24" fill="none" stroke={NAVY} strokeWidth="3" />
          {r.method === key && <circle cx="440" cy={cy} r="14" fill={NAVY} />}
          <text x="478" y={cy + 8} fontSize="22" fontWeight="900" fill={NAVY} fontFamily={font}>{label}</text>
        </g>
      ))}

      {/* firma / fecha / número */}
      <text x="56" y="782" fontSize="22" fontWeight="900" fill={NAVY} fontFamily={font}>RECEIVED BY:</text>
      <line x1="240" y1="786" x2="548" y2="786" stroke={NAVY} strokeWidth="2" />
      <Fit x={248} y={780} max={296} size={23} fontWeight={700} fill="#111" fontFamily="Arial, Helvetica, sans-serif">{r.issuedBy}</Fit>

      <text x="56" y="830" fontSize="22" fontWeight="900" fill={NAVY} fontFamily={font}>DATE:</text>
      <line x1="140" y1="834" x2="320" y2="834" stroke={NAVY} strokeWidth="2" />
      <text x="146" y="828" fontSize="22" fontWeight="700" fill="#111" fontFamily="Arial, Helvetica, sans-serif">{usDate(r.date)}</text>
      <text x="338" y="830" fontSize="22" fontWeight="900" fill={NAVY} fontFamily={font}>RECEIPT#</text>
      <text x="470" y="830" fontSize="30" fontWeight="900" fill="#C4242F" fontFamily={font}>{receiptNo(r.number)}</text>

      <text x="300" y="862" textAnchor="middle" fontSize="15" fill="#6B7A8C" fontFamily="Arial, Helvetica, sans-serif" fontStyle="italic">“SIN DISCIPLINA NO HAY ÉXITO”</text>

      {r.voided && (
        <g transform="rotate(-24 300 520)">
          <rect x="90" y="470" width="420" height="96" rx="10" fill="none" stroke="#C4242F" strokeWidth="8" />
          <text x="300" y="540" textAnchor="middle" fontSize="64" fontWeight="900" fill="#C4242F" fontFamily={font}>ANULADO</text>
        </g>
      )}
    </svg>
  );
}
