"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteHighlightButton({
  highlightId,
  teamSlug,
}: {
  highlightId: string;
  teamSlug: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("¿Borrar este highlight? No se puede deshacer.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/highlights", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo borrar el highlight");
        setBusy(false);
        return;
      }
      router.push(`/${teamSlug}/highlights`);
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
      className="mt-4 text-xs font-bold text-red hover:opacity-80 disabled:opacity-50"
    >
      Borrar highlight
    </button>
  );
}
