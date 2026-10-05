// lib/escapeHtml.ts
//
// Escapa texto antes de meterlo en el HTML de un correo, para que un nombre
// o título con "<" o "&" no pueda inyectar contenido en el mensaje.

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
