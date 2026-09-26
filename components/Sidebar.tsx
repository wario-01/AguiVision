import Link from "next/link";
import { getMyTeams, getCurrentUser, Team } from "@/lib/data";
import LogoutButton from "./LogoutButton";

const ROLE_LABELS: Record<string, string> = {
  coach: "Entrenador",
  assistant: "Asistente",
  player: "Jugador",
  parent: "Madre/Padre",
};

const NAV_ICONS = {
  inicio: (
    <path d="M3 11l9-8 9 8M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
  ),
  subir: (
    <path d="M12 16V4M7 9l5-5 5 5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
  ),
  highlights: (
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

function Icon({ path, active }: { path: React.ReactNode; active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke={active ? "#F0D875" : "#8CA0C7"}
      strokeWidth={2}
    >
      {path}
    </svg>
  );
}

export default async function Sidebar({
  currentTeamSlug,
  active,
}: {
  currentTeamSlug: string;
  active: "inicio" | "subir" | "highlights";
}) {
  const teams: Team[] = await getMyTeams();
  const user = await getCurrentUser();
  const initials = (user?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const currentTeam = teams.find((t) => t.slug === currentTeamSlug);

  return (
    <div className="w-[248px] shrink-0 h-full bg-sidebar border-r border-border box-border p-6 flex flex-col">
      <div className="flex items-center gap-2.5 mb-7 px-1">
        <div className="w-[34px] h-[34px] rounded-full bg-gold flex items-center justify-center font-display font-bold text-bg text-sm">
          AV
        </div>
        <div className="font-display text-lg font-bold tracking-wide">AguiVision</div>
      </div>

      {/* Selector de equipo — solo los equipos donde el usuario tiene membresía real */}
      <div className="mb-5 flex flex-col gap-1.5">
        {teams.map((team) => (
          <Link
            key={team.slug}
            href={`/${team.slug}`}
            className={`text-xs font-bold rounded-lg px-3 py-2 border ${
              team.slug === currentTeamSlug
                ? "bg-panel border-border text-text"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {team.name}
          </Link>
        ))}
        {teams.length === 0 && (
          <div className="text-xs text-muted px-3">Todavía no estás vinculado a ningún equipo.</div>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        <Link
          href={`/${currentTeamSlug}`}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
            active === "inicio" ? "bg-panel" : ""
          }`}
        >
          <Icon path={NAV_ICONS.inicio} active={active === "inicio"} />
          <span className={`text-sm font-semibold ${active === "inicio" ? "text-gold" : "text-muted"}`}>
            Inicio
          </span>
        </Link>
        <Link
          href={`/${currentTeamSlug}/subir`}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
            active === "subir" ? "bg-panel" : ""
          }`}
        >
          <Icon path={NAV_ICONS.subir} active={active === "subir"} />
          <span className={`text-sm font-semibold ${active === "subir" ? "text-gold" : "text-muted"}`}>
            Subir video
          </span>
        </Link>
        <Link
          href={`/${currentTeamSlug}/highlights`}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
            active === "highlights" ? "bg-panel" : ""
          }`}
        >
          <Icon path={NAV_ICONS.highlights} active={active === "highlights"} />
          <span className={`text-sm font-semibold ${active === "highlights" ? "text-gold" : "text-muted"}`}>
            Highlights
          </span>
        </Link>
        <Link href="/en-vivo" className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#8CA0C7" strokeWidth={2}>
            <circle cx="12" cy="12" r="3" fill="#8CA0C7" stroke="none" />
            <path
              d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.5 5.5a9 9 0 000 13M18.5 5.5a9 9 0 010 13"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-sm font-semibold text-muted">En vivo</span>
        </Link>
        <Link href={`/${currentTeamSlug}/equipo`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#8CA0C7" strokeWidth={2}>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-semibold text-muted">Equipo</span>
        </Link>
      </nav>

      <div className="flex-grow" />
      <div className="flex items-center gap-2.5 pt-4 border-t border-border">
        <div className="w-[34px] h-[34px] rounded-full bg-panel2 border border-borderMuted flex items-center justify-center font-display text-xs font-bold text-muted">
          {initials}
        </div>
        <div className="flex flex-col">
          <div className="text-xs font-bold">{user?.full_name ?? "Invitado"}</div>
          <div className="text-[11px] font-medium text-muted">
            {currentTeam?.role ? ROLE_LABELS[currentTeam.role] ?? currentTeam.role : "Sin rol asignado"}
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
