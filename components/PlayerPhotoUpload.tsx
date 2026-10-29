"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImage } from "@/lib/resizeImage";

export default function PlayerPhotoUpload({
  playerId,
  currentUrl,
  fullName,
  ringColor,
  jersey,
}: {
  playerId: string;
  currentUrl: string | null;
  fullName: string;
  ringColor?: string;
  jersey?: number | null;
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
    const original = e.target.files?.[0];
    if (!original) return;
    setPreview(URL.createObjectURL(original));
    setBusy(true);
    try {
      const file = await resizeImage(original);
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
      <div
        className="w-12 h-12 rounded-full bg-panel2 flex items-center justify-center overflow-hidden"
        style={{ boxShadow: `0 0 0 2px ${ringColor ?? "#2F74B8"}` }}
      >
        {preview ? (
          <img src={preview} alt={fullName} className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-xs font-bold text-muted">{initials}</span>
        )}
      </div>
      {jersey != null && (
        <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-bg border border-borderMuted text-[10px] font-extrabold text-gold flex items-center justify-center">
          {jersey}
        </span>
      )}
      {busy && (
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
          <span className="text-[8px] text-text">...</span>
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </label>
  );
}
