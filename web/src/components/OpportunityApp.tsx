"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { analyzePoint, loadDataset, type Analysis, type CategoryResult, type Dataset } from "@/lib/engine";
import CategoryDetail from "./CategoryDetail";
import { ArrowCircle, Collapsible, ConfidenceDot, GapBar, Logo, Pill, Stat, fmt, pct } from "./ui";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

function CategoryRow({ r, onSelect }: { r: CategoryResult; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="group w-full rounded-2xl bg-card px-4 py-3 text-left text-ink transition hover:bg-white">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[15px] font-medium">{r.category.name}</span>
        <ArrowCircle dir="down-right" size="h-6 w-6" className="border-ink/30 text-ink transition group-hover:border-ink" />
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-ink-soft">
        <span>
          Hay <b className="font-medium text-ink">{r.actual}</b> · se esperan <b className="font-medium text-ink">~{Math.round(r.expected)}</b>
        </span>
        <ConfidenceDot level={r.confidence} />
      </div>
      <GapBar actual={r.actual} expected={r.expected} />
    </button>
  );
}

export default function OpportunityApp() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadDataset().then(setDs).catch((e) => setError(String(e)));
  }, []);

  const pick = (lat: number, lon: number) => {
    if (!ds) return;
    setAnalysis(analyzePoint(ds, lat, lon));
    setSelectedId(null);
  };

  const selected = useMemo(() => analysis?.results.find((r) => r.category.id === selectedId) ?? null, [analysis, selectedId]);
  const opportunities = analysis?.results.filter((r) => r.status === "opportunity") ?? [];
  const saturated = analysis?.results.filter((r) => r.status === "saturated").reverse() ?? [];
  const f = analysis?.features;

  return (
    <div className="flex h-screen w-full flex-col bg-bg md:flex-row">
      <div className="relative h-[45vh] p-2 md:h-full md:flex-1 md:p-3 md:pr-0">
        <div className="h-full w-full overflow-hidden rounded-3xl">
          <MapView analysis={analysis} selected={selected} onPick={pick} />
        </div>
        {!analysis && (
          <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto w-fit rounded-full border border-on-dark/40 bg-bg/85 px-4 py-2 text-xs text-on-dark backdrop-blur">
            {ds ? "Haz clic en cualquier punto de Chihuahua" : error ? `Error cargando datos: ${error}` : "Cargando datos del INEGI…"}
          </div>
        )}
        {analysis && (
          <div className="absolute bottom-6 left-6 flex gap-3 rounded-full bg-bg/85 px-4 py-2 text-[10px] text-on-dark backdrop-blur">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-on-dark" />Radio 1 km</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-on-dark-soft" />Zonas parecidas</span>
            {selected && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white" />Competidores</span>}
          </div>
        )}
      </div>

      <aside className="h-[55vh] overflow-y-auto md:h-full md:w-[440px]">
        {selected && analysis ? (
          <CategoryDetail key={`${analysis.lat},${analysis.lon},${selected.category.id}`} analysis={analysis} result={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="space-y-3 p-3">
            <header className="px-3 pb-3 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Logo className="text-on-dark" />
                  <Pill>Mapa de oportunidades</Pill>
                </div>
                <ArrowCircle className="border-on-dark text-on-dark" />
              </div>
              <h1 className="mt-8 text-[44px] font-light leading-[0.95] tracking-tight text-on-dark">¿Qué negocio hace falta aquí?</h1>
              <p className="mt-4 text-xs text-on-dark-soft">
                Datos del INEGI para <span className="text-on-dark">cada punto de Chihuahua</span>
              </p>
            </header>

            {!analysis && (
              <section className="rounded-3xl bg-card px-6 py-7 text-center text-ink">
                <Pill variant="light">Introducción</Pill>
                <p className="mt-5 text-xl leading-snug">
                  Elige un punto en el mapa.{" "}
                  <span className="text-headline-gray">
                    Comparamos lo que hay en 1 km (~15 min caminando) con lo que zonas parecidas de la ciudad suelen tener.
                  </span>
                </p>
                <Logo className="mt-6 text-ink-soft" />
              </section>
            )}

            {analysis && f && (
              <>
                <section className="rounded-3xl bg-card p-5 text-ink">
                  <div className="flex items-center gap-2">
                    <ArrowCircle dir="down-right" size="h-8 w-8" className="border-ink text-ink" />
                    <Pill variant="light">La zona · 1 km</Pill>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3">
                    <Stat label="Habitantes" value={fmt(f.pop)} />
                    <Stat label="Trabajadores" value={`~${fmt(f.workers)}`} />
                    <Stat label="Negocios" value={fmt(f.biz)} />
                    <Stat label="Niños 0–14" value={pct(f.kids)} />
                    <Stat label="Adultos 65+" value={pct(f.seniors)} />
                    <Stat label="Hogares con auto" value={pct(f.cars)} />
                  </div>
                  {analysis.lowPopulation && (
                    <p className="mt-4 rounded-2xl bg-tile-a px-3 py-2 text-xs text-ink">Poca población residencial: resultados menos confiables.</p>
                  )}
                </section>

                <section className="rounded-3xl bg-card-dark p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <Pill variant="filled">Oportunidades</Pill>
                      <p className="mt-3 max-w-[200px] text-xs text-on-dark-soft">Menos negocios de los esperados para una zona así.</p>
                    </div>
                    <span className="text-7xl font-light leading-none text-on-dark">{String(opportunities.length).padStart(2, "0")}</span>
                  </div>
                </section>
                {opportunities.length === 0 ? (
                  <p className="rounded-2xl bg-card px-4 py-3 text-sm text-ink-soft">Sin huecos claros: la oferta está cerca de lo esperado.</p>
                ) : (
                  <div className="space-y-2">
                    {opportunities.map((r) => <CategoryRow key={r.category.id} r={r} onSelect={() => setSelectedId(r.category.id)} />)}
                  </div>
                )}

                {saturated.length > 0 && (
                  <Collapsible label="Muy concentrados aquí" count={saturated.length}>
                    <p className="mb-2 text-xs text-on-dark-soft">Más negocios de lo esperado: competencia fuerte o polo especializado.</p>
                    <div className="space-y-2">
                      {saturated.map((r) => <CategoryRow key={r.category.id} r={r} onSelect={() => setSelectedId(r.category.id)} />)}
                    </div>
                  </Collapsible>
                )}

                <Collapsible label="Todos los giros" count={analysis.results.length}>
                  <div className="space-y-2">
                    {analysis.results.map((r) => <CategoryRow key={r.category.id} r={r} onSelect={() => setSelectedId(r.category.id)} />)}
                  </div>
                </Collapsible>

                <p className="flex items-start gap-2 px-3 pb-4 pt-2 text-[10px] leading-snug text-on-dark-soft">
                  Datos: INEGI DENUE (registros a abril de 2026), Censo 2020 y Marco Geoestadístico 2020. Las oportunidades son hipótesis a validar.
                </p>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
