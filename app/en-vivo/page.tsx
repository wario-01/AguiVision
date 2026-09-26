import Link from "next/link";
import { getLiveStreams, getMyTeams } from "@/lib/data";

export default async function EnVivoPage() {
  const streams = await getLiveStreams();
  const teams = await getMyTeams();
  const backHref = teams.length > 0 ? `/${teams[0].slug}` : "/";

  return (
    <div className="min-h-screen bg-bg p-11 max-w-4xl mx-auto">
      <Link href={backHref} className="text-sm text-muted font-semibold mb-5 inline-block">
        ← Volver a Inicio
      </Link>
      <div className="font-display text-2xl font-bold mb-1">En vivo ahora</div>
      <div className="text-sm text-muted mb-8">
        {streams.length > 0
          ? `${streams.length} transmisiones activas — elegí cuál mirar`
          : "No hay transmisiones activas en este momento"}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {streams.map((s) => (
          <Link
            key={s.id}
            href={`/en-vivo/${s.id}`}
            className="block bg-panel border border-border rounded-2xl overflow-hidden hover:border-borderMuted"
          >
            <div className="h-[140px] bg-sidebar relative flex items-center justify-center">
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/55 rounded-full px-2.5 py-1">
                <div className="w-2 h-2 rounded-full bg-red" />
                <span className="text-[11px] font-extrabold tracking-wide">EN VIVO</span>
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/55 rounded-full px-2.5 py-1">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#F5EFD6" strokeWidth={2}>
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-[11px] font-bold">{s.viewer_count}</span>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs font-bold text-gold uppercase tracking-wide mb-1">{s.team_name}</div>
              <div className="text-sm font-bold">{s.title}</div>
            </div>
          </Link>
        ))}
      </div>

      {streams.length === 0 && (
        <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
          Cuando un entrenador inicie una transmisión, va a aparecer acá — se pueden mostrar varias
          al mismo tiempo si hay más de un equipo jugando.
        </div>
      )}
    </div>
  );
}
