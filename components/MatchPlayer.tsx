"use client";

import MuxPlayer from "@mux/mux-player-react";

export default function MatchPlayer({ playbackId }: { playbackId: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-border">
      <MuxPlayer playbackId={playbackId} streamType="on-demand" accentColor="#F0D875" />
    </div>
  );
}
