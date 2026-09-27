// Opportunity engine: runs entirely in the browser on the precomputed datasets
// produced by data-prep/build_data.py.

export type Category = {
  id: string;
  name: string;
  emoji: string;
  scope: "barrio" | "destino"; // everyday neighborhood need vs. people travel for it
  scian: string[];
  q: string; // search term for the Google Maps check
  gtypes?: string[]; // Google place types that count as this business (absent: keyword-only)
};

export type Features = {
  pop: number;
  kids: number; // share of population aged 0-14
  seniors: number; // share aged 65+
  schooling: number; // average years of schooling
  cars: number; // share of households with a car
  biz: number; // total businesses in the radius
  workers: number; // approx. people working in the radius (from business size ranges)
};

type ReferenceArea = { ageb: string; lat: number; lon: number; f: Features; c: Record<string, number> };

// Per-category linear model fitted in data-prep/build_data.py (fit_models).
type CategoryModel = { coef: number[]; r2: number; mae: number; disp: number };

export type Confidence = "alta" | "media" | "baja";

type Business = { lat: number; lon: number; cat: string | null; size: number; name: string | null; id: string };

export type Dataset = {
  radiusM: number;
  categories: Category[];
  blocks: number[][]; // [lat, lon, POBTOT, POB0_14, POB65_MAS, GRAPROES, TVIVHAB, VPH_AUTOM]
  businesses: Business[];
  reference: ReferenceArea[];
  models: Record<string, CategoryModel>;
  blockGrid: Grid<number[]>;
  bizGrid: Grid<Business>;
};

export type Competitor = { name: string; distanceM: number; size: string; lat: number; lon: number };

export type CategoryResult = {
  category: Category;
  actual: number;
  expected: number; // what the city-wide model predicts for an area like this
  twinExpected: number; // median count in the most similar areas
  twinPresence: number; // share of twin areas that have at least one
  score: number; // gap in units of the model's typical error; positive = undersupplied
  status: "opportunity" | "balanced" | "saturated";
  confidence: Confidence;
  modelR2: number;
  modelMae: number;
  residentsPerBusiness: number | null;
  twinResidentsPerBusiness: number | null;
  nearestCompetitorM: number | null;
  competitors: Competitor[];
};

export type Analysis = {
  lat: number;
  lon: number;
  radiusM: number;
  features: Features;
  twins: (ReferenceArea & { distanceKm: number })[];
  results: CategoryResult[];
  lowPopulation: boolean;
};

export const SIZE_LABELS = ["0-5", "6-10", "11-30", "31-50", "51-100", "101-250", "251+"];
const SIZE_MIDPOINTS = [3, 8, 20, 40, 75, 175, 400]; // must match build_data.py

// Must match model_inputs() in data-prep/build_data.py.
const modelInputs = (f: Features) => {
  const k = f.pop / 1000;
  return [1, k, f.workers / 1000, k * f.kids, k * f.seniors, k * f.cars, (k * f.schooling) / 10];
};

const confidenceOf = (r2: number): Confidence => (r2 >= 0.65 ? "alta" : r2 >= 0.45 ? "media" : "baja");

const TWIN_COUNT = 15;
const TWIN_EXCLUSION_M = 2500; // twins must be elsewhere in the city, not overlapping this area
const COMPETITOR_SEARCH_M = 3000;

export class Grid<T> {
  private cells = new Map<string, T[]>();
  constructor(items: T[], private pos: (t: T) => [number, number], private cell = 0.01) {
    for (const it of items) {
      const [lat, lon] = pos(it);
      const key = `${Math.floor(lat / cell)},${Math.floor(lon / cell)}`;
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(it);
      else this.cells.set(key, [it]);
    }
  }
  near(lat: number, lon: number, radiusM: number): { item: T; d: number }[] {
    const span = Math.ceil(radiusM / 111_000 / this.cell) + 1;
    const ci = Math.floor(lat / this.cell);
    const cj = Math.floor(lon / this.cell);
    const out: { item: T; d: number }[] = [];
    for (let i = ci - span; i <= ci + span; i++) {
      for (let j = cj - span; j <= cj + span; j++) {
        for (const it of this.cells.get(`${i},${j}`) ?? []) {
          const [la, lo] = this.pos(it);
          const d = haversine(lat, lon, la, lo);
          if (d <= radiusM) out.push({ item: it, d });
        }
      }
    }
    return out;
  }
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * toRad) / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(((lon2 - lon1) * toRad) / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(a));
}

export const DATA_FILES = ["categories.json", "blocks.json", "businesses.json", "reference.json"] as const;

/** Loads the datasets in the browser. The server uses loadDatasetFromDisk (lib/serverData.ts). */
export async function loadDataset(): Promise<Dataset> {
  const raw = await Promise.all(DATA_FILES.map((name) => fetch(`/data/${name}`).then((r) => r.json())));
  return datasetFrom(raw);
}

/** Builds the in-memory dataset (with spatial indexes) from the parsed DATA_FILES, in that order. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function datasetFrom([categories, blocks, businesses, reference]: any[]): Dataset {
  const biz: Business[] = businesses.rows.map((r: [number, number, string | null, number, string | null, string]) => ({
    lat: r[0], lon: r[1], cat: r[2], size: r[3], name: r[4], id: r[5],
  }));
  return {
    radiusM: reference.radius_m,
    categories,
    blocks: blocks.rows,
    businesses: biz,
    reference: reference.areas,
    models: reference.models,
    blockGrid: new Grid<number[]>(blocks.rows, (b) => [b[0], b[1]]),
    bizGrid: new Grid<Business>(biz, (b) => [b.lat, b.lon]),
  };
}

function areaFeatures(ds: Dataset, lat: number, lon: number): Features {
  let pop = 0, kids = 0, seniors = 0, households = 0, cars = 0, schoolingWeighted = 0;
  for (const { item: b } of ds.blockGrid.near(lat, lon, ds.radiusM)) {
    pop += b[2]; kids += b[3]; seniors += b[4]; households += b[6]; cars += b[7];
    schoolingWeighted += b[5] * b[2];
  }
  const biz = ds.bizGrid.near(lat, lon, ds.radiusM);
  return {
    pop: Math.round(pop),
    kids: pop ? kids / pop : 0,
    seniors: pop ? seniors / pop : 0,
    schooling: pop ? schoolingWeighted / pop : 0,
    cars: households ? cars / households : 0,
    biz: biz.length,
    workers: biz.reduce((s, x) => s + SIZE_MIDPOINTS[x.item.size], 0),
  };
}

const featureVector = (f: Features) => [
  Math.log1p(f.pop), f.kids, f.seniors, f.schooling, f.cars, Math.log1p(f.workers),
];

function findTwins(ds: Dataset, lat: number, lon: number, f: Features) {
  const vectors = ds.reference.map((a) => featureVector(a.f));
  const dims = vectors[0].length;
  const mean = Array.from({ length: dims }, (_, k) => vectors.reduce((s, v) => s + v[k], 0) / vectors.length);
  const std = Array.from({ length: dims }, (_, k) =>
    Math.sqrt(vectors.reduce((s, v) => s + (v[k] - mean[k]) ** 2, 0) / vectors.length) || 1,
  );
  const target = featureVector(f);
  return ds.reference
    .map((a, i) => ({
      ...a,
      distanceKm: haversine(lat, lon, a.lat, a.lon) / 1000,
      similarity: Math.sqrt(vectors[i].reduce((s, v, k) => s + ((v - target[k]) / std[k]) ** 2, 0)),
    }))
    .filter((a) => a.distanceKm * 1000 > TWIN_EXCLUSION_M)
    .sort((a, b) => a.similarity - b.similarity)
    .slice(0, TWIN_COUNT);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function analyzePoint(ds: Dataset, lat: number, lon: number): Analysis {
  const features = areaFeatures(ds, lat, lon);
  const twins = findTwins(ds, lat, lon, features);

  const nearby = ds.bizGrid.near(lat, lon, COMPETITOR_SEARCH_M).filter((x) => x.item.cat);
  const byCat = new Map<string, { item: Business; d: number }[]>();
  for (const x of nearby) {
    const list = byCat.get(x.item.cat!);
    if (list) list.push(x);
    else byCat.set(x.item.cat!, [x]);
  }

  const results: CategoryResult[] = ds.categories.map((category) => {
    const all = (byCat.get(category.id) ?? []).sort((a, b) => a.d - b.d);
    const inside = all.filter((x) => x.d <= ds.radiusM);
    const actual = inside.length;
    const twinCounts = twins.map((t) => t.c[category.id] ?? 0);
    const model = ds.models[category.id];
    const expected = Math.max(0, modelInputs(features).reduce((s, x, i) => s + x * model.coef[i], 0));
    const confidence = confidenceOf(model.r2);

    const twinPresence = twinCounts.filter((c) => c > 0).length / twins.length;
    // Gap measured in the model's own error units (quasi-Poisson: error grows with sqrt(expected)).
    const score = (expected - actual) / (model.disp * Math.sqrt(Math.max(expected, 1)));
    // Destination businesses (clothing, shoes...) cluster in commercial corridors rather than
    // following local demand, so gaps and surpluses aren't meaningful for them.
    let status: CategoryResult["status"] = "balanced";
    if (category.scope === "barrio") {
      if (confidence !== "baja" && score >= 1.5 && expected - actual >= 1) status = "opportunity";
      else if (score <= -2 && actual >= 3) status = "saturated";
    }

    const twinRpb = twins
      .filter((t) => (t.c[category.id] ?? 0) > 0)
      .map((t) => t.f.pop / (t.c[category.id] ?? 1));

    return {
      category,
      actual,
      expected: Math.round(expected * 10) / 10,
      twinExpected: median(twinCounts),
      twinPresence,
      score,
      status,
      confidence,
      modelR2: model.r2,
      modelMae: model.mae,
      residentsPerBusiness: actual ? Math.round(features.pop / actual) : null,
      twinResidentsPerBusiness: twinRpb.length ? Math.round(median(twinRpb)) : null,
      nearestCompetitorM: all.length ? Math.round(all[0].d) : null,
      competitors: all.slice(0, 12).map((x) => ({
        name: x.item.name ?? "Sin nombre",
        distanceM: Math.round(x.d),
        size: SIZE_LABELS[x.item.size] ?? "?",
        lat: x.item.lat,
        lon: x.item.lon,
      })),
    };
  });

  results.sort((a, b) => b.score - a.score);
  return { lat, lon, radiusM: ds.radiusM, features, twins, results, lowPopulation: features.pop < 1500 };
}
