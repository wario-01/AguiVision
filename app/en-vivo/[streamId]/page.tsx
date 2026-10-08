import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLiveStreamById, logPublicStreamView } from "@/lib/data";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import MatchPlayer from "@/components/MatchPlayer";
import CopyLinkButton from "@/components/CopyLinkButton";

// Esta pantalla es pública (ver middleware.ts) — cualquiera con el link
// puede mirar sin cuenta. Por eso todo acá usa las versiones "públicas" de
// los datos (sin depender de a qué equipos pertenece quien la visita).
export async function generateMetadata({ params }: { params: { streamId: string } }): Promise<Metadata> {
  if (!isAdminConfigured) return { title: "AguiVision — En vivo" };
  const admin = createAdminClient();
  if (!admin) return { title: "AguiVision — En vivo" };

  const { data } = await admin
    .from("live_streams")
    .select("title, teams(name)")
    .eq("id", params.streamId)
    .single();

  if (!data) return { title: "AguiVision — En vivo" };

  const teamName = (data as any).teams?.name ?? "Nido Águila";
  const title = `🔴 EN VIVO: ${data.title} — ${teamName}`;
  const description = "Mirá la transmisión en AguiVision.";

  return {
    title,
    description,
    robots: { index: false, follow: false }, // que Google no la indexe
    openGraph: {
      title,
      description,
      images: ["/icon-512.png"],
    },
  };
}

export default async function WatchStreamPage({ params }: { params: { streamId: string } }) {
  const stream = await getPublicLiveStreamById(params.streamId);
  if (!stream) notFound();

  logPublicStreamView(stream.id); // no bloquea el render; no identifica a la persona

  return (
    <div className="min-h-screen bg-bg px-5 py-8 md:p-11 max-w-5xl mx-auto">
      {stream.playback_id ? (
        <div className="relative mb-2">
          <MatchPlayer playbackId={stream.playback_id} live />
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/55 rounded-full px-3 py-1.5 pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-red" />
            <span className="text-xs font-extrabold">EN VIVO</span>
          </div>
        </div>
      ) : (
        <div className="w-full aspect-video rounded-2xl bg-sidebar border border-border flex items-center justify-center mb-2">
          <span className="text-muted text-sm">Esperando que la transmisión empiece...</span>
        </div>
      )}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-bold text-gold uppercase tracking-wide mb-1">{stream.team_name}</div>
          <div className="font-display text-xl font-bold">{stream.title}</div>
          <div className="text-sm text-muted">{stream.viewer_count} viendo ahora</div>
        </div>
        <CopyLinkButton />
      </div>

      {stream.sponsor_logo_url && (
        <div className="flex items-center gap-3 bg-panel border border-border rounded-xl px-4 py-3 mb-8 w-fit">
          <span className="text-xs text-muted font-semibold">Transmisión presentada por</span>
          <img src={stream.sponsor_logo_url} alt="Patrocinador" className="h-12 md:h-16 object-contain" />
        </div>
      )}

      <div className="mt-10 text-center">
        <div className="text-xs text-muted mb-2">¿Sos parte del equipo?</div>
        <Link href="/login" className="text-xs font-bold text-gold">
          Iniciar sesión en AguiVision →
        </Link>
      </div>
    </div>
  );
}
