# QueFalta · ¿Qué negocio hace falta aquí?

Motor de oportunidades comerciales para Chihuahua capital. Eliges un punto en el mapa y la app compara lo que hay en 1 km con lo que zonas parecidas de la ciudad suelen tener: qué negocios faltan, qué tan confiable es la estimación, cómo abrir el negocio (trámites, dependencias y apoyos verificados) y un plan en PDF que también llega por WhatsApp.

Proyecto de INNOVATHON 2.0 (Chihuahua, 2026). En producción: https://quefalta.vercel.app

## Cómo funciona

- **Datos (INEGI):** DENUE (39,413 negocios del municipio, registros a abril de 2026), Censo de Población 2020 por manzana y Marco Geoestadístico 2020.
- **Modelo:** para cada uno de 59 giros, una regresión entrenada con las 661 zonas (AGEB) de la ciudad predice cuántos negocios tendría una zona según quién vive y trabaja ahí. La R² con validación cruzada se muestra como "confianza"; los giros con confianza baja nunca se recomiendan.
- **Cómo abrirlo:** catálogo de bajo riesgo del SARE, trámites municipales y estatales, y programas de apoyo (Estación Emprende, FOMECH…), con fuente oficial y fecha de verificación (`web/src/lib/launch.ts`).
- **Revisión en vivo:** Google Places API (New) para negocios recientes, calificaciones y horarios.
- **WhatsApp:** Zavu (número de WhatsApp Business) → n8n → `/api/wa-bot` decide la respuesta → n8n la envía con Zavu.

## Estructura

```
web/          App Next.js (mapa, motor, PDF, endpoints)
  src/lib/engine.ts      Motor de oportunidades (corre en el navegador y en el servidor)
  src/lib/launch.ts      Trámites, documentos y apoyos verificados
  src/lib/planPdf.ts     PDF del plan (pdfkit + Inter Tight)
  src/lib/waBot.ts       Lógica de la conversación de WhatsApp
  src/app/api/           plan-pdf · places · wa-bot · report
  public/data/           Datos procesados que carga la app
data-prep/    Scripts de Python que generan public/data desde los datos del INEGI
n8n/          Workflow de WhatsApp (importable en n8n)
sources.md    Fuentes consultadas
```

## Correr en local

```bash
cd web
npm install          # también copia el worker de MapLibre a public/maplibre
cp .env.local.example .env.local   # y llena las claves que uses
npm run dev          # http://localhost:3000
```

Variables (`web/.env.local`), todas opcionales para el mapa y el análisis:

| Variable | Para qué |
|---|---|
| `GOOGLE_PLACES_API_KEY` | Revisión en vivo con Google Maps (web y PDF) |
| `ANTHROPIC_API_KEY` o `CLAUDE_PROVIDER=bedrock` + credenciales AWS | Pestaña "Plan con IA" |
| `PUBLIC_BASE_URL` | URL pública de la app (links al PDF que envía el bot) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp del bot (por defecto 17083840040) |

## Regenerar los datos

Requiere Python 3 y `pdftotext` (poppler).

```bash
python3 -m venv .venv && .venv/bin/pip install pyshp pyproj numpy
mkdir -p data-prep/raw/{denue,censo,marco}
# DENUE Chihuahua:         https://www.inegi.org.mx/contenidos/masiva/denue/denue_08_csv.zip   → raw/denue/
# Censo 2020 por manzana:  https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/ageb_manzana/ageb_mza_urbana_08_cpv2020_csv.zip → raw/censo/
# Marco Geoestadístico:    https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/marcogeo/889463807469/08_chihuahua.zip → raw/marco/ (archivos 08m.*)
.venv/bin/python data-prep/build_data.py   # blocks, businesses, reference (+ modelos), categories
.venv/bin/python data-prep/build_sare.py   # catálogo de giros de bajo riesgo del SARE
```

## WhatsApp (n8n + Zavu)

1. Importa `n8n/quefalta-whatsapp.workflow.json` en n8n y asigna una credencial *Header Auth* con `Authorization: Bearer <ZAVU_API_KEY>`.
2. Activa el workflow y configura el webhook del sender de Zavu (`message.inbound`) apuntando a `https://<tu-n8n>/webhook/quefalta-zavu`.

## Limitaciones

- La población viene del Censo 2020: colonias nuevas están subestimadas.
- DENUE solo cubre negocios fijos y formales; los trabajadores se estiman con el punto medio de los rangos de personal.
- Las oportunidades son hipótesis a validar en campo, no garantías.

Fuentes de datos: INEGI. Tipografía: Inter Tight (SIL Open Font License, `web/src/fonts/OFL.txt`).
