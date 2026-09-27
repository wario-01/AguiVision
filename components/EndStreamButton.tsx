"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EndStreamButton({ liveStreamId }: { liveStreamId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleEnd() {
    if (!confirm("¿Terminar esta transmisión?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/live-streams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveStreamId }),
      });
      if (!res.ok) {
        alert("No se pudo terminar la transmisión");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Ocurrió un error");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleEnd}
      disabled={busy}
      className="text-xs font-bold text-red hover:opacity-80 disabled:opacity-50"
    >
      {busy ? "Terminando..." : "Terminar"}
    </button>
  );
}
