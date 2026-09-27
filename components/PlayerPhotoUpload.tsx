"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PlayerPhotoUpload({
  playerId,
  currentUrl,
  fullName,
}: {
  playerId: string;
  currentUrl: string | null;
  fullName: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("playerId", playerId);
      formData.append("file", file);
      const res = await fetch("/api/player-photo", { method: "POST", body: formData });
      if (!res.ok) {
        alert("No se pudo subir la foto");
        setPreview(currentUrl);
      } else {
        router.refresh();
      }
    } catch {
      alert("Ocurrió un error");
      setPreview(currentUrl);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="relative shrink-0 cursor-pointer">
      <div className="w-10 h-10 rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden">
        {preview ? (
          <img src={preview} alt={fullName} className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-xs font-bold text-muted">{initials}</span>
        )}
      </div>
      {busy && (
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
          <span className="text-[8px] text-text">...</span>
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </label>
  );
}
