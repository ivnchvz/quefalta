"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Analysis, CategoryResult } from "@/lib/engine";
import { launchPlan, VERIFIED_ON, type LaunchPlan } from "@/lib/launch";
import GooglePlacesBox from "./GooglePlacesBox";
import SendPlan from "./SendPlan";
import { ArrowCircle, CheckBadge, ConfidenceDot, FactTile, Pill, Tabs, fmt, pct } from "./ui";

type Tab = "resumen" | "competencia" | "abrir" | "plan";
const TABS: { id: Tab; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "competencia", label: "Competencia" },
  { id: "abrir", label: "Cómo abrirlo" },
  { id: "plan", label: "Plan con IA" },
];

// Only the numbers the report needs; the model is instructed to rely on nothing else about the area.
function reportPayload(analysis: Analysis, r: CategoryResult, plan: LaunchPlan) {
  const f = analysis.features;
  return {
    giro_de_bajo_riesgo_SARE: plan.lowRisk,
    ruta_de_tramites: plan.steps.map((s) => ({ tramite: s.name, dependencia: s.agency, nivel: s.level, para_que: s.what, detalles: s.details })),
    apoyos: plan.programs.map((p) => ({ programa: p.name, dependencia: p.agency, que_ofrece: p.what, cuando_aplica: p.fit })),
    giro: r.category.name,
    tipo_de_giro: r.category.scope === "barrio" ? "de barrio (depende de quien vive y trabaja cerca)" : "de destino",
    zona_radio_1km: {
      habitantes: f.pop,
      trabajadores_aprox: f.workers,
      negocios_totales: f.biz,
      ninos_0_14: pct(f.kids),
      adultos_65_mas: pct(f.seniors),
      escolaridad_promedio_anios: Number(f.schooling.toFixed(1)),
      hogares_con_auto: pct(f.cars),
      poca_poblacion: analysis.lowPopulation,
    },
    giro_en_la_zona: {
      negocios_actuales: r.actual,
      esperados_por_modelo: r.expected,
      mediana_en_15_zonas_parecidas: r.twinExpected,
      zonas_parecidas_que_tienen_al_menos_uno: pct(r.twinPresence),
      habitantes_por_negocio_aqui: r.residentsPerBusiness,
      habitantes_por_negocio_en_zonas_parecidas: r.twinResidentsPerBusiness,
      estado: r.status === "opportunity" ? "hueco (menos de lo esperado)" : r.status === "saturated" ? "muy concentrado" : "cerca de lo esperado",
      confianza_del_modelo: `${r.confidence} (explica ${pct(r.modelR2)} de la variación entre zonas; error típico ±${r.modelMae} negocios)`,
      competidor_mas_cercano_m: r.nearestCompetitorM,
      competidores_cercanos: r.competitors.slice(0, 8).map((c) => ({ nombre: c.name, distancia_m: c.distanceM, empleados: c.size })),
    },
    otros_huecos_en_la_zona: analysis.results.filter((x) => x.status === "opportunity" && x !== r).slice(0, 5).map((x) => x.category.name),
    giros_muy_concentrados_en_la_zona: analysis.results.filter((x) => x.status === "saturated").slice(-5).map((x) => x.category.name),
  };
}

const STATUS = {
  opportunity: { pill: "Oportunidad", lead: "Hay menos negocios", rest: " de los que el modelo espera para una zona así." },
  saturated: { pill: "Muy concentrado", lead: "Hay más negocios de lo esperado:", rest: " competencia fuerte o polo especializado." },
  balanced: { pill: "Equilibrado", lead: "La oferta está cerca", rest: " de lo esperado para una zona así." },
} as const;

function Summary({ r }: { r: CategoryResult }) {
  const s = STATUS[r.status];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <FactTile label="Aquí" value={String(r.actual)} />
        <FactTile label="Esperados" value={`~${Math.round(r.expected)}`} tone="b" />
        <FactTile label="Parecidas" value={String(r.twinExpected)} />
      </div>
      <section className="rounded-3xl bg-card p-5 text-ink">
        <p className="text-xl leading-snug">
          {s.lead}
          <span className="text-headline-gray">{s.rest}</span>
        </p>
        <ul className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
          {r.residentsPerBusiness !== null && (
            <li className="flex justify-between gap-3">
              <span className="text-ink-soft">Habitantes por negocio</span>
              <span>
                {fmt(r.residentsPerBusiness)}
                {r.twinResidentsPerBusiness !== null && <span className="text-ink-soft"> · parecidas {fmt(r.twinResidentsPerBusiness)}</span>}
              </span>
            </li>
          )}
          {r.nearestCompetitorM !== null && (
            <li className="flex justify-between gap-3">
              <span className="text-ink-soft">Competidor más cercano</span>
              <span>{fmt(r.nearestCompetitorM)} m</span>
            </li>
          )}
          <li className="flex items-center justify-between gap-3">
            <ConfidenceDot level={r.confidence} />
            <span className="text-xs text-ink-soft">explica el {pct(r.modelR2)} de la variación (±{r.modelMae})</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Competition({ analysis, r }: { analysis: Analysis; r: CategoryResult }) {
  return (
    <div className="space-y-3">
      <GooglePlacesBox analysis={analysis} result={r} />
      <section className="rounded-3xl bg-card p-5 text-ink">
        <Pill variant="light">Según INEGI</Pill>
        {r.competitors.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No hay negocios de este giro en 3 km.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10 text-sm">
            {r.competitors.map((c, i) => (
              <li key={i} className="flex justify-between gap-2 py-2">
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-xs text-ink-soft">{fmt(c.distanceM)} m · {c.size} emp.</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HowToOpen({ plan }: { plan: LaunchPlan }) {
  return (
    <div className="space-y-2">
      <section className="rounded-3xl bg-card-dark p-5">
        <Pill variant="filled">{plan.lowRisk ? "Apertura rápida · SARE" : "Ruta ordinaria"}</Pill>
        <p className="mt-3 text-lg font-light leading-snug text-on-dark">
          {plan.lowRisk ? "Tu giro es de bajo riesgo: " : "Tu giro no está en el catálogo de bajo riesgo: "}
          <span className="text-on-dark-soft">
            {plan.lowRisk ? "uso de suelo, Protección Civil y licencia en una ventanilla, máximo 3 días hábiles." : "sigue los trámites en orden y los permisos especiales."}
          </span>
        </p>
      </section>

      {plan.steps.map((s, i) => (
        <details key={s.id} className="group rounded-2xl bg-card text-ink">
          <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3">
            <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full border border-ink px-2 text-[10px]">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1">
              <span className="block text-sm font-medium">{s.name}</span>
              <span className="block text-xs text-ink-soft">{s.agency} · {s.level}</span>
            </span>
            <ArrowCircle dir="down-right" size="h-6 w-6" className="border-ink/30 transition group-open:rotate-90" />
          </summary>
          <div className="space-y-1.5 px-4 pb-4 pl-[3.25rem] text-sm">
            <p>{s.what}</p>
            {s.details && <p className="text-ink-soft">{s.details}</p>}
            <a href={s.url} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium underline underline-offset-2">Información oficial ›</a>
          </div>
        </details>
      ))}

      <div className="pt-2">
        <Pill>Apoyos y financiamiento</Pill>
      </div>
      {plan.programs.map((p, i) => (
        <details key={p.id} className={`group rounded-2xl text-ink ${i % 2 ? "bg-tile-b" : "bg-tile-a"}`}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">{p.name}</span>
              <span className="block text-xs text-ink/70">{p.fit}</span>
            </span>
            <CheckBadge />
          </summary>
          <div className="space-y-1.5 px-4 pb-4 text-sm">
            <p>{p.what}</p>
            <p className="text-xs text-ink/60">{p.agency}</p>
            <a href={p.source} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium underline underline-offset-2">Fuente ›</a>
          </div>
        </details>
      ))}

      <p className="px-2 pt-1 text-[10px] text-on-dark-soft">Verificado el {VERIFIED_ON}. Confirma requisitos y costos con cada dependencia.</p>
    </div>
  );
}

function AiPlan({ analysis, r, plan }: { analysis: Analysis; r: CategoryResult; plan: LaunchPlan }) {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setReport("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload(analysis, r, plan)),
      });
      if (!res.body) throw new Error("sin respuesta");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setReport((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      setReport((prev) => prev + "\n\n⚠️ No se pudo generar el plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl bg-card p-5 text-ink">
      {!report && (
        <p className="mb-4 text-lg leading-snug">
          Un plan escrito para este punto:{" "}
          <span className="text-headline-gray">veredicto, cliente, números estimados, plan semana a semana y qué validar en campo.</span>
        </p>
      )}
      <button
        onClick={generate}
        disabled={loading}
        className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
      >
        {loading ? "Preparando tu plan…" : report ? "Volver a generar" : "Generar plan de negocio"}
      </button>
      {report && (
        <article className="mt-5 text-sm leading-relaxed [&_h2]:mb-1 [&_h2]:mt-5 [&_h2]:border-b [&_h2]:border-ink/10 [&_h2]:pb-1 [&_h2]:text-base [&_h2]:font-medium [&_li]:mb-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_strong]:font-medium [&_ul]:ml-5 [&_ul]:list-disc">
          <ReactMarkdown>{report}</ReactMarkdown>
        </article>
      )}
    </section>
  );
}

export default function CategoryDetail({ analysis, result, onBack }: { analysis: Analysis; result: CategoryResult; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("resumen");
  const plan = launchPlan(result.category);

  return (
    <div className="space-y-3 p-3">
      <header className="rounded-3xl bg-card-dark p-5">
        <div className="flex items-center justify-between">
          <button onClick={onBack} aria-label="Volver" className="text-on-dark">
            <ArrowCircle dir="left" size="h-9 w-9" className="border-on-dark transition hover:bg-white/10" />
          </button>
          <Pill variant="filled">{STATUS[result.status].pill}</Pill>
        </div>
        <h2 className="mt-8 text-[38px] font-light leading-[0.98] tracking-tight text-on-dark">{result.category.name}</h2>
        <div className="mt-5">
          <SendPlan analysis={analysis} result={result} />
        </div>
      </header>

      <div className="sticky top-0 z-10 bg-bg/90 py-1 backdrop-blur">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === "resumen" && <Summary r={result} />}
      {tab === "abrir" && <HowToOpen plan={plan} />}
      {/* Kept mounted so a Google check or a generated plan survives switching tabs (and isn't paid for twice). */}
      <div className={tab === "competencia" ? "" : "hidden"}>
        <Competition analysis={analysis} r={result} />
      </div>
      <div className={tab === "plan" ? "" : "hidden"}>
        <AiPlan analysis={analysis} r={result} plan={plan} />
      </div>
    </div>
  );
}
