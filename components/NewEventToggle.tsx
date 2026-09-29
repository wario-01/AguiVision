"use client";

import { useState } from "react";
import EventForm from "./EventForm";

export default function NewEventToggle({ teamSlug }: { teamSlug: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold mb-6"
      >
        + Nuevo evento
      </button>
    );
  }

  return (
    <div className="mb-6">
      <EventForm teamSlug={teamSlug} onDone={() => setOpen(false)} />
      <button onClick={() => setOpen(false)} className="text-xs font-bold text-muted mt-3">
        Cancelar
      </button>
    </div>
  );
}
