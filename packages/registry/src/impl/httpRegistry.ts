/**
 * impl/httpRegistry.ts
 * Loads data from https://images.barefootbetters.com/metadata/
 *
 * Fetches:
 *   {metadataBaseUrl}/metadata/card-types.json   → set index
 *   {metadataBaseUrl}/metadata/{abbr}.json        → full set data (on demand)
 */

import {
  SetIndexEntrySchema,
  SetDataSchema,
} from "../schema.js";
import {
  flattenSet,
  applyQuery,
  buildHealthReport,
} from "../shared.js";
import type {
  CardRegistry,
  SetIndexEntry,
  SetData,
  Hero,
  FlatCard,
  CardQuery,
  RegistryInfo,
  HealthReport,
  HttpRegistryOptions,
} from "../types/index.js";

export async function createRegistryFromHttp(
  options: HttpRegistryOptions
): Promise<CardRegistry> {
  const base = options.metadataBaseUrl.replace(/\/$/, "");
  const errors: Array<{ setAbbr?: string; code: string; message: string }> = [];

  // ── 1. Load set index ──────────────────────────────────────────────────────
  const indexRes = await fetch(`${base}/metadata/card-types.json`);
  if (!indexRes.ok) {
    throw new Error(
      `Failed to fetch card-types.json: ${indexRes.status} ${indexRes.statusText}`
    );
  }
  const rawIndex: unknown = await indexRes.json();
  const setIndex: SetIndexEntry[] = [];

  if (Array.isArray(rawIndex)) {
    for (const raw of rawIndex) {
      const result = SetIndexEntrySchema.safeParse(raw);
      if (result.success) {
        setIndex.push(result.data);
      } else {
        errors.push({
          code: "SET_INDEX_INVALID",
          message: result.error.issues.map((i) => i.message).join("; "),
        });
      }
    }
  }

  // Map abbr -> SetIndexEntry for fast lookup
  const setIndexMap = new Map<string, SetIndexEntry>(
    setIndex.map((s) => [s.abbr, s])
  );

  // ── 2. Eagerly load requested sets ─────────────────────────────────────────
  const loadedSets = new Map<string, SetData>();

  const toLoad = options.eagerLoad ?? [];
  const abbrsToLoad =
    toLoad.includes("*")
      ? setIndex.map((s) => s.abbr)
      : toLoad;

  await Promise.all(
    abbrsToLoad.map(async (abbr) => {
      try {
        const set = await fetchSet(base, abbr);
        if (set) loadedSets.set(abbr, set);
      } catch (err) {
        errors.push({
          setAbbr: abbr,
          code:    "SET_FETCH_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  // ── 3. Build flat card cache from loaded sets ──────────────────────────────
  function rebuildFlatCards(): FlatCard[] {
    const all: FlatCard[] = [];
    for (const [abbr, set] of loadedSets) {
      const meta = setIndexMap.get(abbr);
      all.push(...flattenSet(set, meta?.name ?? abbr));
    }
    return all;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    info(): RegistryInfo {
      const flat = rebuildFlatCards();
      return {
        totalSets:       setIndex.length,
        totalHeroes:     [...loadedSets.values()].reduce(
          (n, s) => n + s.heroes.length, 0
        ),
        totalCards:      flat.length,
        loadedSetAbbrs:  [...loadedSets.keys()],
        metadataBaseUrl: base,
      };
    },

    listSets(): SetIndexEntry[] {
      return setIndex;
    },

    getSet(abbr: string): SetData | undefined {
      return loadedSets.get(abbr);
    },

    listHeroes(): Hero[] {
      return [...loadedSets.values()].flatMap((s) => s.heroes);
    },

    listCards(): FlatCard[] {
      return rebuildFlatCards();
    },

    query(q: CardQuery): FlatCard[] {
      return applyQuery(rebuildFlatCards(), q);
    },

    validate(): HealthReport {
      return buildHealthReport(setIndex, [...loadedSets.values()], errors);
    },
  };
}

// ── Internal helper ───────────────────────────────────────────────────────────
async function fetchSet(base: string, abbr: string): Promise<SetData | null> {
  const res = await fetch(`${base}/metadata/${abbr}.json`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const raw: unknown = await res.json();
  const result = SetDataSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      result.error.issues.map((i) => `[${i.path.join(".")}] ${i.message}`).join("; ")
    );
  }
  return result.data;
}
