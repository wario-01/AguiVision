import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import UploadForm from "@/components/UploadForm";
import PhotoUploadForm from "@/components/PhotoUploadForm";
import { getTeamBySlug, getMatches } from "@/lib/data";
import { clubParts } from "@/lib/tz";

export default async function SubirPage({
  params,
  searchParams,
}: {
  params: { teamSlug: string };
  searchParams: { tab?: string };
}) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  const isStaff = team.role === "coach" || team.role === "assistant";
  const isCollab = team.role === "collaborator";
  // Video: solo entrenador/asistente. Fotos: también colaboradores.
  const hasPhotoAccess = isCollab || !!team.photo_access;
  if (!isStaff && !hasPhotoAccess) notFound();

  const tab = !isStaff || searchParams.tab === "fotos" ? "fotos" : "video";

  let matchOpts: { id: string; label: string }[] = [];
  if (tab === "fotos") {
    const matches = await getMatches(team.slug);
    matchOpts = matches.slice(0, 12).map((m) => ({
      id: m.id,
      label: `vs ${m.opponent} · ${clubParts(m.match_date).ymd}`,
    }));
  }

  const tabClass = (active: boolean) =>
    `text-sm font-bold rounded-full px-4 py-2 border ${
      active ? "bg-cream border-cream text-bg" : "border-transparent text-muted hover:text-text"
    }`;

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="subir" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="font-display text-2xl font-bold mb-1">Subir</div>
        <div className="text-sm text-muted mb-5">{team.name}</div>

        {isStaff && (
          <div className="flex gap-2 mb-6">
            <Link href={`/${team.slug}/subir`} className={tabClass(tab === "video")}>
              Video del partido
            </Link>
            <Link href={`/${team.slug}/subir?tab=fotos`} className={tabClass(tab === "fotos")}>
              Fotos
            </Link>
          </div>
        )}

        {tab === "video" ? (
          <>
            <UploadForm teamSlug={team.slug} />
            <div className="mt-8 text-xs text-muted">
              ¿Se cortó una transmisión y el video no aparece?{" "}
              <Link href={`/${team.slug}/subir/recuperar`} className="font-bold text-gold hover:underline">
                Recuperarlo desde Mux
              </Link>
            </div>
          </>
        ) : (
          <>
            <PhotoUploadForm teamSlug={team.slug} matches={matchOpts} />
            <div className="mt-8 text-xs text-muted">
              Para ver y descargar las fotos:{" "}
              <Link href={`/${team.slug}/fotos`} className="font-bold text-gold hover:underline">
                ir a la galería
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
