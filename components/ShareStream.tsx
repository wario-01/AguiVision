"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";

// Compartir la transmisión. "Compartir" abre el menú del celular (WhatsApp, Facebook,
// Mensajes, etc.); si el navegador no lo tiene (compu), copia el enlace.
export default function ShareStream({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (await copyText(window.location.href)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `🔴 ${title}`, text: `🔴 ${title} — míralo en vivo`, url });
      } catch {
        // la persona cerró el menú: no pasa nada
      }
      return;
    }
    await copyLink();
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={share}
        className="flex items-center gap-2 bg-gold text-bg rounded-lg px-3.5 py-2 text-xs font-extrabold shrink-0"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" />
        </svg>
        Compartir
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="flex items-center gap-2 bg-panel border border-border rounded-lg px-3.5 py-2 text-xs font-bold shrink-0"
      >
        {copied ? "¡Copiado!" : "Copiar enlace"}
      </button>
    </div>
  );
}
