import { NextResponse } from "next/server";

// POST /api/public/contacto
// Formulario de contacto del sitio web (nidoaustintx.com). Manda el mensaje
// por correo (Resend) a info@nidoaustintx.com; el Email Worker de Cloudflare
// lo reparte al staff. Responder al correo le contesta directo al papá
// (reply_to). No guarda nada en la base de datos.
//
// Protección contra spam: solo acepta el formulario desde el sitio del club,
// un campo oculto que los robots llenan (honeypot), un tiempo mínimo para
// llenar el formulario, límites de longitud y un límite de envíos por IP.
//
// Variables de entorno (opcionales):
//   CONTACT_TO_EMAIL   destino            (por defecto info@nidoaustintx.com)
//   CONTACT_FROM_EMAIL remitente          (por defecto Nido Austin <web@nidoaustintx.com>)

export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = [
  "https://nidoaustintx.com",
  "https://www.nidoaustintx.com",
  "https://nido-austin.pages.dev",
];
const TO = process.env.CONTACT_TO_EMAIL || "info@nidoaustintx.com";
const FROM = process.env.CONTACT_FROM_EMAIL || "Nido Austin <web@nidoaustintx.com>";
// Si la clave de Resend no puede enviar desde nidoaustintx.com, usa el remitente de la app.
const FALLBACK_FROM = process.env.RESEND_FROM_EMAIL || "AguiVision <notificaciones@nidoaguilaatx.com>";

const TOPICS: Record<string, string> = {
  tryouts: "Pruebas 2026-27 / Tryouts",
  info: "Información general / General info",
  aguivision: "AguiVision",
};

// Límite sencillo por IP (en memoria de cada instancia; suficiente contra abusos básicos).
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5; // máx. 5 mensajes cada 10 minutos por IP
}

function cors(origin: string | null) {
  const ok = origin && ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: "origin" }, { status: 403, headers });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "email_not_configured" }, { status: 503, headers });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400, headers });

  // Robots: el campo oculto viene lleno o el formulario se envió en menos de 3 s.
  if (clean(body.website, 200) || (typeof body.elapsed === "number" && body.elapsed < 3000)) {
    return NextResponse.json({ ok: true }, { headers }); // se finge éxito y no se manda nada
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) return NextResponse.json({ error: "too_many" }, { status: 429, headers });

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const phone = clean(body.phone, 40);
  const year = clean(body.year, 40);
  const topic = TOPICS[clean(body.topic, 30)] ?? TOPICS.info;
  const message = clean(body.message, 3000);
  const lang = body.lang === "es" ? "es" : "en";
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || message.length < 2) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400, headers });
  }

  const subject = `Sitio web · ${topic} · ${name}`;
  const row = (k: string, v: string) =>
    v ? `<tr><td style="padding:6px 12px 6px 0;color:#58677c;white-space:nowrap">${k}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>` : "";
  const html = `<div style="font-family:Arial,sans-serif;color:#1b2a3e;max-width:560px">
<h2 style="color:#003C71;margin:0 0 4px">Nuevo mensaje desde nidoaustintx.com</h2>
<p style="margin:0 0 16px;color:#58677c">Responde a este correo para contestarle directo al papá o mamá.</p>
<table style="border-collapse:collapse;font-size:14px">
${row("Nombre", name)}${row("Correo", email)}${row("Teléfono", phone)}${row("Año de nacimiento / categoría", year)}${row("Motivo", topic)}${row("Idioma del sitio", lang === "es" ? "Español" : "Inglés")}
</table>
<div style="margin-top:16px;padding:14px 16px;background:#f3f6fa;border-left:4px solid #F9E547;white-space:pre-wrap;font-size:14px">${esc(message)}</div>
</div>`;

  async function send(from: string) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [TO], reply_to: email, subject, html }),
    });
    return res.ok;
  }

  try {
    const ok = (await send(FROM)) || (FROM !== FALLBACK_FROM && (await send(FALLBACK_FROM)));
    if (!ok) return NextResponse.json({ error: "send_failed" }, { status: 502, headers });
  } catch (err) {
    console.error("contacto: error con Resend", err);
    return NextResponse.json({ error: "send_failed" }, { status: 502, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
