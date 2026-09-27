// MapLibre loads its web worker from a separate module file that Next.js doesn't bundle.
// Copy it (and the shared chunk it imports) into public/ so MapView can point setWorkerUrl at it.
import { copyFileSync, mkdirSync } from "node:fs";

const src = "node_modules/maplibre-gl/dist";
const dest = "public/maplibre";
mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(`${src}/${file}`, `${dest}/${file}`);
}
