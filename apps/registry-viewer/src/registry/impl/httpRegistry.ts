import { SetDataSchema } from "../schema.js";
import { flattenSet, applyQuery, buildHealthReport } from "../shared.js";
import type {
  CardRegistry, SetIndexEntry, SetData, Hero,
  FlatCard, CardQuery, RegistryInfo, HealthReport, HttpRegistryOptions,
} from "../types/index.js";

export async function createRegistryFromHttp(
  options: HttpRegistryOptions
): Promise<CardRegistry> {
  const base = options.metadataBaseUrl.replace(/\/$/, "");
  const errors: Array<{ setAbbr?: string; code: string; message: string }> = [];

  // ── 1. Load set index — accept any object, extract what we need ─────────────
  const indexRes = await fetch(`${base}/metadata/sets.json`);
  if (!indexRes.ok) {
    throw new Error(`Failed to fetch sets.json: ${indexRes.status} ${indexRes.statusText}`);
  }
  const rawIndex: unknown = await indexRes.json();
  const setIndex: SetIndexEntry[] = [];

  if (Array.isArray(rawIndex)) {
    for (const raw of rawIndex) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Record<string, unknown>;
      // Accept any entry that has at minimum an abbr or id we can use
      const abbr = String(r["abbr"] ?? r["slug"] ?? r["id"] ?? "").trim();
      const name = String(r["name"] ?? abbr).trim();
      if (!abbr) continue;
      setIndex.push({
        id:          Number(r["id"]) || 0,
        abbr,
        pkgId:       Number(r["pkgId"]) || undefined,
        slug:        String(r["slug"] ?? abbr),
        name:        name || abbr,
        releaseDate: String(r["releaseDate"] ?? ""),
        type:        String(r["type"] ?? ""),
      });
    }
  }

  const setIndexMap = new Map<string, SetIndexEntry>(setIndex.map((s) => [s.abbr, s]));

  // ── 2. Eagerly load requested sets ─────────────────────────────────────────
  const loadedSets = new Map<string, SetData>();
  const toLoad = options.eagerLoad ?? [];
  const abbrsToLoad = toLoad.includes("*") ? setIndex.map((s) => s.abbr) : toLoad;

  await Promise.all(
    abbrsToLoad.map(async (abbr) => {
      try {
        const set = await fetchSet(base, abbr);
        if (set) loadedSets.set(abbr, set);
      } catch (err) {
        errors.push({
          setAbbr: abbr,
          code: "SET_FETCH_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

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
        metadataBaseUrl: base,
      };
    },
    listSets():           SetIndexEntry[]      { return setIndex; },
    getSet(abbr: string): SetData | undefined  { return loadedSets.get(abbr); },
    listHeroes():         Hero[]               { return [...loadedSets.values()].flatMap((s) => s.heroes); },
    listCards():          FlatCard[]           { return rebuildFlatCards(); },
    query(q: CardQuery):  FlatCard[]           { return applyQuery(rebuildFlatCards(), q); },
    validate():           HealthReport         { return buildHealthReport(setIndex, [...loadedSets.values()], errors); },
  };
}

async function fetchSet(base: string, abbr: string): Promise<SetData | null> {
  const res = await fetch(`${base}/metadata/${abbr}.json`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw: unknown = await res.json();
  const result = SetDataSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      result.error.issues.map((i) => `[${i.path.join(".")}] ${i.message}`).join("; ")
    );
  }
  return result.data;
}
