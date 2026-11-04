// Pinta los dibujos de un highlight en un canvas (para armar el video final).
// Es la misma geometría que components/AnnotationLayer.tsx (SVG), escalada al ancho del canvas.
import { Anno, isActive, inkFor } from "@/lib/annotations";

const SW = 6;
const FONT = 38;

const opacity = (a: Anno, now: number) => Math.max(0, Math.min(1, (a.t + a.d - now) / 0.25));

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawAnnotations(ctx: CanvasRenderingContext2D, annos: Anno[], now: number, W: number, H: number) {
  const s = W / 1000;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const a of annos) {
    if (!isActive(a, now)) continue;
    const op = opacity(a, now);
    if (op <= 0) continue;
    const P = a.pts.map(([x, y]) => [x * W, y * H] as [number, number]);
    const c = a.color;
    const strokeShape = (path: () => void, fillAlpha = 0) => {
      // sombra suave para que se vea sobre cualquier fondo
      ctx.globalAlpha = op * 0.35;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = (SW + 5) * s;
      path();
      ctx.stroke();
      if (fillAlpha > 0) {
        ctx.globalAlpha = op * fillAlpha;
        ctx.fillStyle = c;
        path();
        ctx.fill();
      }
      ctx.globalAlpha = op;
      ctx.strokeStyle = c;
      ctx.lineWidth = SW * s;
      path();
      ctx.stroke();
    };

    if (a.type === "arrow" && P.length >= 2) {
      const [[x0, y0], [x1, y1]] = P;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const len = Math.max(34, SW * 6) * s;
      const ax = x1 - len * Math.cos(ang - 0.45);
      const ay = y1 - len * Math.sin(ang - 0.45);
      const bx = x1 - len * Math.cos(ang + 0.45);
      const by = y1 - len * Math.sin(ang + 0.45);
      const lx = x1 - len * 0.6 * Math.cos(ang);
      const ly = y1 - len * 0.6 * Math.sin(ang);
      const head = () => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.closePath();
      };
      strokeShape(() => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(lx, ly);
      });
      ctx.globalAlpha = op * 0.35;
      ctx.fillStyle = "#000";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 5 * s;
      head();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = op;
      ctx.fillStyle = c;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2 * s;
      head();
      ctx.fill();
      ctx.stroke();
    } else if (a.type === "rect" && P.length >= 2) {
      const x = Math.min(P[0][0], P[1][0]);
      const y = Math.min(P[0][1], P[1][1]);
      const w = Math.abs(P[1][0] - P[0][0]);
      const h = Math.abs(P[1][1] - P[0][1]);
      strokeShape(() => roundRectPath(ctx, x, y, w, h, 6 * s), 0.1);
    } else if (a.type === "circle" && P.length >= 2) {
      const cx = (P[0][0] + P[1][0]) / 2;
      const cy = (P[0][1] + P[1][1]) / 2;
      const rx = Math.abs(P[1][0] - P[0][0]) / 2;
      const ry = Math.abs(P[1][1] - P[0][1]) / 2;
      strokeShape(() => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
      }, 0.1);
    } else if (a.type === "free" && P.length >= 2) {
      strokeShape(() => {
        ctx.beginPath();
        P.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      });
    } else if (a.type === "text" && P.length >= 1) {
      const text = a.text ?? "";
      const w = (text.length * FONT * 0.58 + 28) * s;
      const h = (FONT + 20) * s;
      const x = Math.min(P[0][0], W - w);
      const y = Math.min(P[0][1], H - h);
      ctx.globalAlpha = op;
      roundRectPath(ctx, x, y, w, h, 10 * s);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.globalAlpha = op * 0.25;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3 * s;
      ctx.stroke();
      ctx.globalAlpha = op;
      ctx.fillStyle = inkFor(c);
      ctx.font = `800 ${FONT * s}px Montserrat, Arial, sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, x + 14 * s, y + h / 2 + FONT * s * 0.35);
    }
  }
  ctx.restore();
}
