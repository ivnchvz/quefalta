"""Build the compact JSON datasets the web app loads.

Inputs (data-prep/raw/):
  denue/denue_inegi_08_.csv                        INEGI DENUE, businesses in Chihuahua state
  censo/conjunto_de_datos_ageb_urbana_08_cpv2020.csv  INEGI Census 2020, per block (manzana)
  marco/08m.*                                      INEGI Marco Geoestadístico 2020, block polygons

Outputs (web/public/data/):
  blocks.json      one row per populated block: centroid + demographics
  businesses.json  every business in the municipality: position, category, size, name
  reference.json   "twin" reference areas (one per urban AGEB): features + category counts
  categories.json  the curated business-idea list
"""

import csv
import json
import math
import os
from collections import defaultdict

import shapefile
from pyproj import CRS, Transformer

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "..", "web", "public", "data")
MUN, LOC = "019", "0001"  # Municipio de Chihuahua, city of Chihuahua
RADIUS_M = 1000  # ~12-15 minute walk

CENSUS_COLS = ["POBTOT", "POB0_14", "POB65_MAS", "GRAPROES", "TVIVHAB", "VPH_AUTOM"]

SIZE_CODES = {  # DENUE per_ocu -> 0..6
    "0 a 5 personas": 0, "6 a 10 personas": 1, "11 a 30 personas": 2, "31 a 50 personas": 3,
    "51 a 100 personas": 4, "101 a 250 personas": 5, "251 y más personas": 6,
}


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0  # "*" (confidential) or "N/D"


def ring_centroid(points):
    area = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]):
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(area) < 1e-9:
        xs, ys = zip(*points)
        return sum(xs) / len(xs), sum(ys) / len(ys)
    return cx / (3 * area), cy / (3 * area)


def is_hidden(v):
    return v in ("*", "N/D", "")


def load_census():
    """Block-level census values, filling INEGI's privacy-suppressed cells ("*").

    Small counts are hidden at block level but AGEB totals are complete, so each AGEB's
    remainder (total minus visible blocks) is spread over its hidden blocks in proportion
    to their population (households for household variables). Average schooling isn't a
    count, so hidden blocks take the AGEB average instead.
    """
    blocks, agebs = {}, {}
    with open(os.path.join(RAW, "censo", "conjunto_de_datos_ageb_urbana_08_cpv2020.csv"), encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r["MUN"] != MUN or r["LOC"] != LOC or r["AGEB"] == "0000":
                continue
            if r["MZA"] == "000":
                agebs[r["AGEB"]] = r
            else:
                blocks[(r["AGEB"], r["MZA"])] = r

    weight_col = {"VPH_AUTOM": "TVIVHAB"}
    filled = {key: [num(r[c]) for c in CENSUS_COLS] for key, r in blocks.items()}
    by_ageb = defaultdict(list)
    for key in blocks:
        by_ageb[key[0]].append(key)
    for i, col in enumerate(CENSUS_COLS):
        for ageb, keys in by_ageb.items():
            hidden = [k for k in keys if is_hidden(blocks[k][col])]
            if not hidden or ageb not in agebs:
                continue
            total = num(agebs[ageb][col])
            if col == "GRAPROES":
                for k in hidden:
                    filled[k][i] = total
                continue
            remainder = max(0.0, total - sum(num(blocks[k][col]) for k in keys if k not in hidden))
            w = [num(blocks[k][weight_col.get(col, "POBTOT")]) for k in hidden]
            wsum = sum(w) or len(hidden)
            for k, wk in zip(hidden, w):
                filled[k][i] = remainder * ((wk or (0 if sum(w) else 1)) / wsum)
    return filled


def load_blocks():
    census = load_census()

    prj = open(os.path.join(RAW, "marco", "08m.prj")).read()
    to_wgs = Transformer.from_crs(CRS.from_wkt(prj), "EPSG:4326", always_xy=True)
    reader = shapefile.Reader(os.path.join(RAW, "marco", "08m"), encoding="latin1")
    blocks = []
    for shape_rec in reader.iterShapeRecords():
        rec = shape_rec.record.as_dict()
        if rec["CVE_MUN"] != MUN or rec["CVE_LOC"] != LOC:
            continue
        stats = census.get((rec["CVE_AGEB"], rec["CVE_MZA"]))
        if not stats or stats[0] <= 0:
            continue
        pts = shape_rec.shape.points
        end = shape_rec.shape.parts[1] if len(shape_rec.shape.parts) > 1 else len(pts)
        x, y = ring_centroid(pts[:end])
        lon, lat = to_wgs.transform(x, y)
        blocks.append({"ageb": rec["CVE_AGEB"], "lat": lat, "lon": lon, "s": stats})
    return blocks


def load_businesses(categories):
    by_code = {code: c["id"] for c in categories for code in c["scian"]}
    out = []
    with open(os.path.join(RAW, "denue", "denue_inegi_08_.csv"), encoding="latin1") as f:
        for r in csv.DictReader(f):
            if r["cve_mun"] != MUN or not r["latitud"]:
                continue
            cat = by_code.get(r["codigo_act"])
            out.append({
                "lat": float(r["latitud"]), "lon": float(r["longitud"]),
                "cat": cat, "size": SIZE_CODES.get(r["per_ocu"], 0),
                "name": r["nom_estab"].strip().title() if cat else None,
                "id": r["id"],
            })
    return out


class Grid:
    """Tiny spatial index so radius queries don't scan everything."""

    def __init__(self, items, cell=0.01):
        self.cell = cell
        self.cells = defaultdict(list)
        for it in items:
            self.cells[(int(it["lat"] / cell), int(it["lon"] / cell))].append(it)

    def near(self, lat, lon, radius_m):
        span = int(radius_m / 111_000 / self.cell) + 1
        ci, cj = int(lat / self.cell), int(lon / self.cell)
        for i in range(ci - span, ci + span + 1):
            for j in range(cj - span, cj + span + 1):
                for it in self.cells.get((i, j), ()):
                    if haversine(lat, lon, it["lat"], it["lon"]) <= radius_m:
                        yield it


def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 12_742_000 * math.asin(math.sqrt(a))


# Midpoint of each DENUE employee range; approximates people working in an area.
SIZE_MIDPOINTS = [3, 8, 20, 40, 75, 175, 400]


def area_features(blocks_near, businesses_near):
    pop = p014 = p65 = hh = cars = school_w = 0.0
    for b in blocks_near:
        s = b["s"]
        pop += s[0]; p014 += s[1]; p65 += s[2]; hh += s[4]; cars += s[5]
        school_w += s[3] * s[0]
    return {
        "pop": round(pop),
        "kids": round(p014 / pop, 3) if pop else 0,
        "seniors": round(p65 / pop, 3) if pop else 0,
        "schooling": round(school_w / pop, 2) if pop else 0,
        "cars": round(cars / hh, 3) if hh else 0,
        "biz": len(businesses_near),
        "workers": sum(SIZE_MIDPOINTS[b["size"]] for b in businesses_near),
    }


def model_inputs(f):
    """Demand drivers, in thousands of people. Must match modelInputs() in web/src/lib/engine.ts."""
    k = f["pop"] / 1000
    return [1.0, k, f["workers"] / 1000, k * f["kids"], k * f["seniors"], k * f["cars"], k * f["schooling"] / 10]


def fit_models(reference, categories, folds=5):
    """Per category, learn how many businesses an area usually has given its demand drivers.

    Ordinary least squares over the reference areas; the cross-validated R² tells us how much
    of the variation between areas the model actually explains (shown to users as confidence).
    """
    import numpy as np

    X = np.array([model_inputs(a["f"]) for a in reference])
    fold_of = np.arange(len(reference)) % folds
    models = {}
    for c in categories:
        y = np.array([a["c"].get(c["id"], 0) for a in reference], dtype=float)
        coef, *_ = np.linalg.lstsq(X, y, rcond=None)
        pred_cv = np.zeros_like(y)
        for k in range(folds):
            train, test = fold_of != k, fold_of == k
            ck, *_ = np.linalg.lstsq(X[train], y[train], rcond=None)
            pred_cv[test] = np.clip(X[test] @ ck, 0, None)
        ss_res = float(((y - pred_cv) ** 2).sum())
        ss_tot = float(((y - y.mean()) ** 2).sum()) or 1.0
        # Errors grow with the expected count, so express them relative to sqrt(prediction)
        # (quasi-Poisson dispersion); the app turns a gap into "how unusual is this" with it.
        disp = float(np.sqrt((((y - pred_cv) ** 2) / np.maximum(pred_cv, 1)).mean()))
        models[c["id"]] = {
            "coef": [round(float(v), 5) for v in coef],
            "r2": round(max(0.0, 1 - ss_res / ss_tot), 3),
            "mae": round(float(np.abs(y - pred_cv).mean()), 2),
            "disp": round(disp, 3),
        }
    return models


def main():
    categories = json.load(open(os.path.join(HERE, "categories.json"), encoding="utf-8"))
    blocks = load_blocks()
    businesses = load_businesses(categories)
    print(f"blocks with population: {len(blocks)}, businesses: {len(businesses)}")

    known = {code for c in categories for code in c["scian"]}
    present = defaultdict(int)
    for b in businesses:
        if b["cat"]:
            present[b["cat"]] += 1
    for c in categories:
        if not present[c["id"]]:
            print(f"  warning: no businesses found for {c['id']} ({c['scian']})")

    block_grid, biz_grid = Grid(blocks), Grid(businesses)

    # Reference areas: one per urban AGEB, centered on its population-weighted centroid.
    agebs = defaultdict(lambda: [0.0, 0.0, 0.0])
    for b in blocks:
        w = b["s"][0]
        agebs[b["ageb"]][0] += b["lat"] * w
        agebs[b["ageb"]][1] += b["lon"] * w
        agebs[b["ageb"]][2] += w
    reference = []
    for ageb, (slat, slon, w) in agebs.items():
        lat, lon = slat / w, slon / w
        near_blocks = list(block_grid.near(lat, lon, RADIUS_M))
        near_biz = list(biz_grid.near(lat, lon, RADIUS_M))
        counts = defaultdict(int)
        for b in near_biz:
            if b["cat"]:
                counts[b["cat"]] += 1
        reference.append({
            "ageb": ageb, "lat": round(lat, 5), "lon": round(lon, 5),
            "f": area_features(near_blocks, near_biz),
            "c": dict(counts),
        })
    print(f"reference areas: {len(reference)}")
    models = fit_models(reference, categories)
    for cid, m in sorted(models.items(), key=lambda kv: -kv[1]["r2"]):
        print(f"  model {cid:24s} R²={m['r2']:.2f}  MAE={m['mae']}")

    os.makedirs(OUT, exist_ok=True)
    dump = lambda name, data: json.dump(data, open(os.path.join(OUT, name), "w", encoding="utf-8"),
                                        ensure_ascii=False, separators=(",", ":"))
    # Compact row formats keep the files small enough to load in the browser.
    dump("blocks.json", {"cols": ["lat", "lon"] + CENSUS_COLS,
                         "rows": [[round(b["lat"], 5), round(b["lon"], 5)] + [round(v, 2) for v in b["s"]] for b in blocks]})
    dump("businesses.json", {"cols": ["lat", "lon", "cat", "size", "name", "id"],
                             "rows": [[round(b["lat"], 5), round(b["lon"], 5), b["cat"], b["size"], b["name"], b["id"]]
                                      for b in businesses]})
    dump("reference.json", {"radius_m": RADIUS_M, "areas": reference, "models": models})
    dump("categories.json", categories)
    for name in ("blocks.json", "businesses.json", "reference.json"):
        print(f"  {name}: {os.path.getsize(os.path.join(OUT, name)) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
