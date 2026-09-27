// WhatsApp conversation logic. Given an inbound Zavu event, returns the Zavu message bodies to send back.
// It never sends anything itself: the n8n workflow delivers these through Zavu with its own credential.
//
//   "Hola" / anything else         → welcome + location request
//   shared location                → list of the best opportunities around that point
//   list selection "plan|cat|lat|lon" or text "Quiero mi plan: cat @lat,lon" (from the web button)
//                                  → summary + plan PDF

import { analyzePoint, type Dataset } from "./engine";
import { launchPlan } from "./launch";

export type ZavuMessage = Record<string, unknown> & { to: string; channel: "whatsapp" };

type InboundEvent = {
  type?: string;
  data?: {
    from?: string;
    channel?: string;
    messageType?: string;
    text?: string;
    content?: { latitude?: number; longitude?: number; interactiveReply?: { id?: string } };
  };
};

// Rough bounding box of Chihuahua city; points outside it have no data behind them.
const inCity = (lat: number, lon: number) => lat > 28.45 && lat < 28.9 && lon > -106.3 && lon < -105.85;
const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

// Matches planRequestText() in lib/whatsapp.ts: "Quiero mi plan: lavanderia @28.63650,-106.07700".
const PLAN_TEXT = /plan:?\s*([a-z_]+)\s*@\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i;

function planMessages(ds: Dataset, to: string, catId: string, lat: number, lon: number, baseUrl: string): ZavuMessage[] {
  if (!inCity(lat, lon)) return [{ to, channel: "whatsapp", text: "Ese punto está fuera de la ciudad de Chihuahua; por ahora solo tenemos datos de la ciudad. 📍" }];
  const analysis = analyzePoint(ds, lat, lon);
  const result = analysis.results.find((r) => r.category.id === catId);
  if (!result) return [{ to, channel: "whatsapp", text: "No reconocí ese giro. Comparte tu ubicación y te muestro las opciones. 📍" }];
  const plan = launchPlan(result.category);

  const summary =
    `Aquí está tu plan para abrir *${result.category.name}* en la zona que elegiste (radio de 1 km).\n\n` +
    `📊 Hay ${result.actual} negocios de este giro; para una zona así se esperan ~${Math.round(result.expected)}.\n` +
    `📋 Te faltan ${plan.documents.length} documentos y ${plan.steps.length} trámites: todo viene en el PDF, en orden.\n` +
    (plan.lowRisk ? "✅ Tu giro es de bajo riesgo: puedes abrir por el SARE en máximo 3 días hábiles.\n" : "") +
    "💡 Primer paso recomendado: visita Estación Emprende (Av. Independencia y Victoria).";
  const pdfUrl = `${baseUrl}/api/plan-pdf?${new URLSearchParams({ lat: String(lat), lon: String(lon), cat: catId })}`;

  return [
    { to, channel: "whatsapp", text: summary },
    {
      to,
      channel: "whatsapp",
      messageType: "document",
      text: "Tu plan completo: documentos, trámites, apoyos y qué validar en campo.",
      content: { mediaUrl: pdfUrl, filename: `Plan-${catId}.pdf` },
    },
  ];
}

function opportunityList(ds: Dataset, to: string, lat: number, lon: number): ZavuMessage[] {
  if (!inCity(lat, lon)) return [{ to, channel: "whatsapp", text: "Esa ubicación está fuera de la ciudad de Chihuahua; por ahora solo tenemos datos de la ciudad. 📍" }];
  const analysis = analyzePoint(ds, lat, lon);
  const usable = analysis.results.filter((r) => r.confidence !== "baja" && r.category.scope === "barrio");
  let rows = usable.filter((r) => r.status === "opportunity");
  const intro = rows.length
    ? `En 1 km a la redonda viven ~${analysis.features.pop.toLocaleString("es-MX")} personas. Estos negocios hacen falta según los datos del INEGI:`
    : "No encontramos huecos claros en esta zona. Estos giros son los que están más cerca de tener espacio:";
  if (!rows.length) rows = usable.filter((r) => r.score > 0).slice(0, 5);
  if (!rows.length) return [{ to, channel: "whatsapp", text: "En esta zona la oferta está cubierta para todos los giros que analizamos. Prueba con otro punto. 📍" }];

  return [
    {
      to,
      channel: "whatsapp",
      messageType: "list",
      text: intro,
      content: {
        listButton: "Ver negocios",
        sections: [
          {
            title: "Oportunidades",
            rows: rows.slice(0, 10).map((r) => ({
              id: `plan|${r.category.id}|${lat.toFixed(5)}|${lon.toFixed(5)}`,
              title: cut(r.category.name, 24),
              description: cut(`Hay ${r.actual} · se esperan ~${Math.round(r.expected)} · confianza ${r.confidence}`, 72),
            })),
          },
        ],
      },
    },
  ];
}

export function replyTo(event: InboundEvent, ds: Dataset, baseUrl: string): ZavuMessage[] {
  const d = event.data;
  if (event.type !== "message.inbound" || d?.channel !== "whatsapp" || !d.from) return [];
  const to = d.from;

  const picked = d.content?.interactiveReply?.id;
  if (picked?.startsWith("plan|")) {
    const [, catId, lat, lon] = picked.split("|");
    return planMessages(ds, to, catId, Number(lat), Number(lon), baseUrl);
  }
  const typed = d.text?.match(PLAN_TEXT);
  if (typed) return planMessages(ds, to, typed[1].toLowerCase(), Number(typed[2]), Number(typed[3]), baseUrl);

  if (d.messageType === "location" && d.content?.latitude != null && d.content.longitude != null) {
    return opportunityList(ds, to, d.content.latitude, d.content.longitude);
  }

  return [
    {
      to,
      channel: "whatsapp",
      messageType: "location_request",
      text:
        "¡Hola! 👋 Soy *QueFalta*: te digo qué negocio hace falta en cualquier punto de Chihuahua y cómo abrirlo, con datos del INEGI.\n\n" +
        "📍 Comparte la ubicación donde te gustaría abrir tu negocio.",
    },
  ];
}
