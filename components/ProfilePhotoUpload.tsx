"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImage } from "@/lib/resizeImage";

export default function ProfilePhotoUpload({
  currentUrl,
  fullName,
  size = 40,
}: {
  currentUrl: string | null;
  fullName: string;
  size?: number;
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
      formData.append("file", file);
      const res = await fetch("/api/profile-photo", { method: "POST", body: formData });
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
    <label className="relative shrink-0 cursor-pointer" style={{ width: size, height: size }}>
      <div
        className="rounded-full bg-panel2 border border-borderMuted flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
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
