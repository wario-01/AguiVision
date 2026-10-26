"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Interruptor "Fotos" por miembro: da o quita el permiso de subir y ver
// fotos sin cambiarle el rol (por ejemplo, una mamá que sigue viendo la
// evaluación de su hijo pero además ayuda con las fotos).
export default function PhotoAccessToggle({ memberId, enabled }: { memberId: string; enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/team-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, photoAccess: !enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo cambiar");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        title={enabled ? "Puede subir y ver fotos. Toca para quitar." : "Toca para darle acceso a las fotos."}
        className={`text-[11px] font-extrabold rounded-full px-2.5 py-1 border disabled:opacity-60 ${
          enabled ? "border-goldBorderDim text-goldText bg-goldBgDim" : "border-borderMuted text-muted"
        }`}
      >
        📷 Fotos: {enabled ? "Sí" : "No"}
      </button>
      {error && <span className="text-[11px] text-red">{error}</span>}
    </span>
  );
}
