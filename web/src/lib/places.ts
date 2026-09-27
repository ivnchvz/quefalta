import "server-only";
// Live Google Maps check for one business type around a point (Places API (New), Text Search).
// Used by /api/places (web panel) and the plan PDF. Results are fetched live on every call; nothing is
// stored or merged into our INEGI data.

import { haversine } from "./engine";

export { googleMapsSearchUrl, googleVerdict } from "./placesShared";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELDS = [
  "places.id", "places.displayName", "places.location", "places.rating", "places.userRatingCount",
  "places.businessStatus", "places.regularOpeningHours", "places.currentOpeningHours.openNow", "places.googleMapsUri",
  "places.types",
].join(",");
const MAX_PAGES = 3; // 20 results per page
const LATE_HOUR = 21; // "open late" = closes at or after 9 pm (or past midnight)

type Period = { open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } };
type GooglePlace = {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  regularOpeningHours?: { periods?: Period[]; weekdayDescriptions?: string[] };
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  types?: string[];
};

export type PlaceResult = {
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

export type GoogleCheck = {
  places: PlaceResult[];
  summary: {
    operating: number;
    closedPermanently: number;
    avgRating: number | null;
    opensLate: number;
    truncated: boolean; // more results existed beyond MAX_PAGES
    typeFiltered: boolean;
    excluded: number; // keyword matches Google doesn't classify as this business
  };
};

export type GoogleCheckParams = { lat: number; lon: number; radiusM: number; query: string; types?: string[] };

export class PlacesError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function opensLate(periods: Period[] | undefined): boolean {
  if (!periods?.length) return false;
  return periods.some((p) => !p.close || p.close.day !== p.open.day || p.close.hour >= LATE_HOUR);
}

// Google's weekdayDescriptions start on Monday; Chihuahua city is UTC-6 all year.
function todayIndex(): number {
  const day = new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chihuahua" });
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(day);
}

export async function googleCheck({ lat, lon, radiusM, query, types }: GoogleCheckParams): Promise<GoogleCheck> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesError("Falta configurar GOOGLE_PLACES_API_KEY.", 503);

  // Text Search restricts to a rectangle; use the circle's bounding box, then filter by distance.
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const body = {
    textQuery: query,
    languageCode: "es",
    regionCode: "MX",
    pageSize: 20,
    locationRestriction: {
      rectangle: { low: { latitude: lat - dLat, longitude: lon - dLon }, high: { latitude: lat + dLat, longitude: lon + dLon } },
    },
  };

  const found: GooglePlace[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": `${FIELDS},nextPageToken` },
      body: JSON.stringify(pageToken ? { ...body, pageToken } : body),
    });
    if (!res.ok) {
      console.error("Places API error", res.status, await res.text());
      throw new PlacesError(`Google Maps respondió con error ${res.status}.`, 502);
    }
    const data = (await res.json()) as { places?: GooglePlace[]; nextPageToken?: string };
    found.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  // Keyword search also returns unrelated places (an ironing service for "lavandería");
  // when the business has Google place types, keep only places tagged with one of them.
  const inRadius = found.filter((p) => p.location && haversine(lat, lon, p.location.latitude, p.location.longitude) <= radiusM);
  const allowed = types?.length ? new Set(types) : null;
  const matching = allowed ? inRadius.filter((p) => p.types?.some((t) => allowed.has(t))) : inRadius;

  const today = todayIndex();
  const places: PlaceResult[] = matching
    .map((p) => ({
      name: p.displayName?.text ?? "Sin nombre",
      distanceM: Math.round(haversine(lat, lon, p.location!.latitude, p.location!.longitude)),
      rating: p.rating ?? null,
      reviews: p.userRatingCount ?? 0,
      status: p.businessStatus ?? "OPERATIONAL",
      openNow: p.currentOpeningHours?.openNow ?? null,
      opensLate: opensLate(p.regularOpeningHours?.periods),
      hoursToday: today >= 0 ? (p.regularOpeningHours?.weekdayDescriptions?.[today] ?? null) : null,
      mapsUrl: p.googleMapsUri ?? null,
    }))
    .sort((a, b) => a.distanceM - b.distanceM);

  const operating = places.filter((p) => p.status !== "CLOSED_PERMANENTLY");
  const rated = operating.filter((p) => p.rating !== null);
  return {
    places,
    summary: {
      operating: operating.length,
      closedPermanently: places.length - operating.length,
      avgRating: rated.length ? Math.round((rated.reduce((s, p) => s + p.rating!, 0) / rated.length) * 10) / 10 : null,
      opensLate: operating.filter((p) => p.opensLate).length,
      truncated: Boolean(pageToken),
      typeFiltered: Boolean(allowed),
      excluded: inRadius.length - matching.length,
    },
  };
}
