// Canciones incluidas en la app (archivos en public/musica/, de Pixabay Music).
// Los ids empiezan con "lib:" para distinguirlas de las que el equipo sube a su biblioteca.
// Créditos y licencia: public/musica/CREDITOS.txt
export type BuiltinTrack = { id: string; title: string; url: string };

export const BUILTIN_TRACKS: BuiltinTrack[] = [
  { id: "lib:rock-energetico", title: "Rock enérgico (intro)", url: "/musica/rock-energetico.mp3" },
  { id: "lib:rock-indie-deportivo", title: "Rock indie deportivo", url: "/musica/rock-indie-deportivo.mp3" },
  { id: "lib:indie-rock-animado", title: "Indie rock animado", url: "/musica/indie-rock-animado.mp3" },
  { id: "lib:metal-intenso", title: "Metal intenso", url: "/musica/metal-intenso.mp3" },
  { id: "lib:epica-cinematografica", title: "Épica cinematográfica (corta)", url: "/musica/epica-cinematografica.mp3" },
  { id: "lib:musica-de-fondo", title: "Música de fondo", url: "/musica/musica-de-fondo.mp3" },
];

export const builtinTrack = (id: string | null | undefined) => BUILTIN_TRACKS.find((t) => t.id === id) ?? null;
