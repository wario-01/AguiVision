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
  inicio: <path d="M3 11l9-8 9 8M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />,
  subir: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />,
  highlights: (
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  vivo: (
    <>
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <path
        d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.5 5.5a9 9 0 000 13M18.5 5.5a9 9 0 010 13"
        strokeLinecap="round"
      />
    </>
  ),
  equipo: (
    <>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  asistencia: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  crecimiento: (
    <>
      <path d="M3 17l5-5 4 3 8-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  evaluaciones: (
    <>
      <path d="M9 3h6a2 2 0 012 2v1H7V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 4H5a2 2 0 00-2 2v13a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

function Icon({ path, active, size = 19 }: { path: React.ReactNode; active: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={active ? "#F0D875" : "#8CA0C7"} strokeWidth={2}>
      {path}
    </svg>
  );
}

export default async function Sidebar({
  currentTeamSlug,
  active,
}: {
  currentTeamSlug: string;
  active: "inicio" | "subir" | "highlights" | "equipo" | "calendario" | "evaluaciones" | "crecimiento" | "asistencia";
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

  const isStaff = currentTeam?.role === "coach" || currentTeam?.role === "assistant";

  const allNavItems = [
    { key: "inicio" as const, href: `/${currentTeamSlug}`, label: "Inicio", icon: NAV_ICONS.inicio },
    { key: "calendario" as const, href: `/${currentTeamSlug}/calendario`, label: "Calendario", icon: NAV_ICONS.calendario },
    { key: "subir" as const, href: `/${currentTeamSlug}/subir`, label: "Subir", icon: NAV_ICONS.subir },
    { key: "highlights" as const, href: `/${currentTeamSlug}/highlights`, label: "Highlights", icon: NAV_ICONS.highlights },
    { key: "vivo" as const, href: `/en-vivo`, label: "En vivo", icon: NAV_ICONS.vivo },
    { key: "equipo" as const, href: `/${currentTeamSlug}/equipo`, label: "Equipo", icon: NAV_ICONS.equipo },
    { key: "evaluaciones" as const, href: `/${currentTeamSlug}/evaluaciones`, label: "Evaluación", icon: NAV_ICONS.evaluaciones },
    { key: "asistencia" as const, href: `/${currentTeamSlug}/asistencia`, label: "Asistencia", icon: NAV_ICONS.asistencia },
    { key: "crecimiento" as const, href: `/${currentTeamSlug}/crecimiento`, label: "Crecimiento", icon: NAV_ICONS.crecimiento },
  ];
  const isFamily = (currentTeam?.role === "parent" || currentTeam?.role === "player") && !!currentTeam?.player_id;

  // Las evaluaciones son datos de menores: solo entrenador/asistente.
  // Crecimiento (IMC): lo ve la familia/jugador vinculado (el cuerpo técnico lo ve en el perfil del jugador).
  const navItems = allNavItems.filter((item) => {
    if (item.key === "evaluaciones") return isStaff;
    if (item.key === "crecimiento") return isFamily;
    return true;
  });

  return (
    <>
      {/* ---------- Escritorio: barra lateral fija ---------- */}
      <div className="hidden md:flex md:w-[248px] md:shrink-0 h-full bg-sidebar border-r border-border box-border p-6 flex-col">
        <div className="flex items-center gap-2.5 mb-7 px-1">
          <img src="/logo.png" alt="Nido Águila" className="w-[34px] h-[34px] rounded-full object-contain" />
          <div className="font-display text-lg font-bold tracking-wide">AguiVision</div>
        </div>

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
          {navItems.map((item) => {
            const isActive = active === item.key || (item.key === "vivo" && false);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive ? "bg-panel" : ""}`}
              >
                <Icon path={item.icon} active={isActive} />
                <span className={`text-sm font-semibold ${isActive ? "text-gold" : "text-muted"}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-grow" />
        <div className="flex items-center gap-2.5 pt-4 border-t border-border">
          <div className="w-[34px] h-[34px] rounded-full bg-panel2 border border-borderMuted flex items-center justify-center font-display text-xs font-bold text-muted overflow-hidden">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
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

      {/* ---------- Celular: barra superior + navegación inferior ---------- */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-sidebar border-b border-border box-border">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Nido Águila" className="w-[28px] h-[28px] rounded-full object-contain" />
            <div className="font-display text-base font-bold">AguiVision</div>
          </div>
          <Link
            href={`/${currentTeamSlug}/equipo`}
            className="w-[28px] h-[28px] rounded-full bg-panel2 border border-borderMuted flex items-center justify-center font-display text-[10px] font-bold text-muted overflow-hidden"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </Link>
        </div>
        {teams.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 no-scrollbar">
            {teams.map((team) => (
              <Link
                key={team.slug}
                href={`/${team.slug}`}
                className={`shrink-0 text-xs font-bold rounded-full px-3 py-1.5 border ${
                  team.slug === currentTeamSlug
                    ? "bg-panel border-border text-text"
                    : "border-borderMuted text-muted"
                }`}
              >
                {team.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-sidebar border-t border-border flex items-stretch overflow-x-auto no-scrollbar pb-[env(safe-area-inset-bottom,0px)]">
        {navItems.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 min-w-[68px] shrink-0"
            >
              <Icon path={item.icon} active={isActive} size={18} />
              <span className={`text-[10px] font-semibold truncate ${isActive ? "text-gold" : "text-muted"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
