#!/usr/bin/env python3
"""Convierte bmiagerev.csv (CDC) en lib/cdcBmiData.ts.

Uso:  python3 scripts/build-cdc-bmi.py ruta/a/bmiagerev.csv
Columnas esperadas (como las publica el CDC): Sex, Agemos, L, M, S, ...
Sex: 1 = niño, 2 = niña.
"""
import csv
import sys
from pathlib import Path

src = Path(sys.argv[1])
rows = {"M": [], "F": []}
with src.open(newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    reader.fieldnames = [h.strip().lower() for h in reader.fieldnames]
    for r in reader:
        try:
            sex = {"1": "M", "2": "F"}[str(r["sex"]).strip().split(".")[0]]
            age = float(r["agemos"])
            l, m, s = float(r["l"]), float(r["m"]), float(r["s"])
        except (KeyError, ValueError):
            continue  # fila de encabezado extra, notas o vacía
        rows[sex].append((age, l, m, s))

for k in rows:
    rows[k].sort()
    if len(rows[k]) < 200:
        sys.exit(f"Faltan filas para {k}: {len(rows[k])} (se esperaban ~219)")

def fmt(lst):
    return ",\n".join("    [%s, %s, %s, %s]" % tuple(repr(x) for x in r) for r in lst)

out = Path(__file__).resolve().parent.parent / "lib" / "cdcBmiData.ts"
out.write_text(
    "// lib/cdcBmiData.ts\n//\n"
    "// Tabla oficial del CDC (2000 CDC Growth Charts, IMC para la edad, 2–20 años).\n"
    "// Fuente: https://www.cdc.gov/growthcharts/data/zscore/bmiagerev.csv\n"
    "// Cada fila: [edad en meses, L, M, S]. GENERADO con scripts/build-cdc-bmi.py — no editar a mano.\n\n"
    "export const CDC_BMI: { M: [number, number, number, number][]; F: [number, number, number, number][] } = {\n"
    f"  M: [\n{fmt(rows['M'])},\n  ],\n  F: [\n{fmt(rows['F'])},\n  ],\n}};\n",
    encoding="utf-8",
)
print("OK", {k: len(v) for k, v in rows.items()}, "->", out)
