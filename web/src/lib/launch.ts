// "How to open it": procedures and support programs for opening a business in Chihuahua city.
// Every entry was checked against an official or news source on 2026-09-26 (see `source`).
// Where a detail could not be confirmed, the text says to confirm it with the agency instead of guessing.

import sare from "@/data/sare_codes.json";
import type { Category } from "./engine";

export const VERIFIED_ON = "26 de septiembre de 2026";

export type Step = {
  id: string;
  name: string;
  agency: string;
  level: "Federal" | "Estatal" | "Municipal";
  what: string;
  details?: string; // time, cost, place, as published
  url: string;
  source: string;
};

export type Program = { id: string; name: string; agency: string; what: string; fit: string; source: string };

const STEPS: Record<string, Step> = {
  rfc: {
    id: "rfc",
    name: "Inscripción al RFC y e.firma",
    agency: "SAT",
    level: "Federal",
    what: "Darte de alta ante Hacienda para poder facturar y operar formalmente.",
    details: "Se puede hacer en el propio SARE del Municipio con el programa «SAT en el SARE».",
    url: "https://www.sat.gob.mx",
    source: "https://www.municipiochihuahua.gob.mx/CCS/Prensa/Tramita_las_licencias_y_permisos_necesarios_para_tu_negocio_con_programa_SAT_en_el_SARE",
  },
  sare: {
    id: "sare",
    name: "Apertura rápida en el SARE (tu giro es de bajo riesgo)",
    agency: "SARE – Municipio de Chihuahua",
    level: "Municipal",
    what: "En una sola ventanilla tramitas la licencia de uso de suelo, el dictamen de Protección Civil para bajo riesgo y la licencia de funcionamiento.",
    details:
      "Resolución en un máximo de 3 días hábiles si tu giro está en el Catálogo de Giros de Bajo Riesgo y cumples requisitos (el catálogo fija límites de superficie y aforo). Av. Independencia y calle Victoria, Zona Centro, 8:30 a 16:00 h.",
    url: "https://www.municipiochihuahua.gob.mx/CCS/Prensa/Conoce_el_SARE_del_Gobierno_Municipal_para_apertura_r%C3%A1pida_de_empresas",
    source: "https://www.municipiochihuahua.gob.mx/Descargas/Adicional%20Gacetas/Manual%20de%20Procedimientos%20para%20la%20operaci%C3%B3n%20del%20SARE.pdf",
  },
  uso_suelo: {
    id: "uso_suelo",
    name: "Licencia de uso de suelo",
    agency: "Dirección de Desarrollo Urbano y Ecología (Municipio)",
    level: "Municipal",
    what: "Confirma que en ese local se permite tu giro según el Plan de Desarrollo Urbano.",
    details:
      "5 días hábiles; vigencia de 5 años; costo según la Ley de Ingresos (p. ej. 10 UMAs para comercio vecinal). En línea (Munitecnia) o en Camino a la Presa Chuvíscar 1108, col. Campesina Nueva (072 ext. 6044).",
    url: "https://tramitesenlineacuu.mpiochih.gob.mx/web/fichaAsunto.do?asas_ide_asu=2445",
    source: "https://tramitesenlineacuu.mpiochih.gob.mx/web/fichaAsunto.do?asas_ide_asu=2445",
  },
  proteccion_civil: {
    id: "proteccion_civil",
    name: "Dictamen / Programa Interno de Protección Civil",
    agency: "Coordinación Municipal de Protección Civil",
    level: "Municipal",
    what: "Revisión de seguridad del local (extintores, salidas, instalaciones) según el riesgo del giro.",
    details: "Confirma con Protección Civil el tipo de programa que corresponde a tu giro y superficie.",
    url: "https://www.municipiochihuahua.gob.mx/Transparenciaarchivos/SHA/Normatividad/R4-%20Reg%20prot%20civ/Reg%20prot%20civ.pdf",
    source: "https://www.municipiochihuahua.gob.mx/Transparenciaarchivos/SHA/Normatividad/R4-%20Reg%20prot%20civ/Reg%20prot%20civ.pdf",
  },
  licencia_funcionamiento: {
    id: "licencia_funcionamiento",
    name: "Licencia de funcionamiento",
    agency: "Subdirección de Gobernación (Municipio)",
    level: "Municipal",
    what: "La autorización para operar tu negocio en ese establecimiento.",
    details: "Solicitud en ventanilla o en línea; Gobernación tiene 15 días hábiles para resolver fuera del SARE.",
    url: "https://www.municipiochihuahua.gob.mx/Transparenciaarchivos/SHA/Gobernacion/Hojas%20informativas%20tramites/Requisitos%20Licencia%20de%20funcionamiento.pdf",
    source: "https://www.municipiochihuahua.gob.mx/Transparenciaarchivos/SHA/Gobernacion/Hojas%20informativas%20tramites/Requisitos%20Licencia%20de%20funcionamiento.pdf",
  },
  coespris: {
    id: "coespris",
    name: "Aviso de funcionamiento sanitario",
    agency: "COESPRIS (Comisión Estatal para la Protección contra Riesgos Sanitarios)",
    level: "Estatal",
    what: "Registro sanitario del establecimiento; en alimentos te verifican con la NOM-251-SSA1-2009 (prácticas de higiene).",
    details:
      "Se presenta al menos 30 días antes de iniciar operaciones. Algunos giros requieren licencia sanitaria en lugar de aviso: confírmalo con COESPRIS.",
    url: "https://chihuahua.gob.mx/info/aviso-de-funcionamiento",
    source: "https://tramites.chihuahua.gob.mx/tramite.aspx?identificador=467&tramite=Aviso+de+apertura&dependencia=Comisi%C3%B3n+Estatal+para+la+Protecci%C3%B3n+Contra+Riesgos+Sanitarios",
  },
  alcoholes: {
    id: "alcoholes",
    name: "Licencia de bebidas alcohólicas",
    agency: "Secretaría General de Gobierno – Gobernación estatal",
    level: "Estatal",
    what: "Obligatoria para vender cerveza, vinos o licores (Ley de Alcoholes del Estado).",
    details:
      "Se tramita en la Unidad Administrativa José María Morelos y Pavón («Pueblito Mexicano»), L–V 9:00–15:00. El Estado ha asignado permisos por licitación pública: verifica si hay licencias disponibles antes de invertir. Vender sin permiso: multas de hasta 62 mil pesos.",
    url: "https://tramites.chihuahua.gob.mx/tramite.aspx?identificador=310&tramite=Expedici%C3%B3n+de+licencias&dependencia=Secretar%C3%ADa+General+de+Gobierno",
    source: "https://chihuahua.gob.mx/contenidos/exhorta-gobernacion-tramitar-permisos-para-venta-de-bebidas-alcoholicas",
  },
  cedula: {
    id: "cedula",
    name: "Cédula profesional del responsable",
    agency: "SEP (Dirección General de Profesiones)",
    level: "Federal",
    what: "Los consultorios deben estar a cargo de un profesional con cédula; el SARE pide copia para estos giros.",
    url: "https://www.gob.mx/cedulaprofesional",
    source: "https://www.municipiochihuahua.gob.mx/Descargas/Adicional%20Gacetas/Manual%20de%20Procedimientos%20para%20la%20operaci%C3%B3n%20del%20SARE.pdf",
  },
  guarderia: {
    id: "guarderia",
    name: "Licencia de funcionamiento para Centro de Atención Infantil",
    agency: "Secretaría de Desarrollo Social del Estado / Instituto Chihuahuense de Desarrollo Integral Infantil",
    level: "Estatal",
    what: "Licencia específica para guarderías y estancias infantiles.",
    details:
      "Pide, entre otros: programa interno de Protección Civil, uso de suelo, dictamen estructural, aviso de COESPRIS, póliza de responsabilidad civil y certificaciones de competencia EC0435 y EC0886.",
    url: "https://tramites.chihuahua.gob.mx/tramite.aspx?identificador=1656&tramite=Licencia+para+guarder%C3%ADas&dependencia=Secretar%C3%ADa+de+Desarrollo+Social",
    source: "https://oem.com.mx/elheraldodechihuahua/local/sabes-cual-es-proceso-para-abrir-una-estancia-infantil-en-chihuahua-los-tramites-son-gratuitos-13038831",
  },
  ambiental: {
    id: "ambiental",
    name: "Consulta ambiental (residuos e impacto ambiental)",
    agency: "Dirección de Desarrollo Urbano y Ecología (Municipio)",
    level: "Municipal",
    what: "Talleres, llanteras y autolavados generan residuos (aceites, llantas, lodos) regulados por el Reglamento de Protección al Medio Ambiente.",
    details: "Confirma si tu giro requiere resolución de impacto ambiental y registro como generador de residuos.",
    url: "https://www.municipiochihuahua.gob.mx/CCS/Prensa/Conoce_los_tr%C3%A1mites_m%C3%A1s_solicitados_en_la_Direcci%C3%B3n_de_Desarrollo_Urbano_y_Ecolog%C3%ADa",
    source: "https://www.municipiochihuahua.gob.mx/transparenciaarchivos/4to%20Trimestre%202016/Art%2077%20Fracc.%20I/Reglamento%20de%20Protecci%C3%B3n%20al%20Medio%20Ambiente%20del%20Municipio%20de%20Chihuahua.pdf",
  },
  jmas: {
    id: "jmas",
    name: "Contrato de agua comercial (y factibilidad si consumes mucho)",
    agency: "JMAS Chihuahua",
    level: "Municipal",
    what: "Tu giro usa mucha agua: necesitas contrato comercial y, según el volumen, un certificado de factibilidad.",
    details: "Los contratos se tramitan en cualquier sucursal de JMAS. Ciudad en sequía: pregunta por disponibilidad antes de rentar.",
    url: "https://tramites.chihuahua.gob.mx/tramite.aspx?identificador=1959&tramite=Contrato+de+adhesi%C3%B3n+&dependencia=Junta+Municipal+de+Agua+y+Saneamiento+de+Chihuahua",
    source: "https://www.chihuahua.gob.mx/prensa/recuerda-jmas-chihuahua-que-se-pueden-tramitar-contratos-en-las-distintas-sucursales",
  },
  imss: {
    id: "imss",
    name: "Registro patronal en el IMSS (si contratas personal)",
    agency: "IMSS",
    level: "Federal",
    what: "Obligatorio para dar de alta a tus empleados en el Seguro Social.",
    url: "https://www.imss.gob.mx/patrones",
    source: "https://www.imss.gob.mx/patrones",
  },
};

const PROGRAMS: Program[] = [
  {
    id: "estacion_emprende",
    name: "Estación Emprende",
    agency: "Municipio – Dirección de Desarrollo Económico",
    what: "Centro de negocios con asesoría para emprendedores, dentro del SARE (Av. Independencia y Victoria, 8:30–16:00).",
    fit: "Primer paso recomendado: revisar tu plan y tus trámites.",
    source: "https://www.municipiochihuahua.gob.mx/CCS/Prensa/Inicia_tu_negocio_con_apoyos_de_la_Estaci%C3%B3n_Emprende",
  },
  {
    id: "fomech",
    name: "FOMECH – Fondo Municipal para Emprendedores",
    agency: "Municipio de Chihuahua",
    what: "Créditos de 15 mil a 500 mil pesos para capital de trabajo o activos fijos (más de 38 millones entregados en el 1er semestre de 2026). Tel. 614-200-4800 ext. 2957.",
    fit: "Financiamiento principal para arrancar.",
    source: "https://www.municipiochihuahua.gob.mx/CCS/Prensa/Impulsa_Municipio_emprendimientos:_se_han_entregado_m%C3%A1s_de_38_millones_de_pesos_en_primer_semestre_del_a%C3%B1o_con_FOMECH",
  },
  {
    id: "vende_tu_proyecto",
    name: "Vende tu Proyecto",
    agency: "Municipio – Dirección de Desarrollo Económico y Competitividad",
    what: "Apoyos de 10, 20 o 30 mil pesos solo para maquinaria, equipo y herramienta. La convocatoria 2026 cerró el 31 de marzo.",
    fit: "Atento a la próxima convocatoria para equipar tu negocio.",
    source: "https://www.municipiochihuahua.gob.mx/CCS/Prensa/Abre_Municipio_convocatoria_a_emprendedores_para_participar_en_%E2%80%9CVende_tu_Proyecto_2026%E2%80%9D",
  },
  {
    id: "impulso_chihuahua",
    name: "Impulso Chihuahua 2026",
    agency: "Gobierno del Estado / Fideapech con bancos participantes",
    what: "Créditos de hasta 5 millones, tasa fija máxima de 14.75% anual, hasta 60 meses. Requiere al menos 2 años de operación.",
    fit: "No aplica para abrir; úsalo para crecer cuando tengas 2 años operando.",
    source: "https://www.chihuahua.gob.mx/prensa/ofrece-estado-financiamiento-preferencial-mipymes-mediante-esquema-impulso-chihuahua-2026",
  },
];

const SARE_CODES = new Set<string>(sare.codes);

// Categories whose activity needs extra permits beyond the base path.
const FOOD = new Set(["taqueria", "antojitos", "comida_corrida", "cafeteria", "pizza_hamburguesas", "mariscos",
  "comida_para_llevar", "panaderia", "tortilleria", "carniceria", "paleteria", "purificadora"]);
const ALCOHOL = new Set(["deposito", "vinos_licores", "bar"]);
const HEALTH = new Set(["medico_general", "dentista", "laboratorio", "psicologia", "nutriologo", "fisioterapia"]);
const WASTE = new Set(["taller_mecanico", "llantera", "autolavado"]);
const WATER = new Set(["lavanderia", "autolavado", "purificadora"]);

export type LaunchPlan = { lowRisk: boolean; steps: Step[]; programs: Program[]; documents: string[] };

// Municipal information sheet for the operating license (SRIA00048, costs 2024) and the SARE
// Formato Único de Apertura (FUA 2022).
const DOC_SOURCE =
  "https://www.municipiochihuahua.gob.mx/Transparenciaarchivos/SHA/Gobernacion/Hojas%20informativas%20tramites/Requisitos%20Licencia%20de%20funcionamiento.pdf";
export const DOCUMENTS_SOURCE = DOC_SOURCE;

function requiredDocuments(categoryId: string, lowRisk: boolean): string[] {
  const docs = [
    "Identificación oficial vigente con fotografía (INE o pasaporte).",
    "Contrato de arrendamiento o escritura del local (legal disposición del inmueble).",
    "Plano catastral de no más de 2 años, hecho por un perito catastral (R.P.C.) vigente.",
    "Fotografías del interior y exterior del local.",
    "Comprobante de pago del predial al corriente.",
    "Constancia del RFC (inscripción ante el SAT).",
    lowRisk
      ? "Formato Único de Apertura (FUA) del SARE, llenado y firmado."
      : "Escrito de solicitud de licencia de funcionamiento (nombre, giro, ubicación, capital a invertir y nacionalidad).",
    lowRisk
      ? "Programa Interno de Protección Civil para bajo riesgo, según la guía técnica del SARE (incluye croquis a color y fotos del equipo)."
      : "Programa Interno de Protección Civil autorizado.",
  ];
  if (lowRisk) {
    docs.push(
      "Equipo de seguridad: extintor de polvo químico seco de mínimo 4.5 kg por cada 80 m² (a 1.50 m del piso), lámpara de emergencia, botiquín, señalización de salida y punto de reunión.",
    );
  }
  if (HEALTH.has(categoryId)) docs.push("Cédula profesional del responsable.");
  if (FOOD.has(categoryId)) docs.push("Constancia de manejo de alimentos.");
  if (WASTE.has(categoryId)) docs.push("Autorización en materia ecológica de la autoridad competente.");
  if (ALCOHOL.has(categoryId)) docs.push("Licencia de bebidas alcohólicas del Gobierno del Estado.");
  docs.push("Si es empresa (persona moral): acta constitutiva y poder del representante legal.");
  return docs;
}

export function launchPlan(category: Category): LaunchPlan {
  const lowRisk = category.scian.some((c) => SARE_CODES.has(c));
  const ids = ["rfc"];
  if (lowRisk) ids.push("sare");
  else ids.push("uso_suelo", "proteccion_civil", "licencia_funcionamiento");
  if (HEALTH.has(category.id)) ids.push("cedula", "coespris");
  if (FOOD.has(category.id) || category.id === "farmacia") ids.push("coespris");
  if (ALCOHOL.has(category.id)) ids.push("alcoholes");
  if (category.id === "guarderia") ids.push("guarderia");
  if (WASTE.has(category.id)) ids.push("ambiental");
  if (WATER.has(category.id)) ids.push("jmas");
  ids.push("imss");
  return {
    lowRisk,
    steps: [...new Set(ids)].map((id) => STEPS[id]),
    programs: PROGRAMS,
    documents: requiredDocuments(category.id, lowRisk),
  };
}
