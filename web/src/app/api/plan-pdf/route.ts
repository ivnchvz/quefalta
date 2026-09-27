// GET /api/plan-pdf?lat=..&lon=..&cat=..  →  the business plan PDF for that point and business type.
// Stateless: the analysis is recomputed from the parameters, so nothing about the user is stored and
// Zavu can fetch the same URL to deliver the PDF over WhatsApp. Includes a live Google Maps check
// when GOOGLE_PLACES_API_KEY is configured (the PDF is still produced without it).

import { analyzePoint } from "@/lib/engine";
import { launchPlan } from "@/lib/launch";
import { googleCheck, type GoogleCheck } from "@/lib/places";
import { renderPlanPdf } from "@/lib/planPdf";
import { loadDatasetFromDisk } from "@/lib/serverData";

const GOOGLE_TIMEOUT_MS = 8000;

async function liveCheck(params: Parameters<typeof googleCheck>[0]): Promise<GoogleCheck | null> {
  if (!process.env.GOOGLE_PLACES_API_KEY) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), GOOGLE_TIMEOUT_MS));
  return Promise.race([googleCheck(params).catch(() => null), timeout]);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const cat = params.get("cat") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "Parámetros lat/lon inválidos." }, { status: 400 });
  }

  const ds = await loadDatasetFromDisk();
  const analysis = analyzePoint(ds, lat, lon);
  const result = analysis.results.find((r) => r.category.id === cat);
  if (!result) return Response.json({ error: "Giro desconocido." }, { status: 400 });

  const google = await liveCheck({ lat, lon, radiusM: analysis.radiusM, query: result.category.q, types: result.category.gtypes });
  const pdf = await renderPlanPdf({ analysis, result, plan: launchPlan(result.category), google });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="plan-${cat}.pdf"`,
    },
  });
}
