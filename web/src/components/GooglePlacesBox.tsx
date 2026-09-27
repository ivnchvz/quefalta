"use client";

import { useState } from "react";
import type { Analysis, CategoryResult } from "@/lib/engine";
import { googleVerdict } from "@/lib/placesShared";

type Place = {
  name: string;
  distanceM: number;
  rating: number | null;
  reviews: number;
  status: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  openNow: boolean | null;
  opensLate: boolean;
  hoursToday: string | null;
  mapsUrl: string | null;
};
type Result = {
  places: Place[];
  summary: {
    operating: number;
    closedPermanently: number;
    avgRating: number | null;
    opensLate: number;
    truncated: boolean;
    typeFiltered: boolean;
    excluded: number;
  };
};

const TONE = { holds: "bg-tile-a text-ink", smaller: "bg-tile-b text-ink", covered: "bg-ink text-white" } as const;

function verdict(google: number, inegi: number, expected: number) {
  const v = googleVerdict(google, inegi, expected);
  return { tone: TONE[v.level], text: v.text };
}

// Google requires "Google Maps" text attribution in Roboto/sans-serif, weight 400, 12–16px, gray #5E5E5E.
function GoogleMapsAttribution() {
  return <span style={{ fontFamily: "Roboto, Arial, sans-serif", fontWeight: 400, fontSize: 12, color: "#5E5E5E" }}>Google Maps</span>;
}

export default function GooglePlacesBox({ analysis, result }: { analysis: Analysis; result: CategoryResult }) {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: analysis.lat,
          lon: analysis.lon,
          radiusM: analysis.radiusM,
          query: result.category.q,
          types: result.category.gtypes,
        }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "No se pudo consultar Google Maps.");
      else setData(json);
    } catch {
      setError("No se pudo consultar Google Maps.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl bg-card p-5 text-ink">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-full border border-ink px-3 py-1 text-[10px] uppercase tracking-[0.08em]">Revisión en vivo</span>
        <GoogleMapsAttribution />
      </div>
      <p className="mt-3 text-lg leading-snug">
        Negocios recientes, <span className="text-headline-gray">calificaciones y horarios en 1 km que INEGI no tiene.</span>
      </p>

      {!data && (
        <button
          onClick={check}
          disabled={loading}
          className="mt-4 w-full rounded-full bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
        >
          {loading ? "Consultando…" : "Consultar"}
        </button>
      )}
      {error && <p className="mt-3 rounded-2xl bg-tile-a px-3 py-2 text-sm">{error}</p>}

      {data && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(
              [
                ["INEGI", String(result.actual), "bg-tile-a"],
                ["Google", `${data.summary.operating}${data.summary.truncated ? "+" : ""}`, "bg-tile-b"],
                ["Esperado", `~${Math.round(result.expected)}`, "bg-tile-a"],
              ] as const
            ).map(([label, value, bg]) => (
              <div key={label} className={`rounded-2xl p-1.5 ${bg}`}>
                <div className="px-1.5 pb-1 text-[11px]">{label}</div>
                <div className="rounded-xl bg-white py-1.5 text-center text-xl font-light">{value}</div>
              </div>
            ))}
          </div>
          {(() => {
            const v = verdict(data.summary.operating, result.actual, result.expected);
            return <p className={`mt-3 rounded-2xl px-3 py-2.5 text-sm ${v.tone}`}>{v.text}</p>;
          })()}
          <ul className="mt-3 space-y-1.5 border-t border-ink/10 pt-3 text-sm">
            {data.summary.avgRating !== null && (
              <li className="flex justify-between"><span className="text-ink-soft">Calificación promedio</span><span>★ {data.summary.avgRating}</span></li>
            )}
            <li className="flex justify-between"><span className="text-ink-soft">Abren hasta las 21 h o más</span><span>{data.summary.opensLate}</span></li>
            {data.summary.closedPermanently > 0 && (
              <li className="flex justify-between"><span className="text-ink-soft">Cerrados permanentemente</span><span>{data.summary.closedPermanently}</span></li>
            )}
          </ul>
          <p className="mt-2 text-[10px] text-ink-soft">
            {data.summary.typeFiltered
              ? data.summary.excluded > 0
                ? `Filtrado por tipo de negocio de Google: descartamos ${data.summary.excluded} resultado(s) que no son del giro.`
                : "Filtrado por tipo de negocio de Google."
              : "Google no tiene un tipo específico para este giro: búsqueda solo por palabra clave, puede incluir resultados que no son del giro."}
          </p>
          <details className="group mt-3 text-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between text-ink">
              Ver lugares ({data.places.length})
              <span className="text-ink-soft transition group-open:rotate-90">›</span>
            </summary>
            <ul className="mt-2 divide-y divide-ink/10">
              {data.places.map((p, i) => (
                <li key={i} className="py-2">
                  <div className="flex justify-between gap-2">
                    {p.mapsUrl ? (
                      <a href={p.mapsUrl} target="_blank" rel="noreferrer" className="truncate font-medium underline underline-offset-2">{p.name}</a>
                    ) : (
                      <span className="truncate font-medium">{p.name}</span>
                    )}
                    <span className="shrink-0 text-xs text-ink-soft">
                      {p.distanceM} m{p.rating !== null && <> · ★ {p.rating} ({p.reviews})</>}
                    </span>
                  </div>
                  {p.status === "CLOSED_PERMANENTLY" && <div className="text-xs">Cerrado permanentemente</div>}
                  {p.status === "CLOSED_TEMPORARILY" && <div className="text-xs">Cerrado temporalmente</div>}
                  {p.hoursToday && <div className="text-xs text-ink-soft">{p.hoursToday}</div>}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
