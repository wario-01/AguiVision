// Hoja imprimible de la alineación (carta, vertical). Solo se ve al imprimir.
// Sin hooks: se arma con lo que le pase LineupWorkspace.
import React from "react";
import { Slot, shortName, subChain } from "@/lib/lineup";

export type SheetPlayer = { id: string; full_name: string; jersey_number: number | null };

export default function LineupSheet({
  teamName,
  formation,
  slots,
  placed,
  bench,
  out,
  game,
  code,
  notes,
  subs,
}: {
  teamName: string;
  formation: string;
  slots: Slot[];
  placed: (SheetPlayer | null)[];
  bench: SheetPlayer[];
  out: SheetPlayer[];
  game: { title: string; details: string } | null;
  code: string;
  notes: string;
  subs: { minute: number | null; out: SheetPlayer; inn: SheetPlayer }[];
}) {
  const chainOf = (id: string) => subChain(subs.map((x) => ({ out: x.out.id, in: x.inn.id, minute: x.minute, inn: x.inn })), id);
  const starters = placed.filter((p): p is SheetPlayer => !!p);
  const num = (p: SheetPlayer) => (p.jersey_number != null ? String(p.jersey_number) : "–");
  const list = (ps: SheetPlayer[]) => (ps.length ? ps.map((p) => `${num(p)} ${shortName(p.full_name)}`).join(" · ") : "—");
  return (
    <div className="print-only ls">
      <div className="ls-hd">
        <img src="/logo.png" alt="Nido Austin" />
        <div className="ls-t">
          <div className="ls-t1">{teamName.toUpperCase()}</div>
          <div className="ls-t2">{game ? `${game.title} · ${game.details}` : "Rival: ____________________   Fecha: ____________"}</div>
        </div>
        <div className="ls-r">
          <b>ALINEACIÓN {formation}</b>
          Código: {code}
        </div>
      </div>

      <div className="ls-mid">
        <div className="ls-pitch">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <g fill="none" stroke="#003C71" strokeWidth="1.2" strokeOpacity=".5" vectorEffect="non-scaling-stroke">
              <rect x="2" y="2" width="96" height="96" vectorEffect="non-scaling-stroke" />
              <line x1="2" y1="50" x2="98" y2="50" vectorEffect="non-scaling-stroke" />
              <ellipse cx="50" cy="50" rx="9" ry="12" vectorEffect="non-scaling-stroke" />
              <rect x="25" y="2" width="50" height="16" vectorEffect="non-scaling-stroke" />
              <rect x="38" y="2" width="24" height="6" vectorEffect="non-scaling-stroke" />
              <rect x="25" y="82" width="50" height="16" vectorEffect="non-scaling-stroke" />
              <rect x="38" y="92" width="24" height="6" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
          {slots.map((s, i) => {
            const p = placed[i];
            return (
              <div key={i} className={`ls-pl${i === 0 ? " gk" : ""}`} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                <i>{p ? num(p) : ""}</i>
                <s>{p ? shortName(p.full_name) : s.role}</s>
                {p && chainOf(p.id).length > 0 && (
                  <em className="ls-sub">
                    ↑ {shortName(chainOf(p.id)[0].inn.full_name)}
                    {chainOf(p.id)[0].minute != null ? ` ${chainOf(p.id)[0].minute}'` : ""}
                    {chainOf(p.id).length > 1 ? ` +${chainOf(p.id).length - 1}` : ""}
                  </em>
                )}
              </div>
            );
          })}
        </div>
        <div className="ls-side">
          <div>
            <b>Marcador final</b>
            <div className="ls-score">
              Águilas<span className="ls-box big" />—<span className="ls-box big" />Rival
            </div>
          </div>
          <div>
            <b>Del equipo</b>
            <div className="ls-tg">
              {["Tiros a gol", "Tiros de esquina", "Faltas", "Cambios"].map((l) => (
                <React.Fragment key={l}>
                  {l}
                  <span className="ls-box" />
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="ls-notes">
            <b>Notas del entrenador</b>
            {notes ? <div className="ls-notetext">{notes}</div> : null}
            <div className="ls-line" />
            <div className="ls-line" />
            <div className="ls-line" />
          </div>
        </div>
      </div>

      <div className="ls-st">Cambios planeados</div>
      <table className="ls-table ls-subs">
        <thead>
          <tr>
            <th style={{ width: "0.6in" }}>Min.</th>
            <th>Sale</th>
            <th>Entra</th>
            <th style={{ width: "1in" }}>Minuto real</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(4, subs.length) }, (_, k) => subs[k] ?? null).map((x, k) => (
            <tr key={k}>
              <td>{x?.minute != null ? `${x.minute}'` : ""}</td>
              <td className="nm">{x ? `${num(x.out)} ${x.out.full_name}` : ""}</td>
              <td className="nm">{x ? `${num(x.inn)} ${x.inn.full_name}` : ""}</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <table className="ls-table">
        <thead>
          <tr>
            <th>#</th>
            <th style={{ textAlign: "left" }}>Jugador</th>
            <th />
            <th>Min.</th>
            <th>Goles</th>
            <th>Asist.</th>
            <th>Amar.</th>
            <th>Roja</th>
            <th>Atajadas</th>
          </tr>
        </thead>
        <tbody>
          {[...starters.map((p) => ({ p, t: "Titular" })), ...bench.map((p) => ({ p, t: "Suplente" }))].map(({ p, t }, k) => (
            <tr key={p.id} className={t === "Suplente" && k === starters.length ? "sep" : ""}>
              <td className="n">{num(p)}</td>
              <td className="nm">{p.full_name}</td>
              <td className="c">{t}</td>
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      {out.length > 0 && (
        <div className="ls-out">
          <b>No convocados:</b> {list(out)}
        </div>
      )}
      <div className="ls-ft">
        <span>Escribe con números claros dentro de cada cuadro. Después pasa los datos a AguiVision.</span>
        <span>nidoaguilaatx.com</span>
      </div>
    </div>
  );
}
