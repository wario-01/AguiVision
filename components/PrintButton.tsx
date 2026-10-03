"use client";

// components/PrintButton.tsx

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print bg-gold text-bg rounded-lg px-5 py-2.5 text-sm font-extrabold"
    >
      Descargar PDF
    </button>
  );
}
