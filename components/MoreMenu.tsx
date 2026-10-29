"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type MoreItem = { key: string; href: string; label: string; svg: React.ReactNode };

// Botón "Más" de la barra inferior (celular): abre una hoja con el resto de las secciones.
export default function MoreMenu({ items, activeKey }: { items: MoreItem[]; activeKey: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const isActive = items.some((i) => i.key === activeKey);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="absolute left-0 right-0 bottom-[64px] bg-sidebar border-t border-border rounded-t-2xl p-4 pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2">
              {items.map((i) => (
                <Link
                  key={i.key}
                  href={i.href}
                  className={`flex flex-col items-center gap-1.5 rounded-xl py-3 border ${
                    activeKey === i.key ? "bg-cream border-cream" : "bg-panel border-border"
                  }`}
                >
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" strokeWidth={2} stroke={activeKey === i.key ? "#003C71" : "#A9C0DD"}>
                    {i.svg}
                  </svg>
                  <span className={`text-[11px] font-bold ${activeKey === i.key ? "text-bg" : "text-muted"}`}>{i.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex flex-col items-center justify-center gap-0.5 py-2 flex-1 min-w-0 ${isActive || open ? "bg-cream" : ""}`}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" strokeWidth={2.5} strokeLinecap="round" stroke={isActive || open ? "#003C71" : "#A9C0DD"}>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
        <span className={`text-[10px] font-semibold ${isActive || open ? "text-bg font-extrabold" : "text-muted"}`}>Más</span>
      </button>
    </>
  );
}
