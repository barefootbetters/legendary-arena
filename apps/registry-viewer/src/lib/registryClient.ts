import { createRegistryFromHttp } from "../registry/browser";
import type { CardRegistry } from "../registry/browser";
import { devLog } from "./devLog";

interface RegistryConfig {
  metadataBaseUrl: string;
  eagerLoad?: string[];
}

let _promise: Promise<CardRegistry> | null = null;

export function getRegistry(): Promise<CardRegistry> {
  if (_promise) return _promise;
  _promise = (async () => {
    const startedAt = performance.now();
    let baseUrl = "";
    try {
      const res = await fetch("/registry-config.json");
      if (!res.ok) throw new Error(`Cannot load registry-config.json: ${res.status}`);
      const config: RegistryConfig = await res.json();
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
