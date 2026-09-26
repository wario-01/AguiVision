"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "coach", label: "Entrenador" },
  { value: "assistant", label: "Asistente" },
  { value: "player", label: "Jugador" },
  { value: "parent", label: "Madre/Padre" },
];

export default function InviteForm({ teamSlug }: { teamSlug: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("parent");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlug, email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo invitar");
      setEmail("");
      setStatus("idle");
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Ocurrió un error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 flex-wrap">
      <div className="flex-grow min-w-[200px]">
        <label className="block text-xs font-bold text-muted mb-1.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="familia@ejemplo.com"
          className="w-full box-border bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted mb-1.5">Rol</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-semibold"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="bg-gold text-bg rounded-lg px-5 py-2 text-sm font-extrabold disabled:opacity-60"
      >
        {status === "saving" ? "Invitando..." : "Invitar"}
      </button>
      {message && <div className="w-full text-sm text-red">{message}</div>}
    </form>
  );
}
