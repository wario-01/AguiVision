"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton({
  className = "text-[11px] font-bold text-muted hover:text-text text-left mt-1",
  label = "Cerrar sesión",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className={className}
    >
      {label}
    </button>
  );
}
