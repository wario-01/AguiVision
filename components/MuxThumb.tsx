// Imagen de vista previa de un video de Mux. Si no hay video todavía,
// muestra el fondo con el texto de "Procesando...".
export default function MuxThumb({
  playbackId,
  className = "",
  width = 480,
  time,
  play = true,
  children,
}: {
  playbackId?: string | null;
  className?: string;
  width?: number;
  time?: number;
  play?: boolean;
  children?: React.ReactNode;
}) {
  const src = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${width}${time != null ? `&time=${time}` : ""}`
    : null;
  return (
    <div className={`bg-panel2 border border-borderMuted relative overflow-hidden flex items-center justify-center ${className}`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {playbackId ? (
        play && (
          <svg viewBox="0 0 24 24" width="26" height="26" className="relative">
            <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)" />
            <path d="M10 8l6 4-6 4z" fill="#F5EFD6" />
          </svg>
        )
      ) : (
        <span className="text-[10px] font-bold text-muted relative">Procesando...</span>
      )}
      {children}
    </div>
  );
}
