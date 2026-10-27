"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";

export default function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  async function handle() {
    const ok = await copyText(text);
    setState(ok ? "ok" : "fail");
    setTimeout(() => setState("idle"), 2200);
  }
  return (
    <button
      type="button"
      onClick={handle}
      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-extrabold ${
        state === "ok" ? "bg-ok text-bg" : state === "fail" ? "bg-red text-redText" : "bg-gold text-bg"
      } ${className}`}
    >
      {state === "ok" ? "¡Copiado!" : state === "fail" ? "Selecciónalo" : "Copiar"}
    </button>
  );
}
