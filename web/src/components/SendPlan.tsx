"use client";

import type { Analysis, CategoryResult } from "@/lib/engine";
import { planRequestText, whatsappLink } from "@/lib/whatsapp";

export default function SendPlan({ analysis, result }: { analysis: Analysis; result: CategoryResult }) {
  const query = new URLSearchParams({ lat: String(analysis.lat), lon: String(analysis.lon), cat: result.category.id });
  // The user sends the pre-filled message themselves: that opens WhatsApp's 24-hour window, and the
  // bot (n8n + Zavu) answers with the summary and the PDF.
  const waHref = whatsappLink(planRequestText(result.category.id, analysis.lat, analysis.lon));

  return (
    <div className="flex gap-2">
      <a
        href={`/api/plan-pdf?${query}`}
        target="_blank"
        rel="noreferrer"
        className="flex-1 rounded-full border border-on-dark px-3 py-2 text-center text-xs text-on-dark transition hover:bg-white/10"
      >
        Descargar plan · PDF
      </a>
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="flex-1 rounded-full bg-on-dark px-3 py-2 text-center text-xs font-medium text-ink transition hover:bg-white"
      >
        Recibir en WhatsApp
      </a>
    </div>
  );
}
