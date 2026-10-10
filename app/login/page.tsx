"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  const rawNext = params.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const linkFailed = params.get("error") === "link";

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setCodeMsg("");
    try {
      const supabase = createClient();
      if (!supabase) {
        setCodeMsg("Supabase todavía no está configurado en este entorno.");
        setChecking(false);
        return;
      }
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.replace(/\s/g, ""),
        type: "email",
      });
      if (!error) {
        await fetch("/auth/linked", { method: "POST" }).catch(() => null);
        router.replace(next);
        router.refresh();
        return;
      }
      setCodeMsg("Código incorrecto o vencido. Pide uno nuevo.");
    } catch {
      setCodeMsg("Error de conexión. Intenta de nuevo.");
    }
    setChecking(false);
  }

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
          <img src="/logo.png" alt="Nido Águila" className="w-14 h-14 rounded-full object-contain mb-3" />
          <div className="font-display text-2xl font-bold text-text">AguiVision</div>
        </div>

        {linkFailed && status !== "sent" && (
          <div className="mb-4 bg-panel border border-border rounded-xl p-4 text-sm text-muted">
            <span className="text-text font-bold">El enlace no funcionó en este navegador.</span> Pasa a veces cuando
            se abre desde la app de Gmail. Pide un acceso nuevo y usa el <b>código de 6 dígitos</b> del correo.
          </div>
        )}
        {status === "sent" ? (
          <div className="bg-panel border border-border rounded-2xl p-6 text-center">
            <div className="text-text font-bold text-sm mb-2">Revisa tu correo</div>
            <div className="text-muted text-sm mb-4">
              Te mandamos un acceso a <span className="text-text font-semibold">{email}</span>. Toca el enlace, o
              escribe aquí el <b>código de 6 dígitos</b> que viene en el mismo correo.
            </div>
            <form onSubmit={handleCode}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código"
                className="w-full box-border bg-bg border border-border rounded-lg px-3.5 py-2.5 text-center text-lg tracking-widest font-bold text-text mb-3"
              />
              <button
                type="submit"
                disabled={checking || code.trim().length < 6}
                className="w-full bg-gold text-bg rounded-xl py-3 text-sm font-extrabold disabled:opacity-60"
              >
                {checking ? "Entrando..." : "Entrar con el código"}
              </button>
              {codeMsg && <div className="mt-3 text-sm text-red">{codeMsg}</div>}
            </form>
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
