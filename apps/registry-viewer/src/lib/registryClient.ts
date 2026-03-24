import { createRegistryFromHttp } from "../registry/browser";
import type { CardRegistry } from "../registry/browser";

interface RegistryConfig {
  metadataBaseUrl: string;
  eagerLoad?: string[];
}

let _promise: Promise<CardRegistry> | null = null;

export function getRegistry(): Promise<CardRegistry> {
  if (_promise) return _promise;
  _promise = (async () => {
    const res = await fetch("/registry-config.json");
    if (!res.ok) throw new Error(`Cannot load registry-config.json: ${res.status}`);
    const config: RegistryConfig = await res.json();
    return createRegistryFromHttp({
      metadataBaseUrl: config.metadataBaseUrl,
      eagerLoad: config.eagerLoad ?? [],
    });
  })();
  return _promise;
}

export function resetRegistry(): void { _promise = null; }
