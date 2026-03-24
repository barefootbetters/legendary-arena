/**
 * impl/localRegistry.ts
 * Loads set data from the local filesystem (for CI validation).
 * Node.js only.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { SetIndexEntrySchema, SetDataSchema } from "../schema.js";
import { flattenSet, applyQuery, buildHealthReport } from "../shared.js";
import type {
  CardRegistry,
  SetIndexEntry,
  SetData,
  Hero,
  FlatCard,
  CardQuery,
  RegistryInfo,
  HealthReport,
} from "../types/index.js";

export interface LocalRegistryOptions {
  /** Path to folder containing card-types.json + {abbr}.json files */
  metadataDir: string;
}

export async function createRegistryFromLocalFiles(
  options: LocalRegistryOptions
): Promise<CardRegistry> {
  const dir = resolve(options.metadataDir);
  const errors: Array<{ setAbbr?: string; code: string; message: string }> = [];

  // ── Load card-types.json ───────────────────────────────────────────────────
  let setIndex: SetIndexEntry[] = [];
  try {
    const raw: unknown = JSON.parse(
      await readFile(join(dir, "card-types.json"), "utf8")
    );
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const r = SetIndexEntrySchema.safeParse(item);
        if (r.success) {
          setIndex.push(r.data);
        } else {
          errors.push({
            code: "SET_INDEX_INVALID",
            message: r.error.issues.map((i) => i.message).join("; "),
          });
        }
      }
    }
  } catch (err) {
    errors.push({
      code:    "INDEX_FILE_ERROR",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Load all {abbr}.json files ─────────────────────────────────────────────
  const loadedSets = new Map<string, SetData>();
  const setIndexMap = new Map(setIndex.map((s) => [s.abbr, s]));

  const files = (await readdir(dir)).filter(
    (f) => extname(f) === ".json" && f !== "card-types.json"
  );

  for (const file of files) {
    const abbr = file.replace(".json", "");
    try {
      const raw: unknown = JSON.parse(
        await readFile(join(dir, file), "utf8")
      );
      const result = SetDataSchema.safeParse(raw);
      if (result.success) {
        loadedSets.set(abbr, result.data);
      } else {
        errors.push({
          setAbbr: abbr,
          code:    "SET_SCHEMA_INVALID",
          message: result.error.issues
            .map((i) => `[${i.path.join(".")}] ${i.message}`)
            .join("; "),
        });
      }
    } catch (err) {
      errors.push({
        setAbbr: abbr,
        code:    "SET_FILE_ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function rebuildFlatCards(): FlatCard[] {
    const all: FlatCard[] = [];
    for (const [abbr, set] of loadedSets) {
      const meta = setIndexMap.get(abbr);
      all.push(...flattenSet(set, meta?.name ?? abbr));
    }
    return all;
  }

  return {
    info(): RegistryInfo {
      return {
        totalSets:       setIndex.length,
        totalHeroes:     [...loadedSets.values()].reduce((n, s) => n + s.heroes.length, 0),
        totalCards:      rebuildFlatCards().length,
        loadedSetAbbrs:  [...loadedSets.keys()],
        metadataBaseUrl: dir,
      };
    },

    listSets():             SetIndexEntry[]  { return setIndex; },
    getSet(abbr: string):   SetData | undefined { return loadedSets.get(abbr); },
    listHeroes():           Hero[]  { return [...loadedSets.values()].flatMap((s) => s.heroes); },
    listCards():            FlatCard[] { return rebuildFlatCards(); },
    query(q: CardQuery):    FlatCard[] { return applyQuery(rebuildFlatCards(), q); },
    validate():             HealthReport {
      return buildHealthReport(setIndex, [...loadedSets.values()], errors);
    },
  };
}
