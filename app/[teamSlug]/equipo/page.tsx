import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import InviteForm from "@/components/InviteForm";
import { getTeamBySlug, getTeamMembers, getPendingInvitations } from "@/lib/data";

const ROLE_LABELS: Record<string, string> = {
  coach: "Entrenador",
  assistant: "Asistente",
  player: "Jugador",
  parent: "Madre/Padre",
};

export default async function EquipoPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();

  const canInvite = team.role === "coach" || team.role === "assistant";
  const members = await getTeamMembers(team.slug);
  const invitations = canInvite ? await getPendingInvitations(team.slug) : [];

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="inicio" />
      <div className="flex-grow overflow-y-auto p-11 max-w-2xl">
        <div className="font-display text-2xl font-bold mb-1">Equipo</div>
        <div className="text-sm text-muted mb-7">{team.name}</div>

        {canInvite && (
          <div className="bg-panel border border-border rounded-2xl p-5 mb-8">
            <div className="font-display text-base font-semibold mb-4">Invitar a alguien</div>
            <InviteForm teamSlug={team.slug} />
            <div className="text-xs text-muted mt-3">
              Se vincula solo la primera vez que esa persona inicie sesión con ese email — no hace falta nada más.
            </div>
          </div>
        )}

        <div className="font-display text-lg font-semibold mb-3">Miembros</div>
        <div className="bg-panel border border-border rounded-2xl overflow-hidden mb-8">
          {members.map((m, i) => (
            <div
              key={m.email + m.role}
              className={`flex items-center justify-between px-5 py-3 ${
                i < members.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div>
                <div className="text-sm font-bold">{m.full_name}</div>
                <div className="text-xs text-muted">{m.email}</div>
              </div>
              <span className="text-xs font-bold text-gold">{ROLE_LABELS[m.role] ?? m.role}</span>
            </div>
          ))}
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
                  className={`flex items-center justify-between px-5 py-3 ${
                    i < invitations.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="text-sm font-semibold text-muted">{inv.email}</div>
                  <span className="text-xs font-bold text-muted">{ROLE_LABELS[inv.role] ?? inv.role}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
