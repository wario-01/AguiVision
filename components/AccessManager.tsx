"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = { id: string; email: string; full_name: string; level: string; can_issue: boolean };
const LABELS: Record<string, string> = {
  owner: "Superusuario",
  admin: "Administrador",
};

export default function AccessManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [level, setLevel] = useState("admin");
  const [canIssue, setCanIssue] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/recibos/accesos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName, level, canIssue }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "No se pudo guardar");
    setEmail("");
    setFullName("");
    router.refresh();
  }

  async function toggleIssue(r: Row) {
    const res = await fetch("/api/recibos/accesos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, canIssue: !r.can_issue }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "No se pudo cambiar");
    router.refresh();
  }

  async function remove(r: Row) {
    if (!confirm(`¿Quitar el acceso a recibos de ${r.full_name}?`)) return;
    const res = await fetch("/api/recibos/accesos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "No se pudo quitar");
    router.refresh();
  }

  const input = "w-full box-border bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm font-semibold";
  return (
    <div>
      <div className="bg-panel border border-border rounded-2xl overflow-hidden mb-8">
        {rows.map((r, i) => (
          <div key={r.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${i < rows.length - 1 ? "border-b border-border" : ""}`}>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{r.full_name}</div>
              <div className="text-xs text-muted truncate">{r.email}</div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs font-bold text-gold">{LABELS[r.level] ?? r.level}</span>
              <button
                onClick={() => toggleIssue(r)}
                title="Toca para dar o quitar el permiso de expedir recibos"
                className={`text-[11px] font-extrabold rounded-full px-2.5 py-1 border ${
                  r.can_issue ? "border-goldBorderDim text-goldText bg-goldBgDim" : "border-borderMuted text-muted"
                }`}
              >
                Expide: {r.can_issue ? "Sí" : "No"}
              </button>
              {r.level !== "owner" && (
                <button onClick={() => remove(r)} className="text-xs font-bold text-red hover:underline">Quitar</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="font-display text-lg font-semibold mb-3">Agregar persona</div>
      <form onSubmit={add} className="flex flex-col gap-3">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre (como saldrá en el recibo, ej: Sara)" maxLength={60} className={input} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo con el que entra a AguiVision" className={input} />
        <select value={level} onChange={(e) => setLevel(e.target.value)} className={input}>
          <option value="admin">Administrador (ve reportes)</option>
          <option value="owner">Superusuario (ve todo, anula recibos, maneja accesos)</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={canIssue} onChange={(e) => setCanIssue(e.target.checked)} />
          Puede expedir recibos
        </label>
        {error && <div className="text-sm text-red">{error}</div>}
        <button disabled={busy} className="bg-gold text-bg rounded-xl py-3 text-sm font-extrabold disabled:opacity-60">
          {busy ? "Guardando..." : "Agregar"}
        </button>
      </form>
    </div>
  );
}
