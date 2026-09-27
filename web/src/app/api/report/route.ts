import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";

// Provider: Anthropic API by default (ANTHROPIC_API_KEY); set CLAUDE_PROVIDER=bedrock to bill the
// AWS credits instead (uses AWS_REGION and the standard AWS credential chain).
const useBedrock = process.env.CLAUDE_PROVIDER === "bedrock";
const client = useBedrock ? new AnthropicBedrockMantle() : new Anthropic();
const MODEL = useBedrock ? "anthropic.claude-opus-5" : "claude-opus-5";

const SYSTEM = `Eres un analista de oportunidades comerciales que ayuda a emprendedores de Chihuahua, México, a decidir si abrir un negocio en un punto específico de la ciudad.

Recibirás datos calculados por un modelo estadístico entrenado con datos oficiales del INEGI (DENUE con registros a abril de 2026, Censo de Población 2020): quién vive y trabaja en un radio de 1 km, cuántos negocios del giro existen, cuántos se esperarían para una zona así, qué tan confiable es ese modelo para el giro y dónde están los competidores.

También recibirás "ruta_de_tramites" y "apoyos": trámites, dependencias y programas de apoyo verificados en fuentes oficiales para este giro en la ciudad de Chihuahua.

Reglas:
- Todo lo que digas sobre la zona debe salir de los datos proporcionados. No inventes calles, negocios, cifras locales ni tendencias que no estén en los datos.
- Para trámites, dependencias, direcciones, teléfonos, tiempos de trámite y programas de apoyo usa únicamente "ruta_de_tramites" y "apoyos". No agregues dependencias, requisitos, teléfonos, direcciones ni costos de trámites que no estén ahí.
- Cuando uses conocimiento general (precios típicos, inversión inicial, márgenes, equipo necesario), márcalo explícitamente como estimación general para México, no como dato de la zona.
- Si la confianza del modelo es media o hay poca población, dilo con claridad y explica qué implica.
- Sé concreto y útil para alguien sin formación en datos. Nada de relleno.
- No uses tablas.

Responde en español de México, en Markdown, con estas secciones (encabezados ##) y en unas 650-850 palabras en total:
## Veredicto
## Quién sería el cliente
## Competencia
## Qué tipo de negocio tendría sentido aquí
## Números estimados (estimación general)
Inversión inicial por rubros, rango de precios, gastos fijos mensuales y cuántos clientes al día necesitarías para cubrirlos, todo como estimación general.
## Plan para ponerlo en marcha
Un plan por semanas desde hoy hasta la apertura (y el primer mes operando): en qué orden hacer los trámites de "ruta_de_tramites" y con qué dependencia, qué hacer mientras se resuelven (local, equipo, proveedores, personal) y cuáles de los "apoyos" usar y en qué momento, respetando cuándo aplica cada uno.
## Riesgos
## Qué validar antes de invertir
En la última sección da 4-6 acciones concretas y baratas para validar en campo (por ejemplo: contar personas en horas específicas, visitar competidores, buscar locales en renta), señalando qué dato falta en nuestro análisis que cada acción cubre (tráfico peatonal, rentas, horarios, calidad de la competencia).`;

export async function POST(request: Request) {
  const payload = await request.json();

  const params = {
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" as const }, // a focused report; keeps the demo responsive
    system: SYSTEM,
    messages: [
      {
        role: "user" as const,
        content: `Analiza esta oportunidad con los siguientes datos (JSON):\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  };

  // Server-side refusal fallbacks are only available on the Anthropic API, not on Bedrock.
  const stream = useBedrock
    ? client.beta.messages.stream(params)
    : client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n_No fue posible generar el análisis para esta solicitud._"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n_(El análisis se cortó por longitud.)_"));
        }
      } catch (error) {
        const message =
          error instanceof Anthropic.AuthenticationError
            ? "Falta configurar la clave de Claude (ANTHROPIC_API_KEY) o las credenciales de AWS."
            : error instanceof Anthropic.RateLimitError
              ? "Demasiadas solicitudes; intenta de nuevo en unos segundos."
              : error instanceof Anthropic.APIError
                ? `Error del servicio de IA (${error.status}).`
                : "No se pudo conectar con el servicio de IA. Revisa ANTHROPIC_API_KEY (o las credenciales de AWS si usas CLAUDE_PROVIDER=bedrock) en .env.local.";
        console.error("report generation failed", error);
        controller.enqueue(encoder.encode(`\n\n⚠️ ${message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
