import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import type { FinanceAccess } from "@/lib/finance";
import { getMyTeams } from "@/lib/data";

// Marco de las pantallas de Recibos (son a nivel de todo el club, no de un equipo).
export default async function RecibosShell({
  access,
  active,
  children,
  wide,
}: {
  access: FinanceAccess;
  active: "reportes" | "nuevo" | "anteriores" | "accesos";
  children: React.ReactNode;
  wide?: boolean;
}) {
  const teams = await getMyTeams();
  const back = teams.length > 0 ? `/${teams[0].slug}` : null;
  const tab = (on: boolean) =>
    `text-sm font-bold rounded-full px-4 py-2 border whitespace-nowrap ${
      on ? "bg-panel border-border text-gold" : "border-transparent text-muted hover:text-text"
    }`;
  return (
    <div className="min-h-screen bg-bg">
      <div className="no-print bg-sidebar border-b border-border">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <img src="/logo.png" alt="Nido Austin" className="w-[30px] h-[30px] rounded-full object-contain" />
          <div className="font-display text-base font-bold">AguiVision · Recibos</div>
          <div className="flex-grow" />
          {back && (
            <Link href={back} className="text-xs font-bold text-muted hover:text-text">
              ← Volver a la app
            </Link>
          )}
          <LogoutButton label="Cerrar sesión" className="text-[11px] font-bold text-muted border border-borderMuted rounded-full px-2.5 py-1" />
        </div>
        <div className="max-w-5xl mx-auto px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          <Link href="/recibos" className={tab(active === "reportes")}>Reportes</Link>
          {access.canIssue && (
            <Link href="/recibos/nuevo" className={tab(active === "nuevo")}>+ Nuevo recibo</Link>
          )}
          {(access.canIssue || access.level === "owner") && (
            <Link href="/recibos/anteriores" className={tab(active === "anteriores")}>Pagos anteriores</Link>
          )}
          {access.level === "owner" && (
            <Link href="/recibos/accesos" className={tab(active === "accesos")}>Accesos</Link>
          )}
        </div>
      </div>
      <div className={`print-area mx-auto px-5 py-8 md:py-10 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{children}</div>
    </div>
  );
}
