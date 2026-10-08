// lib/bmi.ts
//
// IMC (índice de masa corporal) y comparación con los percentiles de IMC para
// la edad del CDC (EE. UU.). Peso en libras, altura en pulgadas.

import { CDC_BMI } from "./cdcBmiData";

export type Sex = "M" | "F";

export function calcBmi(pesoLb: number, alturaIn: number): number {
  return Math.round(((703 * pesoLb) / (alturaIn * alturaIn)) * 10) / 10;
}

export function formatHeight(inches: number): string {
  const total = Math.round(inches * 10) / 10;
  const ft = Math.floor(total / 12);
  const rest = Math.round((total - ft * 12) * 10) / 10;
  return `${ft} pies ${rest} pulg`;
}

export function cdcDataAvailable(): boolean {
  return CDC_BMI.M.length > 0 && CDC_BMI.F.length > 0;
}

// Parámetros L, M, S del CDC para una edad (interpolación lineal entre filas).
function lms(sex: Sex, ageMonths: number): [number, number, number] | null {
  const table = CDC_BMI[sex];
  if (table.length === 0) return null;
  const first = table[0];
  const last = table[table.length - 1];
  if (ageMonths < first[0] || ageMonths > last[0]) return null; // el CDC cubre 2–20 años
  let lo = 0;
  let hi = table.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid][0] <= ageMonths) lo = mid;
    else hi = mid;
  }
  const a = table[lo];
  const b = table[hi];
  const t = b[0] === a[0] ? 0 : (ageMonths - a[0]) / (b[0] - a[0]);
  return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]), a[3] + t * (b[3] - a[3])];
}

// Distribución normal estándar (Abramowitz & Stegun 26.2.17).
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// Puntaje z del IMC para esa edad y sexo. null si no hay datos.
export function bmiZ(bmi: number, sex: Sex, ageMonths: number): number | null {
  const p = lms(sex, ageMonths);
  if (!p) return null;
  const [L, M, S] = p;
  return L === 0 ? Math.log(bmi / M) / S : (Math.pow(bmi / M, L) - 1) / (L * S);
}

// Percentil (0–100) del IMC para esa edad y sexo. null si no hay datos.
export function bmiPercentile(bmi: number, sex: Sex, ageMonths: number): number | null {
  const z = bmiZ(bmi, sex, ageMonths);
  return z === null ? null : Math.round(normalCdf(z) * 1000) / 10;
}

// Relación cintura/altura (misma unidad en ambas). Desde 0.5 se considera elevada
// (señal de grasa abdominal; sirve para separar "IMC alto por grasa" de "IMC alto por músculo").
export const WHTR_LIMIT = 0.5;
export function waistToHeight(cinturaIn: number, alturaIn: number): number {
  return Math.round((cinturaIn / alturaIn) * 100) / 100;
}

// IMC que corresponde a un percentil dado (para dibujar las curvas).
export function bmiAtPercentile(pct: number, sex: Sex, ageMonths: number): number | null {
  const p = lms(sex, ageMonths);
  if (!p) return null;
  const [L, M, S] = p;
  // z para el percentil (inversa de la normal, Beasley-Springer-Moro simplificada por búsqueda binaria)
  let lo = -5;
  let hi = 5;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < pct / 100) lo = mid;
    else hi = mid;
  }
  const z = (lo + hi) / 2;
  const v = L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
  return Math.round(v * 100) / 100;
}

export type BmiStatus = "bajo" | "saludable" | "alto" | "muy_alto";

// Rangos del CDC: <5 bajo peso, 5–84 saludable, 85–94 sobrepeso, ≥95 obesidad.
// Para las familias usamos palabras menos duras y sin diagnosticar.
export function bmiStatus(percentile: number): BmiStatus {
  if (percentile < 5) return "bajo";
  if (percentile < 85) return "saludable";
  if (percentile < 95) return "alto";
  return "muy_alto";
}

export const STATUS_INFO: Record<
  BmiStatus,
  { label: string; needsAttention: boolean; message: string; tone: "ok" | "warn" }
> = {
  bajo: {
    label: "Por debajo del rango típico",
    needsAttention: true,
    message:
      "El IMC de tu hijo está por debajo del rango típico para su edad. Conviene comentarlo con su pediatra para revisar su alimentación y crecimiento.",
    tone: "warn",
  },
  saludable: {
    label: "Dentro del rango saludable",
    needsAttention: false,
    message: "El IMC de tu hijo está dentro del rango saludable para su edad.",
    tone: "ok",
  },
  alto: {
    label: "Por encima del rango típico",
    needsAttention: true,
    message:
      "El IMC de tu hijo está por encima del rango típico para su edad. Conviene comentarlo con su pediatra. Un IMC alto no siempre significa exceso de grasa: en niños deportistas el músculo también pesa.",
    tone: "warn",
  },
  muy_alto: {
    label: "Muy por encima del rango típico",
    needsAttention: true,
    message:
      "El IMC de tu hijo está muy por encima del rango típico para su edad. Te recomendamos platicarlo con su pediatra, que puede evaluar si necesita algún cambio. Un IMC alto no siempre significa exceso de grasa: en niños deportistas el músculo también pesa.",
    tone: "warn",
  },
};


// Cambio de z-score entre dos mediciones que se considera "subió/bajó rápido".
export const Z_JUMP = 0.5;

export type Assessment = {
  level: "ok" | "info" | "aviso";
  needsAttention: boolean; // true = se muestra el aviso "conviene hablar con el pediatra"
  title: string;
  message: string;
};

const SPORT_NOTE =
  "Un IMC alto no siempre significa exceso de grasa: en niños deportistas el músculo también pesa. ";

// Combina IMC (percentil), cintura/altura y la tendencia para decidir el aviso a la familia.
export function assess(input: {
  percentile: number | null;
  whtr: number | null;
  dz: number | null; // cambio de z-score contra la medición anterior
}): Assessment | null {
  const { percentile: pct, whtr, dz } = input;
  if (pct === null) return null;

  const whtrKnown = whtr !== null;
  const whtrHigh = whtrKnown && (whtr as number) >= WHTR_LIMIT;
  const rising = dz !== null && dz >= Z_JUMP;
  const risingText = rising ? " Además, subió rápido desde la última medición." : "";

  if (pct < 5) {
    return {
      level: "aviso",
      needsAttention: true,
      title: "IMC por debajo del rango típico",
      message:
        "El IMC de tu hijo está por debajo del rango típico para su edad. Conviene comentarlo con su pediatra para revisar su alimentación y crecimiento.",
    };
  }

  if (pct >= 85) {
    if (whtrKnown && !whtrHigh) {
      return {
        level: "info",
        needsAttention: false,
        title: "IMC alto, pero la cintura está en rango",
        message:
          "El IMC está por encima del rango típico, pero la medida de la cintura está en rango saludable. Eso suele indicar masa muscular y no exceso de grasa, algo común en niños que practican fútbol. No hay motivo de alarma; seguiremos midiendo." +
          risingText,
      };
    }
    if (whtrKnown && whtrHigh) {
      return {
        level: "aviso",
        needsAttention: true,
        title: "IMC y cintura por encima del rango",
        message:
          "Tanto el IMC como la medida de la cintura de tu hijo están por encima del rango típico. Te recomendamos platicarlo con su pediatra, que puede evaluar si necesita algún cambio." +
          risingText,
      };
    }
    return {
      level: "aviso",
      needsAttention: true,
      title: pct >= 95 ? "IMC muy por encima del rango típico" : "IMC por encima del rango típico",
      message:
        "El IMC de tu hijo está por encima del rango típico para su edad. " +
        SPORT_NOTE +
        "Pídele al entrenador que mida su cintura para saber mejor, y si quieres coméntalo con su pediatra." +
        risingText,
    };
  }

  // IMC entre percentil 5 y 85
  if (whtrHigh) {
    return {
      level: "aviso",
      needsAttention: true,
      title: "Cintura por encima del rango",
      message:
        "El IMC de tu hijo está en rango, pero la medida de su cintura está por encima de lo recomendado para su estatura. Conviene comentarlo con su pediatra." +
        risingText,
    };
  }
  if (rising && pct >= 70) {
    return {
      level: "aviso",
      needsAttention: true,
      title: "El IMC subió rápido",
      message:
        "El IMC de tu hijo sigue en rango, pero subió rápido desde la última medición. Vale la pena vigilarlo y, si quieres, comentarlo con su pediatra.",
    };
  }
  return {
    level: "ok",
    needsAttention: false,
    title: "Dentro del rango saludable",
    message: "El IMC de tu hijo está dentro del rango saludable para su edad.",
  };
}
