"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CopyButton from "./CopyButton";

type Credentials = {
  liveStreamId: string;
  serverUrl?: string;
  serverUrlSecure?: string;
  streamKey?: string;
  note?: string;
};

export default function StartStreamForm({ teamSlug }: { teamSlug: string }) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "creating" | "created" | "ending" | "error">("idle");
  const [message, setMessage] = useState("");
  const [creds, setCreds] = useState<Credentials | null>(null);
  const router = useRouter();

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setStatus("creating");
    setMessage("");
    try {
      const res = await fetch("/api/live-streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlug, title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la transmisión");
      setCreds(data);
      setStatus("created");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  async function handleEnd() {
    if (!creds) return;
    if (!confirm("¿Terminar la transmisión?")) return;
    setStatus("ending");
    try {
      const res = await fetch("/api/live-streams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveStreamId: creds.liveStreamId }),
      });
      if (!res.ok) throw new Error("No se pudo terminar la transmisión");
      setCreds(null);
      setTitle("");
      setStatus("idle");
      router.push("/en-vivo");
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  if (creds) {
    return (
      <div className="bg-panel border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-red" />
          <span className="text-sm font-extrabold">Transmisión creada — configura tu cámara</span>
        </div>

        {creds.note && <div className="text-sm text-muted mb-4">{creds.note}</div>}

        {creds.streamKey && (
          <div className="flex flex-col gap-3 mb-5">
            <div>
              <div className="text-xs font-bold text-muted mb-1">Server URL</div>
              <div className="flex items-center gap-2">
                <code className="flex-grow bg-bg border border-border rounded-lg px-3 py-2 text-xs break-all select-all">
                  {creds.serverUrl}
                </code>
                <CopyButton text={creds.serverUrl!} />
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-muted mb-1">Stream Key (secreta — no la compartas)</div>
              <div className="flex items-center gap-2">
                <code className="flex-grow bg-bg border border-border rounded-lg px-3 py-2 text-xs break-all select-all">
                  {creds.streamKey}
                </code>
                <CopyButton text={creds.streamKey!} />
              </div>
            </div>
            <div className="text-xs text-muted">
              Pega estos dos datos en tu cámara o app de transmisión (Larix Broadcaster, OBS, etc.). En cuanto
              empiece a llegar la señal, esta transmisión aparecerá sola en "En vivo" para todo el equipo.
            </div>
          </div>
        )}

        <button
          onClick={handleEnd}
          disabled={status === "ending"}
          className="w-full bg-red text-redText rounded-xl py-3 text-sm font-extrabold disabled:opacity-60"
        >
          {status === "ending" ? "Terminando..." : "Terminar transmisión"}
        </button>
        {message && <div className="mt-3 text-sm text-red">{message}</div>}
      </div>
    );
  }

  return (
    <>
    <div className="bg-panel border border-border rounded-2xl p-5 mb-4">
      <div className="text-xs font-bold text-muted uppercase tracking-wide mb-2">Antes de empezar</div>
      <ul className="text-sm text-muted flex flex-col gap-1.5 list-disc pl-4">
        <li>Celular o cámara con batería suficiente (o conectado a corriente).</li>
        <li>Buena señal: wifi del campo o datos con cobertura.</li>
        <li>Celular en horizontal y sin que se bloquee la pantalla.</li>
      </ul>
    </div>
    <form onSubmit={handleStart} className="bg-panel border border-border rounded-2xl p-5">
      <label className="block text-xs font-bold text-muted mb-1.5">Título</label>
      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ej: vs Halcones"
        className="w-full box-border bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm font-semibold mb-4"
      />
      <button
        type="submit"
        disabled={status === "creating"}
        className="w-full bg-red text-redText rounded-xl py-3 text-sm font-extrabold disabled:opacity-60"
      >
        {status === "creating" ? "Creando..." : "Iniciar transmisión"}
      </button>
      {message && <div className="mt-3 text-sm text-red">{message}</div>}
    </form>
    </>
  );
}
