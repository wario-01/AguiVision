"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteMatchButtons({ matchId, teamSlug }: { matchId: string; teamSlug: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete(mode: "video" | "all") {
    const msg =
      mode === "all"
        ? "¿Borrar este partido por completo? Se borran también sus highlights. No se puede deshacer."
        : "¿Borrar el video de este partido? Los highlights ya creados también se van a borrar. El partido en sí queda, por si querés subir otro video. No se puede deshacer.";
    if (!confirm(msg)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/matches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo borrar");
        setBusy(false);
        return;
      }
      if (mode === "all") {
        router.push(`/${teamSlug}`);
      }
      router.refresh();
    } catch {
      alert("Ocurrió un error");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4 mt-3">
      <button
        onClick={() => handleDelete("video")}
        disabled={busy}
        className="text-xs font-bold text-red hover:opacity-80 disabled:opacity-50"
      >
        Borrar video
      </button>
      <button
        onClick={() => handleDelete("all")}
        disabled={busy}
        className="text-xs font-bold text-red hover:opacity-80 disabled:opacity-50"
      >
        Borrar partido completo
      </button>
    </div>
  );
}
