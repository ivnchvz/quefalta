// POST /api/places { lat, lon, radiusM, query, types }  →  live Google Maps check (see lib/places.ts).

import { googleCheck, PlacesError, type GoogleCheckParams } from "@/lib/places";

export async function POST(request: Request) {
  try {
    return Response.json(await googleCheck((await request.json()) as GoogleCheckParams));
  } catch (e) {
    const status = e instanceof PlacesError ? e.status : 500;
    return Response.json({ error: e instanceof Error ? e.message : "No se pudo consultar Google Maps." }, { status });
  }
}
