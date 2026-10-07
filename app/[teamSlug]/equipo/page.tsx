import { notFound } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import InviteForm from "@/components/InviteForm";
import RemoveMemberButton from "@/components/RemoveMemberButton";
import CancelInvitationButton from "@/components/CancelInvitationButton";
import SponsorLogoForm from "@/components/SponsorLogoForm";
import ProfilePhotoUpload from "@/components/ProfilePhotoUpload";
import PlayerPhotoUpload from "@/components/PlayerPhotoUpload";
import { getTeamBySlug, getTeamMembers, getPendingInvitations, getCurrentUser, getPlayers, getMyTeams } from "@/lib/data";

const ROLE_LABELS: Record<string, string> = {
  coach: "Entrenador",
  assistant: "Asistente",
  player: "Jugador",
  parent: "Madre/Padre",
};

function MemberAvatar({ url, name }: { url: string | null | undefined; name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden shrink-0">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-display text-xs font-bold text-muted">{initials}</span>
      )}
    </div>
  );
}

export default async function EquipoPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const canInvite = team.role === "coach" || team.role === "assistant";
  const allMembers = await getTeamMembers(team.slug);
  const invitations = canInvite ? await getPendingInvitations(team.slug) : [];
  const players = await getPlayers(team.slug);
  const currentUser = await getCurrentUser();
  // Madres/padres y jugadores no ven los correos de los demás: solo su propia fila.
  const members = canInvite ? allMembers : allMembers.filter((m) => m.profile_id === currentUser?.id);
  const managedTeams = canInvite
    ? (await getMyTeams())
        .filter((t) => t.role === "coach" || t.role === "assistant")
        .map((t) => ({ slug: t.slug, name: t.name }))
    : [];

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="equipo" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="font-display text-2xl font-bold mb-1">Equipo</div>
        <div className="text-sm text-muted mb-7">{team.name}</div>

        {/* Tu propia foto de perfil — cualquiera puede cambiar la suya */}
        <div className="flex items-center gap-3 bg-panel border border-border rounded-2xl p-4 mb-8">
          <ProfilePhotoUpload currentUrl={currentUser?.avatar_url ?? null} fullName={currentUser?.full_name ?? "?"} size={48} />
          <div>
            <div className="text-sm font-bold">{currentUser?.full_name}</div>
            <div className="text-xs text-muted">Tocá tu foto para cambiarla</div>
          </div>
        </div>

        {canInvite && (
          <div className="mb-8">
            <SponsorLogoForm teamSlug={team.slug} currentUrl={team.sponsor_logo_url ?? null} />
          </div>
        )}

        {canInvite && (
          <div className="bg-panel border border-border rounded-2xl p-5 mb-8">
            <div className="font-display text-base font-semibold mb-4">Invitar a alguien</div>
            <InviteForm teamSlug={team.slug} teams={managedTeams} players={players} />
            <div className="text-xs text-muted mt-3">
              Se vincula solo la primera vez que esa persona inicie sesión con ese email — no hace falta nada más.
            </div>
          </div>
        )}

        {canInvite && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-lg font-semibold">Plantilla</div>
              <Link href={`/${team.slug}/jugador/nuevo`} className="text-xs font-bold text-gold hover:underline">
                + Nuevo jugador
              </Link>
            </div>
            {players.length === 0 && (
              <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-6 text-center mb-8">
                Este equipo todavía no tiene jugadores. Agrega el primero con el enlace + Nuevo jugador.
              </div>
            )}
            <div className={`bg-panel border border-border rounded-2xl overflow-hidden mb-8 ${players.length === 0 ? "hidden" : ""}`}>
              {players.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-5 py-3 ${
                    i < players.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <PlayerPhotoUpload playerId={p.id} currentUrl={p.photo_url ?? null} fullName={p.full_name} />
                  <div className="flex-grow min-w-0">
                    <div className="text-sm font-bold truncate">
                      {p.jersey_number != null && <span className="text-gold">#{p.jersey_number} </span>}
                      {p.full_name}
                    </div>
                    <div className="text-xs text-muted truncate">{p.position ? p.position : "Sin posición"}</div>
                  </div>
                  <Link
                    href={`/${team.slug}/jugador/${p.id}/editar`}
                    className="text-xs font-bold text-gold hover:underline shrink-0"
                  >
                    Editar datos
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="font-display text-lg font-semibold mb-3">Miembros</div>
        <div className="bg-panel border border-border rounded-2xl overflow-hidden mb-8">
          {members.map((m, i) => {
            const isSelf = m.profile_id === currentUser?.id;
            return (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-3 px-5 py-3 ${
                  i < members.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MemberAvatar url={m.avatar_url} name={m.full_name} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">
                      {m.full_name} {isSelf && <span className="text-muted font-medium">(vos)</span>}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {m.email}
                      {m.player_name && <span className="text-gold"> · {m.player_name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs font-bold text-gold">{ROLE_LABELS[m.role] ?? m.role}</span>
                  {(canInvite || isSelf) && (
                    <RemoveMemberButton memberId={m.id} memberName={m.full_name} isSelf={isSelf} />
                  )}
                </div>
              </div>
            );
          })}
          {members.length === 0 && (
            <div className="px-5 py-4 text-sm text-muted">Todavía no hay miembros.</div>
          )}
        </div>

        {canInvite && invitations.length > 0 && (
          <>
            <div className="font-display text-lg font-semibold mb-3">Invitaciones pendientes</div>
            <div className="bg-panel border border-border rounded-2xl overflow-hidden">
              {invitations.map((inv, i) => (
                <div
                  key={inv.id}
                  className={`flex items-center justify-between gap-3 px-5 py-3 ${
                    i < invitations.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="text-sm font-semibold text-muted truncate min-w-0">
                    {inv.email}
                    {inv.player_name && <span className="text-gold"> · {inv.player_name}</span>}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs font-bold text-muted">{ROLE_LABELS[inv.role] ?? inv.role}</span>
                    <CancelInvitationButton invitationId={inv.id} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
