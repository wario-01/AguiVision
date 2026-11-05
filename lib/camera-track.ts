// lib/camera-track.ts
//
// Seguimiento de cámara: mide cuánto se mueve la escena entre un cuadro y el siguiente
// (la cámara del partido se mueve a mano) para que los dibujos se muevan con la escena
// y se queden sobre el mismo jugador o la misma zona de la cancha.
//
// Se guarda como una lista de posiciones acumuladas cada `dt` segundos, en proporción del
// ancho y del alto del video (igual que los dibujos). Solo mide traslación (arriba/abajo/lados);
// no mide acercamientos (zoom) ni giros.

import type { Anno, Pt } from "@/lib/annotations";

export type CamTrack = { dt: number; x: number[]; y: number[] };

const MAX_SAMPLES = 2000;

export function cleanTrack(raw: unknown): CamTrack | null {
  const r = raw as any;
  if (!r || typeof r !== "object") return null;
  const dt = Number(r.dt);
  if (!Number.isFinite(dt) || dt < 0.02 || dt > 2) return null;
  const x = Array.isArray(r.x) ? r.x.map(Number) : [];
  const y = Array.isArray(r.y) ? r.y.map(Number) : [];
  if (x.length < 2 || x.length !== y.length || x.length > MAX_SAMPLES) return null;
  if (![...x, ...y].every((n) => Number.isFinite(n) && Math.abs(n) < 5)) return null;
  const q = (n: number) => Math.round(n * 100000) / 100000;
  return { dt, x: x.map(q), y: y.map(q) };
}

/** Posición acumulada de la escena en el segundo t (interpolada). */
export function camAt(track: CamTrack, t: number): [number, number] {
  const f = Math.max(0, t) / track.dt;
  const i = Math.min(track.x.length - 1, Math.floor(f));
  const j = Math.min(track.x.length - 1, i + 1);
  const k = Math.min(1, f - i);
  return [track.x[i] + (track.x[j] - track.x[i]) * k, track.y[i] + (track.y[j] - track.y[i]) * k];
}

/** Cuánto se debe mover un dibujo en el segundo `now` respecto al segundo en que apareció. */
export function deltaFor(a: Anno, track: CamTrack | null | undefined, now: number): [number, number] {
  if (!track || a.follow === false) return [0, 0];
  const [x1, y1] = camAt(track, now);
  const [x0, y0] = camAt(track, a.t);
  return [x1 - x0, y1 - y0];
}

/** El dibujo tal como se ve en el segundo `now` (con el movimiento de la cámara aplicado). */
export function shiftAnno(a: Anno, track: CamTrack | null | undefined, now: number): Anno {
  const [dx, dy] = deltaFor(a, track, now);
  if (!dx && !dy) return a;
  return { ...a, pts: a.pts.map(([x, y]) => [x + dx, y + dy] as Pt) };
}

// ---------------------------------------------------------------------------------------
// Medición (corre en el navegador, sobre el mp4 del clip)
// ---------------------------------------------------------------------------------------

const AW = 256; // ancho de análisis
const PW = 34; // ancho de cada parche
const PH = 24;
const RX = 14; // búsqueda horizontal (± píxeles de análisis por paso)
const RY = 10;

type Gray = { w: number; h: number; d: Float32Array };

/** Mide el desplazamiento de la escena entre dos cuadros: [dx, dy] en píxeles de análisis, o null si no se pudo. */
export function estimateShift(prev: Gray, cur: Gray): { dx: number; dy: number; n: number } | null {
  const { w, h } = prev;
  const y0 = Math.round(h * 0.16);
  const y1 = Math.round(h * 0.86); // se evita el marcador (arriba) y la marca de agua (abajo)
  const cols = 7;
  const rows = 3;
  const xs: number[] = [];
  const ys: number[] = [];
  const x0 = RX + 2;
  const xEnd = w - PW - RX - 2;
  for (let c = 0; c < cols; c++) xs.push(Math.round(x0 + ((xEnd - x0) * c) / (cols - 1)));
  const yStart = Math.max(y0, RY + 2);
  const yEnd = Math.min(y1 - PH, h - PH - RY - 2);
  for (let r = 0; r < rows; r++) ys.push(Math.round(yStart + ((yEnd - yStart) * r) / Math.max(1, rows - 1)));

  const dxs: number[] = [];
  const dys: number[] = [];
  const nx = 2 * RX + 1;
  const ny = 2 * RY + 1;
  const sad = new Float32Array(nx * ny);
  for (const py of ys) {
    for (const px of xs) {
      let min = Infinity;
      let mi = 0;
      let sum = 0;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const ox = px + i - RX;
          const oy = py + j - RY;
          let s = 0;
          for (let yy = 0; yy < PH; yy += 1) {
            const a = (py + yy) * w + px;
            const b = (oy + yy) * w + ox;
            for (let xx = 0; xx < PW; xx += 1) s += Math.abs(prev.d[a + xx] - cur.d[b + xx]);
          }
          sad[j * nx + i] = s;
          sum += s;
          if (s < min) {
            min = s;
            mi = j * nx + i;
          }
        }
      }
      const mean = sum / (nx * ny);
      const area = PW * PH;
      // parche sin textura (pasto liso, cielo) → no sirve; el mínimo debe destacar claramente
      if (mean / area < 1.2 || min > mean * 0.72) continue;
      const bi = mi % nx;
      const bj = Math.floor(mi / nx);
      // el segundo mejor, lejos del primero, no debe parecerse al primero (evita ambigüedad por repetición)
      let second = Infinity;
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) if (Math.abs(i - bi) > 2 || Math.abs(j - bj) > 2) second = Math.min(second, sad[j * nx + i]);
      if (second < min * 1.12) continue;
      // precisión de fracción de píxel (parábola)
      const at = (i: number, j: number) => sad[j * nx + i];
      let fx = 0;
      let fy = 0;
      if (bi > 0 && bi < nx - 1) {
        const l = at(bi - 1, bj), c = at(bi, bj), r = at(bi + 1, bj);
        const den = l - 2 * c + r;
        if (den > 0) fx = Math.max(-0.5, Math.min(0.5, (l - r) / (2 * den)));
      }
      if (bj > 0 && bj < ny - 1) {
        const u = at(bi, bj - 1), c = at(bi, bj), d = at(bi, bj + 1);
        const den = u - 2 * c + d;
        if (den > 0) fy = Math.max(-0.5, Math.min(0.5, (u - d) / (2 * den)));
      }
      dxs.push(bi - RX + fx);
      dys.push(bj - RY + fy);
    }
  }
  if (dxs.length < 4) return null;
  const med = (v: number[]) => {
    const s = [...v].sort((p, q) => p - q);
    return s[Math.floor(s.length / 2)];
  };
  const mx = med(dxs);
  const my = med(dys);
  // consenso: se promedian solo los parches que coinciden con la mediana (los jugadores en movimiento se descartan)
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < dxs.length; i++) {
    if (Math.abs(dxs[i] - mx) <= 1.5 && Math.abs(dys[i] - my) <= 1.5) {
      sx += dxs[i];
      sy += dys[i];
      n++;
    }
  }
  if (n < 3) return null;
  return { dx: sx / n, dy: sy / n, n };
}

export type AnalyzeResult = { track: CamTrack; usable: number; total: number; maxShift: number };

/**
 * Recorre el clip cada `dt` segundos y mide el movimiento de la cámara.
 * `url` debe ser un mp4 que el navegador pueda leer (con CORS).
 */
export async function analyzeCamera(
  url: string,
  onProgress?: (frac: number) => void,
  signal?: AbortSignal,
  dt = 0.1
): Promise<AnalyzeResult> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  await new Promise<void>((ok, bad) => {
    const to = setTimeout(() => bad(new Error("No se pudo abrir el video para medir la cámara.")), 30000);
    video.addEventListener("loadeddata", () => { clearTimeout(to); ok(); }, { once: true });
    video.addEventListener("error", () => { clearTimeout(to); bad(new Error("No se pudo abrir el video para medir la cámara.")); }, { once: true });
  });
  const dur = video.duration;
  if (!Number.isFinite(dur) || dur <= 0) throw new Error("El video no tiene duración.");
  const AH = Math.max(40, Math.round((AW * (video.videoHeight || 9)) / (video.videoWidth || 16)));
  const canvas = document.createElement("canvas");
  canvas.width = AW;
  canvas.height = AH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Este navegador no puede medir la cámara.");
  ctx.imageSmoothingQuality = "high";

  const grab = async (t: number): Promise<Gray> => {
    await new Promise<void>((ok, bad) => {
      const done = () => { video.removeEventListener("seeked", done); ok(); };
      video.addEventListener("seeked", done);
      video.addEventListener("error", () => bad(new Error("Error al leer el video.")), { once: true });
      video.currentTime = Math.min(dur, t);
    });
    ctx.drawImage(video, 0, 0, AW, AH);
    let img: ImageData;
    try {
      img = ctx.getImageData(0, 0, AW, AH);
    } catch {
      throw new Error("El navegador no dejó leer el video (permiso CORS).");
    }
    const d = new Float32Array(AW * AH);
    for (let i = 0, p = 0; i < d.length; i++, p += 4) d[i] = img.data[p] * 0.299 + img.data[p + 1] * 0.587 + img.data[p + 2] * 0.114;
    return { w: AW, h: AH, d };
  };

  const n = Math.min(MAX_SAMPLES - 1, Math.floor(dur / dt)) + 1;
  const x: number[] = [0];
  const y: number[] = [0];
  let prev = await grab(0);
  let vx = 0;
  let vy = 0;
  let usable = 0;
  for (let i = 1; i < n; i++) {
    if (signal?.aborted) throw new Error("Cancelado");
    const cur = await grab(i * dt);
    const e = estimateShift(prev, cur);
    let sx: number, sy: number;
    if (e) {
      sx = e.dx / AW;
      sy = e.dy / AH;
      vx = sx;
      vy = sy;
      usable++;
    } else {
      // no se pudo medir: se sigue con la velocidad anterior, frenando poco a poco
      vx *= 0.6;
      vy *= 0.6;
      sx = vx;
      sy = vy;
    }
    x.push(x[i - 1] + sx);
    y.push(y[i - 1] + sy);
    prev = cur;
    onProgress?.(i / (n - 1));
  }
  video.removeAttribute("src");
  video.load();
  const track = cleanTrack({ dt, x, y });
  if (!track) throw new Error("No se pudo calcular el movimiento de la cámara.");
  const maxShift = Math.max(...x.map(Math.abs), ...y.map(Math.abs));
  return { track, usable, total: n - 1, maxShift };
}
