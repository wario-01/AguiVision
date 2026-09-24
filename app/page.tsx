import { redirect } from "next/navigation";
import { getMyTeams } from "@/lib/data";

export default async function Home() {
  const teams = await getMyTeams();
  redirect(teams.length > 0 ? `/${teams[0].slug}` : "/en-vivo");
}
