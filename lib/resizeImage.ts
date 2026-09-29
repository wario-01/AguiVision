// Achica y comprime una imagen ANTES de subirla — corre en el navegador,
// así el archivo pesado original nunca sale del celular/computadora.
// Con esto, una foto de 10 MB de la cámara termina pesando unos 100-300 KB.
export async function resizeImage(
  file: File,
  maxDimension = 800,
  quality = 0.82
): Promise<File> {
  // Si ya es chica, no hace falta procesarla — evita trabajo de más.
  if (file.size < 250_000) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // por si el navegador no soporta canvas, seguimos con el original

  ctx.drawImage(bitmap, 0, 0, width, height);

  // El logo del patrocinador puede tener transparencia (PNG) — la
  // respetamos. Las fotos de personas van a JPEG, mucho más liviano.
  const keepPng = file.type === "image/png";
  const outType = keepPng ? "image/png" : "image/jpeg";
  const ext = keepPng ? "png" : "jpg";

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, outType, keepPng ? undefined : quality)
  );
  if (!blob) return file;

  // Si por algún motivo la versión "comprimida" salió más pesada que la
  // original (pasa a veces con PNGs chicos), nos quedamos con la original.
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + "." + ext;
  return new File([blob], newName, { type: outType });
}
