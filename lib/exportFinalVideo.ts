// Arma en el navegador el "video final" de un highlight: el clip original con los dibujos,
// la voz del entrenador y la música mezclados. Se graba en tiempo real (un clip de 30 s
// tarda 30 s) y el resultado es un archivo que luego se sube a Mux.
import type { Anno } from "@/lib/annotations";
import { drawAnnotations } from "@/lib/annotations-canvas";

export type ExportProgress = { phase: "preparing" | "recording"; t: number; d: number };

export type ExportOpts = {
  videoUrl: string;
  annos: Anno[];
  voice?: { url: string; start: number } | null;
  track?: import("@/lib/camera-track").CamTrack | null; // movimiento de cámara (los dibujos siguen la escena)
  pauses?: boolean; // true = el video se congela en los dibujos con pausa; la voz va en tiempo de presentación
  music?: { url: string; volume: number } | null;
  maxWidth?: number;
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
};

const DUCK = 0.3;

export function exportSupported(): string | null {
  if (typeof window === "undefined") return "Solo funciona en el navegador.";
  if (typeof MediaRecorder === "undefined") return "Este navegador no puede grabar video. Usa Chrome en computadora o Android.";
  if (!(HTMLCanvasElement.prototype as any).captureStream) return "Este navegador no puede grabar el video final. Usa Chrome en computadora o Android.";
  if (!(window.AudioContext || (window as any).webkitAudioContext)) return "Este navegador no maneja el audio necesario.";
  return null;
}

function pickMime(): string {
  const list = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
  ];
  return list.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function exportFinalVideo(o: ExportOpts): Promise<{ blob: Blob; mime: string; seconds: number }> {
  const unsupported = exportSupported();
  if (unsupported) throw new Error(unsupported);
  const aborted = () => {
    if (o.signal?.aborted) throw new Error("Cancelado");
  };

  // ---- video de origen ----
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.preload = "auto";
  video.src = o.videoUrl;
  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("No se pudo abrir el video. Si acaba de crearse, espera un minuto y vuelve a intentarlo.")), 30000);
    video.addEventListener("loadeddata", () => {
      clearTimeout(to);
      resolve();
    }, { once: true });
    video.addEventListener("error", () => {
      clearTimeout(to);
      reject(new Error("No se pudo abrir el video. Si acaba de crearse, espera un minuto y vuelve a intentarlo."));
    }, { once: true });
  });
  aborted();
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const scale = Math.min(1, (o.maxWidth ?? 1280) / vw);
  const W = even(vw * scale);
  const H = even(vh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, W, H);
  try {
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    throw new Error("El video no permite que la app lo use (falta el permiso de lectura de Mux).");
  }

  // ---- audio: video + voz + música en una sola pista ----
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const ac: AudioContext = new AC();
  await ac.resume();
  const dest = ac.createMediaStreamDestination();
  try {
    const vsrc = ac.createMediaElementSource(video);
    vsrc.connect(dest);
  } catch {
    throw new Error("No se pudo leer el sonido del video.");
  }
  const decode = async (url: string, what: string) => {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("http");
      return await ac.decodeAudioData(await res.arrayBuffer());
    } catch {
      throw new Error(`No se pudo leer ${what}. Si es una grabación o canción subida, falta permitir su lectura en Cloudflare R2 (CORS).`);
    }
  };
  const voiceBuf = o.voice ? await decode(o.voice.url, "tu voz") : null;
  const musicBuf = o.music ? await decode(o.music.url, "la música") : null;
  aborted();

  // ---- grabadora ----
  const stream = (canvas as any).captureStream(30) as MediaStream;
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mime = pickMime();
  const rec = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 4_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

  const sources: AudioBufferSourceNode[] = [];
  let raf = 0;
  let stopped = false;
  const cleanup = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    try {
      video.pause();
    } catch {}
    stream.getTracks().forEach((t) => t.stop());
    ac.close().catch(() => {});
  };

  try {
    video.currentTime = 0;
    rec.start(1000);
    await video.play();
    const tv = video.currentTime;
    const tac = ac.currentTime;
    const T = (videoT: number) => tac + (videoT - tv);
    // Con pausas, la voz va en "tiempo de presentación" (segundos reales desde que arranca la grabación).
    const Tv = (p: number) => (o.pauses ? tac + (p - tv) : T(p));

    if (voiceBuf && o.voice) {
      const s = ac.createBufferSource();
      s.buffer = voiceBuf;
      s.connect(dest);
      const startAt = Tv(o.voice.start);
      if (startAt >= tac) s.start(startAt);
      else s.start(tac, tac - startAt);
      sources.push(s);
    }
    if (musicBuf && o.music) {
      const s = ac.createBufferSource();
      s.buffer = musicBuf;
      s.loop = true;
      const g = ac.createGain();
      g.gain.value = o.music.volume;
      s.connect(g);
      g.connect(dest);
      s.start(tac, tv % musicBuf.duration);
      sources.push(s);
      if (voiceBuf && o.voice) {
        const v0 = Tv(o.voice.start);
        const v1 = v0 + voiceBuf.duration;
        g.gain.setTargetAtTime(o.music.volume * DUCK, Math.max(tac, v0), 0.15);
        g.gain.setTargetAtTime(o.music.volume, Math.max(tac, v1), 0.3);
      }
    }

    const total = video.duration || 0;
    let hiddenSince = 0;
    let lastReport = 0;
    const pauseList = o.pauses ? o.annos.filter((a) => a.pause > 0).sort((a, b) => a.t - b.t) : [];
    const firedP = new Set<string>();
    let resumeAt = 0;
    await new Promise<void>((resolve, reject) => {
      const frame = () => {
        if (stopped) return;
        if (o.signal?.aborted) return reject(new Error("Cancelado"));
        if (document.visibilityState === "hidden") {
          hiddenSince = hiddenSince || performance.now();
          if (performance.now() - hiddenSince > 1500) return reject(new Error("Saliste de esta pestaña mientras se grababa. Vuelve a intentarlo y déjala abierta."));
        } else hiddenSince = 0;
        // pausas de los dibujos: el video se congela y se sigue grabando (la voz y la música siguen)
        if (resumeAt && performance.now() >= resumeAt) {
          resumeAt = 0;
          video.play().catch(() => {});
        }
        if (!resumeAt && !video.paused) {
          for (const a of pauseList) {
            if (!firedP.has(a.id) && video.currentTime >= a.t && video.currentTime < a.t + 0.6) {
              firedP.add(a.id);
              video.pause();
              resumeAt = performance.now() + a.pause * 1000;
              break;
            }
          }
        }
        ctx.drawImage(video, 0, 0, W, H);
        drawAnnotations(ctx, o.annos, video.currentTime, W, H, o.track);
        const now = performance.now();
        if (now - lastReport > 250) {
          lastReport = now;
          o.onProgress?.({ phase: "recording", t: video.currentTime, d: total });
        }
        if (video.ended || (total > 0 && video.currentTime >= total - 0.03)) return resolve();
        raf = requestAnimationFrame(frame);
      };
      video.addEventListener("error", () => reject(new Error("El video se detuvo con un error.")), { once: true });
      frame();
    });
    // un último cuadro y un respiro para que el audio termine de entrar
    ctx.drawImage(video, 0, 0, W, H);
    drawAnnotations(ctx, o.annos, video.currentTime, W, H, o.track);
    await new Promise((r) => setTimeout(r, 400));
    const stopP = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.stop();
    await stopP;
    const blob = new Blob(chunks, { type: rec.mimeType || mime || "video/webm" });
    if (blob.size < 2000) throw new Error("La grabación quedó vacía. Inténtalo de nuevo.");
    return { blob, mime: blob.type, seconds: total };
  } finally {
    if (rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {}
    }
    cleanup();
  }
}

/** Sube el archivo a la URL de subida directa de Mux, con avance. */
export function uploadToMux(url: string, blob: Blob, onProgress?: (frac: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type.split(";")[0] || "video/webm");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("No se pudo subir el video a Mux. Inténtalo otra vez.")));
    xhr.onerror = () => reject(new Error("Falló la conexión al subir el video."));
    xhr.send(blob);
  });
}
