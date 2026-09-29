"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EventDeleteButton({ eventId }: { eventId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("¿Borrar este evento?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) {
        alert("No se pudo borrar el evento");
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
      onClick={handleDelete}
      disabled={busy}
      className="text-xs font-bold text-red hover:opacity-80 disabled:opacity-50 shrink-0"
    >
      Borrar
    </button>
  );
}
