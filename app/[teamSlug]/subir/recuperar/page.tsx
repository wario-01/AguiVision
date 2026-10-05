// app/[teamSlug]/subir/recuperar/page.tsx
//
// Lista los videos más recientes que existen en Mux y que no están colgados
// de ningún partido de la app, para poder recuperarlos (por ejemplo la
// grabación de una transmisión que se quedó sin partido).

import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import RecoverVideoForm, { RecoverCandidate } from "@/components/RecoverVideoForm";
import { getTeamBySlug } from "@/lib/data";
import { mux, isMuxConfigured } from "@/lib/mux";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export default async function RecuperarVideoPage({ params }: { params: { teamSlug: string } }) {
  const team = await getTeamBySlug(params.teamSlug);
  if (!team) notFound();
  if (team.role !== "coach" && team.role !== "assistant") notFound();

  let candidates: RecoverCandidate[] = [];
  let problem: string | null = null;

  if (!isMuxConfigured || !mux || !isAdminConfigured) {
    problem = "Mux no está conectado en este servidor.";
  } else {
    try {
      const assets: any[] = [];
      for await (const a of mux.video.assets.list({ limit: 25 })) {
        assets.push(a);
        if (assets.length >= 25) break;
      }

      const ids = assets.map((a) => a.id);
      const linked = new Set<string>();
      const admin = createAdminClient();
      if (admin && ids.length > 0) {
        const { data: ms } = await admin.from("matches").select("video_asset_id").in("video_asset_id", ids);
        const { data: hs } = await admin.from("highlights").select("clip_asset_id").in("clip_asset_id", ids);
        (ms ?? []).forEach((m: any) => m.video_asset_id && linked.add(m.video_asset_id));
        (hs ?? []).forEach((h: any) => h.clip_asset_id && linked.add(h.clip_asset_id));
      }

      candidates = assets
        .filter((a) => a.status === "ready" && !linked.has(a.id))
        .filter((a) => !String(a.passthrough ?? "").includes("highlight:"))
        .map((a) => ({
          id: a.id as string,
          playbackId: a.playback_ids?.find((p: any) => p.policy === "public")?.id as string | undefined,
          createdAt: new Date(Number(a.created_at) * 1000).toISOString(),
          duration: typeof a.duration === "number" ? a.duration : null,
          isLive: Boolean(a.live_stream_id),
        }))
        .filter((c): c is RecoverCandidate => Boolean(c.playbackId));
    } catch (err) {
      console.error("No se pudo leer la lista de videos de Mux:", err);
      problem = "No pude leer la lista de videos de Mux. Intenta de nuevo en un momento.";
    }
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar currentTeamSlug={team.slug} active="subir" />
      <div className="flex-grow overflow-y-auto px-5 pt-24 pb-24 md:p-11 max-w-2xl">
        <div className="text-xs text-muted mb-1">
          <Link href={`/${team.slug}/subir`} className="font-bold hover:text-text">
            Subir
          </Link>{" "}
          / Recuperar video
        </div>
        <div className="font-display text-2xl font-bold mb-1">Recuperar video desde Mux</div>
        <div className="text-sm text-muted mb-7">
          Estos son los videos recientes que están en Mux y todavía no pertenecen a ningún partido de la app. Elige el
          que buscas y se crea un partido nuevo en {team.name} con ese video.
        </div>

        {problem ? (
          <div className="text-sm text-muted border border-dashed border-borderMuted rounded-2xl p-8 text-center">
            {problem}
          </div>
        ) : (
          <RecoverVideoForm teamSlug={team.slug} candidates={candidates} />
        )}
      </div>
    </div>
  );
}
