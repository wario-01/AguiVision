"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";

// Compartir la transmisión: WhatsApp (lo más usado por las familias) y copiar enlace.
export default function ShareStream({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => (typeof window !== "undefined" ? window.location.href : "");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          const text = `🔴 ${title} — míralo en vivo: ${url()}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        }}
        className="flex items-center gap-2 bg-[#25D366] text-[#08301A] rounded-lg px-3.5 py-2 text-xs font-extrabold shrink-0"
      >
        Compartir por WhatsApp
      </a>
      <button
        type="button"
        onClick={async () => {
          if (await copyText(url())) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
        className="flex items-center gap-2 bg-panel border border-border rounded-lg px-3.5 py-2 text-xs font-bold shrink-0"
      >
        {copied ? "¡Copiado!" : "Copiar enlace"}
      </button>
    </div>
  );
}
