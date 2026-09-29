"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImage } from "@/lib/resizeImage";

export default function SponsorLogoForm({
  teamSlug,
  currentUrl,
}: {
  teamSlug: string;
  currentUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0] ?? null;
    if (!original) return;
    const resized = await resizeImage(original, 1000);
    setFile(resized);
    setPreview(URL.createObjectURL(resized));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("saving");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("teamSlug", teamSlug);
      formData.append("file", file);
      const res = await fetch("/api/sponsor-logo", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir el logo");
      setStatus("idle");
      setFile(null);
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-2xl p-5">
      <div className="font-display text-base font-semibold mb-1">Patrocinador</div>
      <div className="text-xs text-muted mb-4">
        Se muestra en la pantalla de cada transmisión en vivo. Subí uno nuevo cuando cambie de patrocinador.
      </div>

      <div className="bg-bg border border-border rounded-xl p-4 flex items-center justify-center mb-4 h-20">
        {preview ? (
          <img src={preview} alt="Patrocinador" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted">Sin logo cargado todavía</span>
        )}
      </div>

      <label className="block bg-gold text-bg rounded-lg px-4 py-2.5 text-sm font-extrabold text-center cursor-pointer mb-3">
        {file ? file.name : "Elegir imagen"}
        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </label>

      {file && (
        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full bg-panel2 border border-borderMuted rounded-lg px-4 py-2.5 text-sm font-extrabold disabled:opacity-60"
        >
          {status === "saving" ? "Subiendo..." : "Guardar patrocinador"}
        </button>
      )}
      {message && <div className="mt-3 text-sm text-red">{message}</div>}
    </form>
  );
}
