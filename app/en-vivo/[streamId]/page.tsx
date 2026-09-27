import Link from "next/link";
import { notFound } from "next/navigation";
import { getLiveStreamById, getLiveStreams } from "@/lib/data";
import MatchPlayer from "@/components/MatchPlayer";

export default async function WatchStreamPage({ params }: { params: { streamId: string } }) {
  const stream = await getLiveStreamById(params.streamId);
  if (!stream) notFound();

  const otherStreams = (await getLiveStreams()).filter((s) => s.id !== stream.id);

  return (
    <div className="min-h-screen bg-bg px-5 py-8 md:p-11 max-w-5xl mx-auto">
      <Link href="/en-vivo" className="text-sm text-muted font-semibold mb-5 inline-block">
        ← Todas las transmisiones
      </Link>

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
      <div className="mb-8">
        <div className="text-xs font-bold text-gold uppercase tracking-wide mb-1">{stream.team_name}</div>
        <div className="font-display text-xl font-bold">{stream.title}</div>
        <div className="text-sm text-muted">{stream.viewer_count} viendo ahora</div>
      </div>

      {otherStreams.length > 0 && (
        <>
          <div className="font-display text-base font-semibold mb-3">Otras transmisiones en vivo</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {otherStreams.map((s) => (
              <Link
                key={s.id}
                href={`/en-vivo/${s.id}`}
                className="bg-panel border border-border rounded-xl p-3.5 hover:border-borderMuted"
              >
                <div className="text-xs font-bold text-gold uppercase mb-1">{s.team_name}</div>
                <div className="text-sm font-bold">{s.title}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
