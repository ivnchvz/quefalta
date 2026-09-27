// Google-check helpers without secrets, shared by the web panel and the server (PDF).

/** Link that opens Google Maps searching for the business type around the point (no API involved). */
export const googleMapsSearchUrl = (query: string, lat: number, lon: number) =>
  `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat.toFixed(5)},${lon.toFixed(5)},15z`;

/** The model's "expected" is in INEGI counts; Google usually lists more, so this is a warning, not a correction. */
export function googleVerdict(google: number, inegi: number, expected: number): { level: "holds" | "smaller" | "covered"; text: string } {
  const exp = Math.round(expected);
  if (google <= inegi) return { level: "holds", text: "Google no encuentra más negocios que INEGI: el hueco se mantiene." };
  if (google >= exp) {
    return {
      level: "covered",
      text: `Google encuentra ${google}, igual o más que los ~${exp} esperados: el hueco podría ya estar cubierto. Valida en campo antes de invertir.`,
    };
  }
  return {
    level: "smaller",
    text: `Google encuentra ${google} (INEGI ${inegi}): el hueco real puede ser menor, de ~${exp - google} en vez de ~${Math.max(exp - inegi, 0)}.`,
  };
}
