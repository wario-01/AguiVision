"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase todavía no está configurado en este entorno.");
      return;
    }
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gold flex items-center justify-center font-display font-bold text-bg text-xl mb-3">
            AV
          </div>
          <div className="font-display text-2xl font-bold text-text">AguiVision</div>
        </div>

        {status === "sent" ? (
          <div className="bg-panel border border-border rounded-2xl p-6 text-center">
            <div className="text-text font-bold text-sm mb-2">Revisá tu correo</div>
            <div className="text-muted text-sm">
              Te mandamos un enlace de acceso a <span className="text-text font-semibold">{email}</span>. Abrilo desde este mismo dispositivo para entrar.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-2xl p-6">
            <label className="block text-xs font-bold text-muted mb-1.5">Tu nombre</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Diego Castillo"
              className="w-full box-border bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm font-semibold text-text mb-4"
            />
            <label className="block text-xs font-bold text-muted mb-1.5">Tu correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="entrenador@nidoaguila.com"
              className="w-full box-border bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm font-semibold text-text mb-4"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full bg-gold text-bg rounded-xl py-3 text-sm font-extrabold disabled:opacity-60"
            >
              {status === "sending" ? "Enviando..." : "Enviarme el enlace de acceso"}
            </button>
            {status === "error" && <div className="mt-3 text-sm text-red">{message}</div>}
            <div className="mt-4 text-xs text-muted text-center">
              Sin contraseña — te mandamos un enlace para entrar directo.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
