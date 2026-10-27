import { redirect } from "next/navigation";
import { getMyTeams } from "@/lib/data";
import { getFinanceAccess } from "@/lib/finance";

export default async function Home() {
  const teams = await getMyTeams();
  if (teams.length > 0) redirect(`/${teams[0].slug}`);
  // Sin equipo pero con acceso a Recibos (por ejemplo, quien solo expide recibos).
  if (await getFinanceAccess()) redirect("/recibos");
  redirect("/en-vivo");
}
