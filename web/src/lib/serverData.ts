import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_FILES, datasetFrom, type Dataset } from "./engine";

let cached: Promise<Dataset> | null = null;

/** Same datasets the browser loads, read from public/data once per server process. */
export function loadDatasetFromDisk(): Promise<Dataset> {
  cached ??= Promise.all(
    DATA_FILES.map(async (name) => JSON.parse(await readFile(path.join(process.cwd(), "public", "data", name), "utf-8"))),
  ).then(datasetFrom);
  return cached;
}
