const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL || "AguiVision <notificaciones@nidoaguilaatx.com>";

export const isResendConfigured = Boolean(RESEND_API_KEY);

// Manda un correo con Resend. Si falta configurar la clave, no rompe nada —
// simplemente no manda el correo (la acción principal, como crear el
// highlight, ya se guardó de todos modos).
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  if (!RESEND_API_KEY || to.length === 0) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
  } catch (err) {
    // Un correo que no sale no debería tumbar la acción principal —
    // solo lo dejamos en los logs para poder revisarlo.
    console.error("Error mandando email con Resend:", err);
  }
}
