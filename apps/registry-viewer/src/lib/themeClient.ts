/**
 * themeClient.ts — Fetches theme JSON files from R2 for the registry viewer.
 *
 * Themes are stored alongside card metadata at {metadataBaseUrl}/themes/.
 * An index.json manifest lists all available theme filenames.
 */

// ── Types (viewer-local, not imported from packages/registry) ───────────────

export interface ThemeSetupIntent {
  mastermindId: string;
  schemeId: string;
  villainGroupIds: string[];
  henchmanGroupIds?: string[];
  heroDeckIds: string[];
}

export interface ThemePlayerCount {
  recommended: number[];
  min: number;
  max: number;
}

export interface ThemePrimaryStoryReference {
  issue?: string;
  year?: number;
  externalUrl?: string;
  marvelUnlimitedUrl?: string;
  externalIndexUrls?: string[];
}

export interface ThemeDefinition {
  themeSchemaVersion: number;
  themeId: string;
  name: string;
  description: string;
  setupIntent: ThemeSetupIntent;
  playerCount: ThemePlayerCount;
  tags?: string[];
  references?: {
    primaryStory: ThemePrimaryStoryReference;
  };
  flavorText?: string;
}

// ── Singleton loader ────────────────────────────────────────────────────────

let _promise: Promise<ThemeDefinition[]> | null = null;

/**
 * Fetches all theme definitions from R2. Results are cached for the session.
 * @param metadataBaseUrl - The base URL for R2 metadata (same as card data).
 */
export function getThemes(metadataBaseUrl: string): Promise<ThemeDefinition[]> {
  if (_promise) return _promise;
  _promise = (async () => {
    const indexResponse = await fetch(`${metadataBaseUrl}/themes/index.json`);
    if (!indexResponse.ok) {
      throw new Error(
        `Cannot load themes/index.json: HTTP ${indexResponse.status}. ` +
        'Verify that theme files have been uploaded to R2.',
      );
    }
    const filenames: string[] = await indexResponse.json();

    const fetchResults = await Promise.allSettled(
      filenames.map(async (filename) => {
        const themeResponse = await fetch(`${metadataBaseUrl}/themes/${filename}`);
        if (!themeResponse.ok) {
          console.warn(`[Themes] Failed to load ${filename}: HTTP ${themeResponse.status}`);
          return null;
        }
        return themeResponse.json() as Promise<ThemeDefinition>;
      }),
    );

    const themes: ThemeDefinition[] = [];
    for (const result of fetchResults) {
      if (result.status === 'fulfilled' && result.value !== null) {
        themes.push(result.value);
      }
    }

    // why: sort alphabetically by name for stable display order
    themes.sort((a, b) => a.name.localeCompare(b.name));
    return themes;
  })();
  return _promise;
}

export function resetThemes(): void {
  _promise = null;
}
