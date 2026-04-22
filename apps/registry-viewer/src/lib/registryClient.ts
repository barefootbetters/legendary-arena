import { createRegistryFromHttp } from "../registry/browser";
import type { CardRegistry } from "../registry/browser";
// why: import ViewerConfigSchema from the `@legendary-arena/registry/schema`
// subpath rather than the barrel. The barrel re-exports a Node-only
// local-file registry factory that pulls in `node:fs/promises` and
// `node:path`. Vite externalizes those for the browser build, but Rollup
// resolves the import graph before tree-shaking can prune the unused
// Node-only factory, so the browser build would fail on `resolve` from
// `__vite-browser-external`. The dedicated `./schema` subpath export has
// zero Node-module dependencies and sidesteps the issue.
import {
  ViewerConfigSchema,
  type ViewerConfig,
} from "@legendary-arena/registry/schema";
import { devLog } from "./devLog";

let _promise: Promise<CardRegistry> | null = null;

export function getRegistry(): Promise<CardRegistry> {
  if (_promise) return _promise;
  _promise = (async () => {
    const startedAt = performance.now();
    const url = "/registry-config.json";
    let baseUrl = "";
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Cannot load registry-config.json: ${res.status}`);
      const rawPayload = await res.json();
      const parseResult = ViewerConfigSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        // why: dot-joined path keeps viewer logs operator-readable without
        // Zod fluency; default ["eagerLoad","0"]-style array paths are noisy.
        // First issue only — additional issues suppressed so operator logs stay
        // scannable, per WP-083 §"Zod error reporting" lock.
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        throw new Error(
          `[RegistryConfig] Rejected registry-config.json from ${url}: ${path} — ${issue.message}. ` +
          `Viewer cannot boot with an invalid config; fix the file and redeploy.`,
        );
      }
      const config: ViewerConfig = parseResult.data;
      baseUrl = config.metadataBaseUrl;
      devLog("registry", "load start", { baseUrl });
      const registry = await createRegistryFromHttp({
        metadataBaseUrl: baseUrl,
        eagerLoad: config.eagerLoad ?? [],
      });
      const cards = registry.listCards();
      devLog("registry", "load complete", {
        baseUrl,
        durationMs: Math.round(performance.now() - startedAt),
        setCount: registry.listSets().length,
        cardCount: cards.length,
        sampleCardIds: cards.slice(0, 3).map((c) => c.key),
      });
      return registry;
    } catch (error) {
      devLog("registry", "load failed", {
        baseUrl,
        durationMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  })();
  return _promise;
}

export function resetRegistry(): void { _promise = null; }
