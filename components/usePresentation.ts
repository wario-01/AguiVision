"use client";

// Pausas de los dibujos + "tiempo de presentación".
// Cuando un dibujo tiene pausa, el video se congela unos segundos. La voz y la música NO se
// congelan: siguen corriendo en el "tiempo de presentación" = segundo del video + todas las
// pausas ya cumplidas (+ lo que lleva la pausa en curso). Así la voz queda alineada con las pausas.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Anno } from "@/lib/annotations";

const WINDOW = 0.6; // una pausa se dispara si el video pasa por su segundo dentro de esta ventana
const GRACE_MS = 400; // tras pausar el video, tiempo que se le da al reproductor para reportar "pausado"

type Act = { id: string; idx: number; startedAt: number; dur: number };

export function usePresentation(ref: { current: any }, annos: Anno[], now: number, paused: boolean, honor: boolean) {
  const list = useMemo(
    () => annos.filter((a) => a.pause > 0).sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)),
    [annos]
  );
  const fired = useRef(new Set<string>());
  const act = useRef<Act | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNow = useRef(0);
  const resumedAt = useRef(0);
  const [, setN] = useState(0);
  const bump = useCallback(() => setN((n) => n + 1), []);

  const stopAct = useCallback(
    (resume: boolean) => {
      if (timer.current) clearTimeout(timer.current);
      if (tick.current) clearInterval(tick.current);
      timer.current = null;
      tick.current = null;
      const had = act.current;
      act.current = null;
      if (had && resume) {
        resumedAt.current = performance.now();
        ref.current?.play?.();
        setTimeout(bump, GRACE_MS + 50); // por si el reproductor sigue en pausa pasado el margen
      }
      bump();
    },
    [ref, bump]
  );

  useEffect(() => {
    if (!honor) {
      if (act.current) stopAct(false);
      lastNow.current = now;
      return;
    }
    if (now < lastNow.current - 0.5) {
      // el usuario regresó el video: las pausas de ahí en adelante vuelven a disparar
      for (const a of list) if (a.t > now - 0.1) fired.current.delete(a.id);
      if (act.current) stopAct(false);
    }
    lastNow.current = now;
    const cur = act.current;
    if (cur) {
      // dieron play en plena pausa: se cancela lo que faltaba de la pausa
      if (!paused && performance.now() - cur.startedAt > GRACE_MS) stopAct(false);
      return;
    }
    const el = ref.current;
    if (paused || !el) return;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!fired.current.has(a.id) && now >= a.t && now < a.t + WINDOW) {
        fired.current.add(a.id);
        el.pause();
        act.current = { id: a.id, idx: i, startedAt: performance.now(), dur: a.pause };
        timer.current = setTimeout(() => stopAct(true), a.pause * 1000);
        tick.current = setInterval(bump, 50);
        bump();
        break;
      }
    }
  }, [now, paused, honor, list, ref, stopAct, bump]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (tick.current) clearInterval(tick.current);
    },
    []
  );

  /** Tiempo de presentación en este instante. */
  let pNow = now;
  if (honor) {
    const a0 = act.current;
    if (a0 && list[a0.idx]) {
      let extra = 0;
      for (let i = 0; i < a0.idx; i++) extra += list[i].pause;
      pNow = list[a0.idx].t + extra + Math.min(a0.dur, (performance.now() - a0.startedAt) / 1000);
    } else {
      let extra = 0;
      for (const a of list) if (a.t < now && (fired.current.has(a.id) || now >= a.t + WINDOW)) extra += a.pause;
      pNow = now + extra;
    }
  }

  /** Tiempo de presentación al llegar (sin pausar) al segundo `v` del video. */
  const pAt = useCallback(
    (v: number) => {
      let extra = 0;
      for (const a of list) if (a.t < v) extra += a.pause;
      return v + extra;
    },
    [list]
  );
  /** Marca como ya cumplidas las pausas anteriores al segundo `v` (para empezar a grabar ahí). */
  const markPassed = useCallback(
    (v: number) => {
      for (const a of list) if (a.t < v) fired.current.add(a.id);
    },
    [list]
  );
  /** Empezar de cero (para "Probar"). */
  const reset = useCallback(() => {
    fired.current.clear();
    if (act.current) stopAct(false);
  }, [stopAct]);

  return { pNow, userPaused: honor ? paused && !act.current && performance.now() - resumedAt.current > GRACE_MS : paused, autoPaused: Boolean(act.current), pAt, markPassed, reset };
}
