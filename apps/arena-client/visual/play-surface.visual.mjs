/**
 * Play-surface visual-regression guard (WP-689 / D-24506).
 *
 * A Playwright check that asserts the D-24505 fit invariants of `<PlayDesktop>`
 * at the three supported desktop widths, and captures a full-resolution frame of
 * each. It exists because a DOWNSCALED preview (the ~800px browser pane) hid the
 * WP-688 TurnActionBar overlap: only a real, full-resolution layout engine could
 * catch a mid-board overlap, and jsdom (the unit-test DOM) has no layout engine.
 *
 * This is NOT a pixel-diff / golden-image check (those flake across platforms on
 * font rendering). It asserts GEOMETRY invariants, so it is deterministic:
 *   1. no page scroll in either axis (the board fits the floor),
 *   2. the TurnActionBar does not vertically overlap the cockpit zones
 *      (played row / economy / victory pile) — the exact WP-688 regression,
 *   3. the authoring stage's visual box fits inside its fit container.
 *
 * Run it via `pnpm --filter @legendary-arena/arena-client test:visual` (which
 * lets this script spawn the `vite` DEV server), or point it at an
 * already-running server with `PLAY_URL=… node visual/play-surface.visual.mjs`
 * (the `test:visual:run` script). One-time browser install: `npx playwright
 * install chromium`.
 *
 * why the DEV server, not `vite preview`: the `?fixture=…&play=1` route only
 * loads its snapshot under `import.meta.env.DEV` (`apps/arena-client/src/main.ts`),
 * so the production build served by `vite preview` renders an empty board and the
 * guard never finds `.play-desktop__stage`. The check therefore drives `vite`
 * (dev), where the fixture is populated.
 *
 * Playwright is an arena-client devDependency only (Shared-Tooling posture,
 * `.claude/rules/architecture.md`) — never a production dependency.
 *
 * @see docs/ai/DECISIONS.md D-24505 (the fit) / D-24506 (this guard + the fix)
 * @see wiki/testing.md — how to run it + the CI-wiring follow-on
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(HERE, '__screenshots__');
// why: a fixed, uncommon port so an already-running dev server (5173/5174) never
// collides with the guard's own dev server.
const DEV_SERVER_PORT = 4318;
const FIXTURE_PATH = '/?fixture=mid-turn&play=1';

// The three supported desktop widths from D-24502 / D-24505. deviceScaleFactor:2
// gives a crisp 2× capture; the geometry assertions use CSS pixels regardless.
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

/**
 * Start the `vite` dev server on the fixed port and resolve once it serves 200,
 * unless PLAY_URL is already provided (then reuse that running server). Returns the
 * base URL plus a teardown function.
 */
async function startServer() {
  if (process.env.PLAY_URL) {
    return { baseUrl: process.env.PLAY_URL, stop: async () => {} };
  }
  // why: spawn the DEV server (not `vite preview`) through the shell so the local
  // `vite` bin resolves from node_modules/.bin on both Windows (vite.CMD) and POSIX
  // when run under `node`. Dev mode sets import.meta.env.DEV, which is what
  // populates the `?fixture=` snapshot the guard needs.
  const child = spawn(
    `npx vite --port ${DEV_SERVER_PORT} --strictPort`,
    { cwd: join(HERE, '..'), shell: true, stdio: 'ignore' },
  );
  const baseUrl = `http://localhost:${DEV_SERVER_PORT}`;
  const deadline = Date.now() + 30_000;
  // why: poll the port rather than sleeping a fixed time — dev-server readiness
  // varies by machine; fail loudly if it never comes up.
  for (;;) {
    try {
      const response = await fetch(baseUrl + FIXTURE_PATH);
      if (response.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(
        `vite dev did not serve ${baseUrl} within 30s (is the port free? is arena-client installed?).`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return { baseUrl, stop: async () => child.kill() };
}

/**
 * Measure the fit invariants for the currently-loaded page. Returns booleans +
 * the raw numbers so a failure log is actionable. Runs in the browser context.
 */
function measureInvariants() {
  const de = document.documentElement;
  const rect = (selector) => {
    const element = document.querySelector(selector);
    return element ? element.getBoundingClientRect() : null;
  };
  // why: two rectangles vertically overlap when each starts before the other
  // ends; a 1px tolerance absorbs sub-pixel rounding from the scale transform.
  const overlapsVertically = (a, b) =>
    a !== null && b !== null && a.top < b.bottom - 1 && b.top < a.bottom - 1;

  const turnBar = rect('.turn-action-bar');
  const played = rect('[data-testid="play-played-row"]');
  const economy = rect('[data-testid="play-economy-bar"]');
  const victory = rect('[data-testid="play-your-victory-pile"]');
  const stage = rect('.play-desktop__stage');
  const fit = rect('.play-desktop__fit');

  const turnBarOverlapsCockpit =
    overlapsVertically(turnBar, played) ||
    overlapsVertically(turnBar, economy) ||
    overlapsVertically(turnBar, victory);

  const boardFitsContainer =
    stage !== null &&
    fit !== null &&
    stage.top >= fit.top - 1 &&
    stage.bottom <= fit.bottom + 1 &&
    stage.left >= fit.left - 1 &&
    stage.right <= fit.right + 1;

  return {
    pageScrollsY: de.scrollHeight > de.clientHeight,
    pageScrollsX: de.scrollWidth > de.clientWidth,
    turnBarOverlapsCockpit,
    boardFitsContainer,
    turnBarFound: turnBar !== null,
  };
}

/**
 * Load the fixture route in a page and wait for the board to mount. Uses a
 * generous timeout because a COLD `vite` dev server compiles the app's modules
 * on the first browser request (hundreds of modules — can take far longer than a
 * warm server). If the board never mounts, dump what DID render so a failure is
 * self-diagnosing instead of a bare selector timeout.
 */
async function loadBoard(page, baseUrl, timeoutMs) {
  await page.goto(baseUrl + FIXTURE_PATH, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  try {
    await page.waitForSelector('.play-desktop__stage', { timeout: timeoutMs });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      hasPlayDesktop: !!document.querySelector('.play-desktop'),
      hasPlayMobile: !!document.querySelector('.play-mobile'),
      hasEmptyMatch: !!document.querySelector('[data-testid="play-empty-match"]'),
      innerWidth: window.innerWidth,
      bodyTextStart: document.body.innerText.slice(0, 160),
    }));
    console.error('  .play-desktop__stage never mounted. Page state:', JSON.stringify(diagnostic));
    throw error;
  }
}

async function run() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const { baseUrl, stop } = await startServer();
  const browser = await chromium.launch();
  const failures = [];
  try {
    // why: warm the cold dev server ONCE (first-request compile is the slow part);
    // give it 90s. After this the per-viewport loads below are fast.
    const warmup = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await loadBoard(warmup, baseUrl, 90_000);
    await warmup.close();

    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      await loadBoard(page, baseUrl, 30_000);
      // why: let useScaleToFit settle + fonts render before measuring/shooting.
      await page.waitForTimeout(700);

      const label = `${viewport.width}x${viewport.height}`;
      await page.screenshot({ path: join(SCREENSHOT_DIR, `play-desktop-${label}.png`) });
      const result = await page.evaluate(measureInvariants);
      console.log(`  ${label}:`, JSON.stringify(result));

      if (!result.turnBarFound) failures.push(`${label}: TurnActionBar not found`);
      if (result.pageScrollsY) failures.push(`${label}: page scrolls vertically (board does not fit)`);
      if (result.pageScrollsX) failures.push(`${label}: page scrolls horizontally`);
      if (result.turnBarOverlapsCockpit) failures.push(`${label}: TurnActionBar overlaps the cockpit (the WP-688 regression)`);
      if (!result.boardFitsContainer) failures.push(`${label}: board stage does not fit its container`);

      await page.close();
    }
  } finally {
    await browser.close();
    await stop();
  }

  if (failures.length > 0) {
    console.error('\nplay-surface visual guard FAILED:');
    for (const failure of failures) console.error('  - ' + failure);
    process.exit(1);
  }
  console.log(`\nplay-surface visual guard PASSED (screenshots in ${SCREENSHOT_DIR})`);
}

run().catch((error) => {
  console.error('play-surface visual guard errored:', error);
  process.exit(1);
});
