"use client";

import MuxPlayer from "@mux/mux-player-react";

export default function MatchPlayer({ playbackId, live = false }: { playbackId: string; live?: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-border">
      <MuxPlayer
        playbackId={playbackId}
        streamType={live ? "live" : "on-demand"}
        accentColor="#F0D875"
        autoPlay={live}
      />
    </div>
  );
}
