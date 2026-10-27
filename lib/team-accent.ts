// Color de acento por categoría (se usa en puntos, anillos y barras).
const ACCENTS: Record<string, string> = {
  U9: "#4FD1A5", // verde
  U11: "#5B9BFF", // azul claro
  U12: "#E0585A", // rojo
  U14: "#F59E42", // naranja
};
export function teamAccent(ageCategory?: string | null): string {
  return (ageCategory && ACCENTS[ageCategory.toUpperCase()]) || "#F0D875";
}
