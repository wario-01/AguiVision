// Zona horaria del club. Las páginas se arman en el servidor (que trabaja en
// UTC), así que sin esto un partido de 12:30 PM aparecía como 5:30 PM.
export const CLUB_TZ = "America/Chicago";

export function clubParts(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CLUB_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(p.year),
    month: Number(p.month) - 1, // 0-11
    day: Number(p.day),
    dow: dows.indexOf(p.weekday), // 0 = domingo
    ymd: `${p.year}-${p.month}-${p.day}`,
  };
}

export function clubTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: CLUB_TZ });
}
