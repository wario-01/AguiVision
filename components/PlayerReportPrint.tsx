// components/PlayerReportPrint.tsx
//
// Informe oficial del jugador: solo se ve al imprimir / "Descargar PDF"
// (en pantalla está oculto). Membrete con logo de Nido Austin, datos del
// jugador, asistencia, evaluación formativa, evaluación físico-técnica y
// espacio para observaciones y firmas.

import { CLUB_TZ } from "@/lib/tz";
import { AREAS as AREA_LIST } from "@/lib/data-evaluaciones";
import { NIVELES, FormativeBreakdown, CoachMessage } from "@/lib/data-evaluaciones";
import { PrintRadar, PrintCompareBar, PrintLine } from "@/components/charts/PrintCharts";
import { statsOf, AttRecord, Counts } from "@/lib/asistencia";

type Metric = { id: string; nombre: string; unidad: string };
type Result = { valor: number; fecha: string };

function fecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#003C71] text-white px-3 py-1.5 text-[11px] font-bold tracking-[0.18em] uppercase mb-2">
      {children}
    </div>
  );
}

function pctText(c: Counts) {
  return c.pct === null ? "—" : `${c.pct}%`;
}
function detalle(c: Counts) {
  return c.contables > 0 ? `${c.presente + c.tarde} de ${c.contables}` : "Sin eventos";
}

export default function PlayerReportPrint({
  teamName,
  playerName,
  jerseyNumber,
  position,
  photoUrl,
  attendance,
  attYear,
  cycleName,
  areas,
  metrics,
  historial,
  teamAverages,
  breakdown,
  message,
}: {
  teamName: string;
  playerName: string;
  jerseyNumber: number | null;
  position: string | null;
  photoUrl: string | null;
  attendance: AttRecord[];
  attYear: number;
  cycleName: string | null;
  areas: Record<string, number> | null;
  metrics: Metric[];
  historial: Record<string, Result[]>; // más reciente primero
  teamAverages: Record<string, number>;
  breakdown: FormativeBreakdown | null;
  message: CoachMessage | null;
}) {
  const hoy = new Date().toLocaleDateString("es-MX", {
    timeZone: CLUB_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const att = attendance.length > 0 ? statsOf(attendance) : null;
  const filasFisicas = metrics.filter((m) => (historial[m.id] ?? []).length > 0);
  const compareData = filasFisicas.map((m) => ({
    metrica: m.nombre,
    jugador: historial[m.id][0].valor,
    equipo: teamAverages[m.id] ?? 0,
  }));
  const lineMetrics = filasFisicas.filter((m) => historial[m.id].length >= 2);
  const th = "text-left text-[10px] font-bold uppercase tracking-wide text-[#003C71] border-b-2 border-[#B8963A] px-2 py-1.5";
  const td = "px-2 py-1.5 border-b border-[#d9d2be] text-[12px]";

  return (
    <div className="print-only report text-[#1a1a1a] bg-white font-body">
      {/* Membrete */}
      <div className="flex items-center justify-between border-b-[3px] border-[#B8963A] pb-3 mb-1">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Nido Austin" className="w-[72px] h-[72px] object-contain" />
          <div>
            <div className="font-display text-[26px] font-bold tracking-[0.12em] text-[#003C71] leading-none">
              NIDO AUSTIN
            </div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-[#6b6450] mt-1.5">
              Informe de evaluación del jugador
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] text-[#6b6450]">
          <div className="font-bold text-[#003C71]">{teamName}</div>
          <div>Emitido el {hoy}</div>
        </div>
      </div>
      <div className="border-b border-[#B8963A] mb-5" />

      {/* Datos del jugador */}
      <div className="flex items-center gap-4 border border-[#d9d2be] rounded-sm p-3 mb-5 break-inside-avoid">
        <div className="w-[64px] h-[64px] rounded-full border border-[#d9d2be] overflow-hidden flex items-center justify-center bg-[#f4f0e2] shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt={playerName} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-lg font-bold text-[#003C71]">
              {playerName
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-grow">
          <div className="font-display text-[22px] font-bold text-[#003C71] leading-tight">{playerName}</div>
          <div className="text-[12px] text-[#6b6450] mt-0.5">
            {teamName}
            {jerseyNumber != null && ` · Número ${jerseyNumber}`}
            {position && ` · ${position}`}
          </div>
        </div>
      </div>

      {/* Asistencia */}
      <div className="mb-5 break-inside-avoid">
        <SectionTitle>Asistencia {attYear}</SectionTitle>
        {att ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Tipo</th>
                <th className={th}>Asistencia</th>
                <th className={th}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Entrenamientos", att.entrenamientos],
                ["Juegos", att.juegos],
                ["Total", att.total],
              ].map(([label, c]) => (
                <tr key={label as string}>
                  <td className={`${td} font-bold`}>{label as string}</td>
                  <td className={td}>{pctText(c as Counts)}</td>
                  <td className={td}>{detalle(c as Counts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-[12px] text-[#6b6450]">Sin asistencia registrada en {attYear}.</div>
        )}
      </div>

      {/* Evaluación formativa */}
      <div className="mb-5 break-inside-avoid">
        <SectionTitle>Evaluación formativa{cycleName ? ` · ${cycleName}` : ""}</SectionTitle>
        {areas && Object.keys(areas).length > 0 ? (
          <>
            <div className="flex items-center gap-4">
            <div className="flex-grow">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Área</th>
                  <th className={th}>Nivel</th>
                  <th className={th}>Valoración</th>
                </tr>
              </thead>
              <tbody>
                {AREA_LIST.filter((a) => areas[a.value] != null).map((a) => {
                  const v = areas[a.value];
                  const n = Math.min(5, Math.max(1, Math.round(v)));
                  return (
                    <tr key={a.value}>
                      <td className={`${td} font-bold`}>{a.label}</td>
                      <td className={td}>{NIVELES[n - 1].label}</td>
                      <td className={td}>
                        <span className="inline-flex gap-[3px] align-middle">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span
                              key={i}
                              className={`inline-block h-[7px] w-[22px] ${
                                i <= n ? "bg-[#003C71]" : "bg-[#d9d2be]"
                              }`}
                            />
                          ))}
                        </span>{" "}
                        <span className="text-[11px] text-[#6b6450]">{v.toFixed(1)} / 5</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div className="shrink-0">
              <PrintRadar areas={areas} />
            </div>
            </div>
            <div className="text-[10px] text-[#6b6450] mt-1.5">
              Escala: 1 Emergente · 2 En desarrollo · 3 Consistente · 4 Autónomo funcional · 5 Competente.
            </div>
          </>
        ) : (
          <div className="text-[12px] text-[#6b6450]">Sin evaluaciones formativas registradas.</div>
        )}
      </div>

      {/* Desglose por área */}
      {breakdown && breakdown.areas.length > 0 && (
        <div className="mb-5">
          <SectionTitle>Desglose por área · {breakdown.cycleName}</SectionTitle>
          {breakdown.areas.map((ar) => {
            const pn = Math.min(5, Math.max(1, Math.round(ar.promedio)));
            return (
              <div key={ar.area} className="border border-[#d9d2be] mb-3 break-inside-avoid">
                <div className="flex items-center justify-between bg-[#f4f0e2] border-b-2 border-[#B8963A] px-2.5 py-1.5">
                  <span className="font-bold text-[#003C71] text-[13px]">{ar.label}</span>
                  <span className="text-[11px] text-[#1a1a1a]">
                    Promedio {ar.promedio.toFixed(1)} / 5 · {NIVELES[pn - 1].label}
                  </span>
                </div>
                {ar.items.map((it, i) => {
                  const n = NIVELES.findIndex((x) => x.value === it.nivel) + 1 || 1;
                  return (
                    <div key={i} className="px-2.5 py-1.5 border-b border-[#d9d2be] last:border-b-0 break-inside-avoid">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[11.5px] leading-snug flex-grow">{it.descripcion}</div>
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] font-bold text-[#6b6450] uppercase tracking-wide">
                            {it.periodo} · {NIVELES[n - 1].label}
                          </div>
                          <span className="inline-flex gap-[2px] align-middle">
                            {[1, 2, 3, 4, 5].map((k) => (
                              <span
                                key={k}
                                className={`inline-block h-[6px] w-[16px] ${k <= n ? "bg-[#003C71]" : "bg-[#d9d2be]"}`}
                              />
                            ))}
                          </span>{" "}
                          <span className="text-[10px] text-[#6b6450]">{n} / 5</span>
                        </div>
                      </div>
                      {it.notas && (
                        <div className="text-[11px] italic text-[#444] mt-1 leading-snug">Entrenador: «{it.notas}»</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Evaluación físico-técnica */}
      {filasFisicas.length > 0 && (
        <div className="mb-5">
          <SectionTitle>Evaluación físico-técnica</SectionTitle>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Prueba</th>
                <th className={th}>Último resultado</th>
                <th className={th}>Fecha</th>
                <th className={th}>Anterior</th>
                <th className={th}>Promedio del equipo</th>
              </tr>
            </thead>
            <tbody>
              {filasFisicas.map((m) => {
                const h = historial[m.id];
                const prom = teamAverages[m.id];
                return (
                  <tr key={m.id}>
                    <td className={`${td} font-bold`}>{m.nombre}</td>
                    <td className={td}>
                      {h[0].valor} {m.unidad}
                    </td>
                    <td className={td}>{fecha(h[0].fecha)}</td>
                    <td className={td}>{h[1] ? `${h[1].valor} ${m.unidad}` : "—"}</td>
                    <td className={td}>{prom != null ? `${Math.round(prom * 100) / 100} ${m.unidad}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {compareData.length > 0 && (
            <div className="mt-3 break-inside-avoid">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#003C71] mb-1">
                Jugador vs. promedio del equipo
              </div>
              <PrintCompareBar data={compareData} />
            </div>
          )}
          {lineMetrics.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#003C71] mb-1">
                Progreso en el tiempo
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {lineMetrics.map((m) => (
                  <div key={m.id} className="break-inside-avoid">
                    <div className="text-[10px] font-bold text-[#6b6450] mb-0.5">
                      {m.nombre} ({m.unidad})
                    </div>
                    <PrintLine data={historial[m.id]} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mensaje del entrenador */}
      {message && message.mensaje.trim() && (
        <div className="mb-8 break-inside-avoid">
          <SectionTitle>Mensaje del entrenador para {playerName.split(" ")[0]}</SectionTitle>
          <div className="border-[1.5px] border-[#B8963A] bg-[#fbf8ee] px-4 py-3">
            <div className="text-[13.5px] leading-relaxed whitespace-pre-line">«{message.mensaje.trim()}»</div>
            {message.author_name && (
              <div className="text-right text-[11px] text-[#6b6450] mt-2">— {message.author_name}</div>
            )}
          </div>
        </div>
      )}

      {/* Firmas */}
      <div className="grid grid-cols-2 gap-16 mt-10 break-inside-avoid">
        <div className="text-center">
          <div className="border-t border-[#1a1a1a] pt-1.5 text-[11px]">Entrenador</div>
        </div>
        <div className="text-center">
          <div className="border-t border-[#1a1a1a] pt-1.5 text-[11px]">Madre / Padre / Tutor</div>
        </div>
      </div>

      <div className="mt-8 pt-2 border-t border-[#B8963A] text-center text-[9px] tracking-wide text-[#6b6450]">
        Nido Austin · Informe confidencial de uso exclusivo del jugador y su familia · Generado con AguiVision
      </div>
    </div>
  );
}
