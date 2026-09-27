"use client";

import { useState } from "react";

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // el navegador no dejó copiar — no es grave
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 bg-panel border border-border rounded-lg px-3.5 py-2 text-xs font-bold shrink-0"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#F5EFD6" strokeWidth={2}>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
      </svg>
      {copied ? "¡Copiado!" : "Copiar enlace"}
    </button>
  );
}
