// lib/imageUpload.ts
//
// Validación de imágenes subidas por los usuarios (fotos, logos). Los
// archivos van a un bucket público, así que solo se aceptan formatos de
// imagen "planos" (nada de SVG, que puede llevar scripts) y con tope de
// tamaño. La extensión sale del tipo real, no del nombre del archivo.

const TIPOS_PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function checkImage(file: File): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = TIPOS_PERMITIDOS[file.type];
  if (!ext) {
    return { ok: false, error: "La imagen tiene que ser JPG, PNG, WEBP o GIF" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "La imagen pesa demasiado (máximo 5 MB)" };
  }
  return { ok: true, ext };
}
