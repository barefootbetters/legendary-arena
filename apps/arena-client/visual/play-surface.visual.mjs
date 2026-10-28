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
 *   3. the authoring stage's visual box fits inside its fit container,
 *   4. (WP-852 / D-24788) the table perspective: the board plane is tilted, City
 *      boxes keep a gap, the plane clears the HUD and cockpit, resting cards take
 *      their own clicks, and a hovered City / HQ card lifts and squares up; a
 *      fresh page at Effect Intensity `off` is flat.
 *
 * Run it via `pnpm --filter @legendary-arena/arena-client test:visual` (which
 * lets this script spawn the `vite` DEV server), or point it at an
 * already-running server with `PLAY_URL=… node visual/play-surface.visual.mjs`
 * (the `test:visual:run` script). One-time browser install: `pnpm --filter
 * @legendary-arena/arena-client exec playwright install chromium`.
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
import { createServer } from 'node:net';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(HERE, '__screenshots__');
// why: a FRESH ephemeral port per run (not a fixed one) — a `shell:true` spawn on
// Windows leaks the vite process when the wrapper is killed, and a fixed port let
// that orphan keep answering the next run (a stale `vite preview` prod server
// masked every dev-mode fix until the port was hand-killed). A per-run free port
// makes an orphaned server irrelevant: the next run simply binds a different port.
async function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}
const FIXTURE_PATH = '/?fixture=mid-turn&play=1';

// The three supported desktop widths from D-24502 / D-24505. deviceScaleFactor:2
// gives a crisp 2× capture; the geometry assertions use CSS pixels regardless.
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

/**
 * Kill the spawned server's whole process tree. A `shell:true` spawn on Windows
 * makes `child` the cmd.exe wrapper, not vite — a plain `child.kill()` leaves vite
 * orphaned; `taskkill /t` kills the tree. Best-effort: with a fresh port per run, a
 * surviving orphan is harmless anyway.
 */
async function stopServer(child) {
  if (child.pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      child.kill();
    }
  } catch {
    // best effort
  }
}

/**
 * Start the `vite` dev server on a FRESH ephemeral port and resolve once it serves
 * 200, unless PLAY_URL is already provided (then reuse that running server). Returns
 * the base URL plus a tree-killing teardown.
 */
async function startServer() {
  if (process.env.PLAY_URL) {
    return { baseUrl: process.env.PLAY_URL, stop: async () => {} };
  }
  const port = await findFreePort();
  // why: spawn the DEV server (not `vite preview`) through the shell so the local
  // `vite` bin resolves from node_modules/.bin on both Windows (vite.CMD) and POSIX
  // when run under `node`. Dev mode sets import.meta.env.DEV, which gates the
  // `?fixture=` snapshot load in main.ts — a production build (preview) renders an
  // empty "No match loaded" board. `--mode development` + `NODE_ENV=development` pin
  // dev mode regardless of the caller's ambient NODE_ENV.
  const child = spawn(
    `npx vite --port ${port} --strictPort --mode development`,
    {
      cwd: join(HERE, '..'),
      shell: true,
      stdio: 'ignore',
      env: { ...process.env, NODE_ENV: 'development' },
    },
  );
  const stop = () => stopServer(child);
  const baseUrl = `http://localhost:${port}`;
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
      await stop();
      throw new Error(
        `vite dev did not serve ${baseUrl} within 30s (is arena-client installed?).`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return { baseUrl, stop };
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
 * Stage a fight discard cost (Primus, WP-817 / D-24750) on the rightmost occupied
 * City space, give the viewer a hand card that pays it, open the discard chooser,
 * and report whether every chooser button is the topmost element at its own
 * centre. Runs in the browser context.
 *
 * why: the chooser once rendered beside the villain tile and under the next City
 * cell (the Villain Deck), so a player saw no discard option and could not click
 * one. jsdom has no layout, so only this full-resolution check can see it. The
 * mid-turn fixture has no Primus, so the guard stages one through the dev uiState
 * store (dev server only) rather than editing the shared fixture.
 */
async function measureDiscardChooser() {
  const pinia = document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia;
  const uiStateStore = pinia?._s.get('uiState');
  if (uiStateStore === undefined || uiStateStore.snapshot === null) {
    return { staged: false, reason: 'uiState store or snapshot not found' };
  }
  const snapshot = JSON.parse(JSON.stringify(uiStateStore.snapshot));
  const cityIndex = snapshot.city.spaces.findIndex((space) => space !== null);
  const viewer = snapshot.players.find((player) => Array.isArray(player.handCards) && player.handCards.length > 0);
  if (cityIndex === -1 || viewer === undefined) {
    return { staged: false, reason: 'fixture has no City villain or no viewer hand' };
  }
  const space = snapshot.city.spaces[cityIndex];
  snapshot.city.spaces[cityIndex] = {
    ...space,
    display: { ...space.display, cost: 0 },
    fightCost: 0,
    fightDiscardCosts: [2, 3, 5, 7],
  };
  viewer.handCosts = viewer.handCards.map(() => 3);
  uiStateStore.snapshot = snapshot;
  await new Promise((resolve) => setTimeout(resolve, 300));

  const villainButton = document.querySelector(
    `[data-testid="play-city-villain"][data-city-index="${cityIndex}"]`,
  );
  if (villainButton === null || villainButton.disabled) {
    return { staged: false, reason: 'staged villain missing or its Fight is disabled' };
  }
  villainButton.click();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const chooser = document.querySelector('[data-testid="play-city-discard-chooser"]');
  if (chooser === null) {
    return { staged: true, chooserOpened: false, coveredButtons: [] };
  }
  const coveredButtons = [];
  for (const button of chooser.querySelectorAll('button')) {
    button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (hit === null || !button.contains(hit)) {
      coveredButtons.push({
        text: button.textContent.trim(),
        coveredBy: hit === null ? null : hit.getAttribute('data-testid') ?? hit.className ?? hit.tagName,
      });
    }
  }
  return { staged: true, chooserOpened: true, buttonCount: chooser.querySelectorAll('button').length, coveredButtons };
}

/**
 * Measure the WP-852 table-perspective invariants on the untouched fixture: the
 * board plane is tilted, neighbouring City boxes stay apart, and the tilted plane
 * stays clear of the top status bar and the cockpit. Runs in the browser context.
 *
 * why gaps, not a pixel tolerance: the slash gesture's full-crossing rule and the
 * VFX overlay anchors both read `getBoundingClientRect()`, an axis-aligned box that
 * reaches a few px past a tilted card's visible trapezoid. That slop is harmless
 * as long as neighbouring boxes never touch (a stroke can still cross one box
 * fully without entering the next), so the guard pins the gap itself (> 0) rather
 * than a slop budget that would have to track the angle.
 */
function measureTilt() {
  const plane = document.querySelector('.play-desktop__board-plane');
  const hud = document.querySelector('.top-hud-bar');
  const cockpit = document.querySelector('.play-desktop__player-zone');
  const cityBoxes = [
    ...document.querySelectorAll('[data-testid="play-city-villain"], [data-testid="play-city-empty"]'),
  ]
    .map((element) => element.getBoundingClientRect())
    .sort((first, second) => first.left - second.left);
  let smallestCityGap = Infinity;
  for (let i = 1; i < cityBoxes.length; i += 1) {
    smallestCityGap = Math.min(smallestCityGap, cityBoxes[i].left - cityBoxes[i - 1].right);
  }
  const planeRect = plane === null ? null : plane.getBoundingClientRect();
  const hudRect = hud === null ? null : hud.getBoundingClientRect();
  const cockpitRect = cockpit === null ? null : cockpit.getBoundingClientRect();
  const planeM22 = plane === null ? 1 : new DOMMatrix(getComputedStyle(plane).transform).m22;
  return {
    isBoardTilted: planeM22 < 0.999,
    hasCityBoxGaps: cityBoxes.length > 1 && smallestCityGap > 0,
    isPlaneClearOfHud: planeRect !== null && hudRect !== null && planeRect.top >= hudRect.bottom - 1,
    isPlaneClearOfCockpit: planeRect !== null && cockpitRect !== null && planeRect.bottom <= cockpitRect.top + 1,
    planeM22,
    smallestCityGap,
    cityBoxCount: cityBoxes.length,
  };
}

/**
 * Check that every resting City villain and HQ hero takes its own clicks: a 3x3
 * interior grid on each button hit-tests to that button. Runs in the browser
 * context.
 *
 * why (WP-852 EC amendment A): with the locked preserve-3d chain on at rest,
 * coplanar 3D layers z-fought in Chrome's hit test and the board plane took up
 * to 60% of a resting HQ card's clicks, while every geometry check still passed.
 * The interior grid stays off the rounded corners, which a flat board misses too.
 */
function measureRestingHits() {
  const missedCards = [];
  const buttons = document.querySelectorAll('[data-testid="play-city-villain"], [data-testid="play-hq-hero"]');
  for (const button of buttons) {
    const box = button.getBoundingClientRect();
    let missCount = 0;
    for (const fractionX of [0.25, 0.5, 0.75]) {
      for (const fractionY of [0.25, 0.5, 0.75]) {
        const hit = document.elementFromPoint(box.left + box.width * fractionX, box.top + box.height * fractionY);
        if (hit === null || !button.contains(hit)) missCount += 1;
      }
    }
    if (missCount > 0) missedCards.push({ cardId: button.getAttribute('data-card-id'), missCount });
  }
  return { isRestingCardHitIntact: buttons.length > 0 && missedCards.length === 0, cardCount: buttons.length, missedCards };
}

/** Read the first element matching `selector` as a plain rect (browser context). */
function readRect(selector) {
  const element = document.querySelector(selector);
  if (element === null) return null;
  const box = element.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
}

/**
 * Measure a hovered (lifted) board card against its resting rect: it rose, its new
 * top is visible and on top, the 3D chain from the button up to the board plane is
 * intact, and the resting card's bottom edge still hits the button. Optionally
 * re-checks the City box gaps with the card lifted. Runs in the browser context.
 */
function measureHover({ selector, restingRect, isCityGapCheck }) {
  const button = document.querySelector(selector);
  if (button === null) return { found: false };
  const box = button.getBoundingClientRect();
  const centreX = restingRect.left + restingRect.width / 2;
  const topHit = document.elementFromPoint(centreX, box.top + 3);
  const bottomHit = document.elementFromPoint(centreX, restingRect.bottom - 3);
  // why: a single non-3D link (a clip, a fade, a filter) flattens everything under
  // it, so the card rises but stays tilted, and still passes the lift and
  // visibility checks. Walk the whole chain to catch that.
  const brokenLinks = [];
  let link = button;
  while (link !== null) {
    const style = getComputedStyle(link);
    const isLinkIntact =
      style.transformStyle === 'preserve-3d' &&
      style.overflowX === 'visible' &&
      style.overflowY === 'visible' &&
      style.opacity === '1' &&
      style.filter === 'none';
    if (!isLinkIntact) {
      brokenLinks.push({
        element: link.className || link.tagName,
        transformStyle: style.transformStyle,
        overflow: `${style.overflowX}/${style.overflowY}`,
        opacity: style.opacity,
        filter: style.filter,
      });
    }
    if (link.classList.contains('play-desktop__board-plane')) break;
    link = link.parentElement;
  }
  const result = {
    found: true,
    isHoverLifted: box.top < restingRect.top - 4,
    isHoverVisible: topHit !== null && button.contains(topHit),
    isHoverChainIntact: link !== null && brokenLinks.length === 0,
    isHoverBottomCovered: bottomHit !== null && button.contains(bottomHit),
    restingTop: restingRect.top,
    liftedTop: box.top,
    brokenLinks,
  };
  if (isCityGapCheck) {
    const cityBoxes = [
      ...document.querySelectorAll('[data-testid="play-city-villain"], [data-testid="play-city-empty"]'),
    ]
      .map((element) => element.getBoundingClientRect())
      .sort((first, second) => first.left - second.left);
    let smallestCityGap = Infinity;
    for (let i = 1; i < cityBoxes.length; i += 1) {
      smallestCityGap = Math.min(smallestCityGap, cityBoxes[i].left - cityBoxes[i - 1].right);
    }
    result.hasCityBoxGapsWhileHovered = cityBoxes.length > 1 && smallestCityGap > 0;
    result.smallestCityGapWhileHovered = smallestCityGap;
  }
  return result;
}

/**
 * Hover the first element matching `selector`, wait for the 150 ms lift to
 * settle, and measure it with `measureHover`; then move the mouse away.
 */
async function hoverAndMeasure(page, selector, isCityGapCheck) {
  const restingRect = await page.evaluate(readRect, selector);
  if (restingRect === null) return { found: false };
  await page.hover(selector);
  await page.waitForTimeout(300);
  const result = await page.evaluate(measureHover, { selector, restingRect, isCityGapCheck });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  return result;
}

/** Push the City or HQ hover-check failures for one viewport. */
function collectHoverFailures(failures, label, rowName, hover, isCityGapCheck) {
  if (!hover.found) {
    failures.push(`${label}: no ${rowName} card to hover`);
    return;
  }
  if (!hover.isHoverLifted) failures.push(`${label}: hovered ${rowName} card did not lift`);
  if (!hover.isHoverVisible) failures.push(`${label}: hovered ${rowName} card is clipped or covered`);
  if (isCityGapCheck && !hover.hasCityBoxGapsWhileHovered) {
    failures.push(`${label}: neighbouring City boxes touch while a card is lifted`);
  }
  if (!hover.isHoverChainIntact) {
    failures.push(`${label}: hovered ${rowName} card lifts but stays tilted (preserve-3d chain broken)`);
  }
  if (!hover.isHoverBottomCovered) {
    failures.push(`${label}: the bottom of a lifted ${rowName} card does not hit its button`);
  }
}

/** Read every element matching `selector` as an id + click point (browser context). */
function readSlideTargets(selector) {
  return [...document.querySelectorAll(selector)].map((element) => {
    const box = element.getBoundingClientRect();
    return { cardId: element.getAttribute('data-card-id'), x: box.left + box.width / 2, y: box.top + box.height * 0.75 };
  });
}

/**
 * Record which board button each click lands on, and swallow it in the capture
 * phase so the guard never submits a fight or recruit (browser context).
 */
function installClickRecorder() {
  window.__wp852SlideClicks = [];
  window.__wp852SlideRecorder = (event) => {
    const button = event.target.closest('button');
    window.__wp852SlideClicks.push(button === null ? null : button.getAttribute('data-card-id'));
    event.preventDefault();
    event.stopPropagation();
  };
  document.addEventListener('click', window.__wp852SlideRecorder, true);
}

/** Remove the click recorder and return what it saw (browser context). */
function removeClickRecorder() {
  document.removeEventListener('click', window.__wp852SlideRecorder, true);
  return window.__wp852SlideClicks;
}

/**
 * Slide from each lifted card onto its neighbour (both directions) and click at
 * once, with no settle time; every click must land on the neighbour's button.
 *
 * why (WP-852 EC amendment A): the moment the pointer reaches a neighbour, the
 * 3D chain is on but the new card has not risen yet, so it is coplanar with the
 * board plane, and the plane could win the hit test and swallow the click. The
 * plane's `pointer-events: none` while 3D fixes that; this step pins it. The
 * race is timing-dependent, so it runs every neighbour pair in both directions.
 */
async function slideAndClick(page, selector) {
  const targets = await page.evaluate(readSlideTargets, selector);
  const slides = [];
  for (let i = 0; i + 1 < targets.length; i += 1) {
    slides.push([targets[i], targets[i + 1]], [targets[i + 1], targets[i]]);
  }
  await page.evaluate(installClickRecorder);
  for (const [from, to] of slides) {
    await page.mouse.move(from.x, from.y);
    await page.waitForTimeout(250);
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.down();
    await page.mouse.up();
  }
  const clicks = await page.evaluate(removeClickRecorder);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  const missedSlides = [];
  for (let i = 0; i < slides.length; i += 1) {
    if (clicks[i] !== slides[i][1].cardId) {
      missedSlides.push({ from: slides[i][0].cardId, to: slides[i][1].cardId, clicked: clicks[i] ?? null });
    }
  }
  return { slideCount: slides.length, isSlideClickIntact: slides.length > 0 && missedSlides.length === 0, missedSlides };
}

/** Read the open discard chooser's City space rect (browser context). */
function readChooserSpaceRect() {
  const chooser = document.querySelector('[data-testid="play-city-discard-chooser"]');
  const space = chooser === null ? null : chooser.closest('li.city-space');
  if (space === null) return null;
  const box = space.getBoundingClientRect();
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

/**
 * Re-check that every open discard-chooser button is the topmost element at its
 * centre (the same loop as `measureDiscardChooser`), here with the pointer over
 * the chooser's own City space. Runs in the browser context.
 *
 * why: a lifted card stands out of the table in 3D, where depth order beats
 * z-index, so it would paint over the flat chooser in the same space. The
 * `city-space--choosing` exclusion keeps that space from lifting; this pins it.
 */
function measureChooserCoveredButtons() {
  const chooser = document.querySelector('[data-testid="play-city-discard-chooser"]');
  if (chooser === null) return { chooserOpen: false, coveredButtons: [] };
  const coveredButtons = [];
  for (const button of chooser.querySelectorAll('button')) {
    button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (hit === null || !button.contains(hit)) {
      coveredButtons.push({
        text: button.textContent.trim(),
        coveredBy: hit === null ? null : hit.getAttribute('data-testid') ?? hit.className ?? hit.tagName,
      });
    }
  }
  return { chooserOpen: true, coveredButtons };
}

/** Read the board plane's computed m22 (1 when flat, browser context). */
function readPlaneM22() {
  const plane = document.querySelector('.play-desktop__board-plane');
  return plane === null ? null : new DOMMatrix(getComputedStyle(plane).transform).m22;
}

/**
 * Load the fixture route in a page and wait for the board to mount. Uses a
 * generous timeout because a COLD `vite` dev server compiles the app's modules
 * on the first browser request (hundreds of modules — can take far longer than a
 * warm server). If the board never mounts, dump what DID render so a failure is
 * self-diagnosing instead of a bare selector timeout.
 */
async function loadBoard(page, baseUrl, timeoutMs) {
  // why: main.ts logs `__WP061_DEV_FIXTURE_HARNESS__` ONLY inside its
  // `if (import.meta.env.DEV)` block — capturing it tells us whether the dev-only
  // fixture loader ran, which is the difference between "board fits" and the
  // empty-match "No match loaded" state.
  let devFixtureHarnessRan = false;
  page.on('console', (message) => {
    if (message.text().includes('__WP061_DEV_FIXTURE_HARNESS__')) devFixtureHarnessRan = true;
  });
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
    diagnostic.devFixtureHarnessRan = devFixtureHarnessRan;
    console.error('  .play-desktop__stage never mounted. Page state:', JSON.stringify(diagnostic));
    if (!devFixtureHarnessRan) {
      console.error('  → the DEV fixture harness did NOT run: import.meta.env.DEV is false. The dev server is in production mode (ambient NODE_ENV?). The guard forces --mode development + NODE_ENV=development; if you still see this, something else is forcing production.');
    }
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

      // WP-852 / D-24788 — the table perspective, on the untouched fixture.
      const tilt = await page.evaluate(measureTilt);
      console.log(`  ${label} tilt:`, JSON.stringify(tilt));
      if (!tilt.isBoardTilted) failures.push(`${label}: board plane is not tilted`);
      if (!tilt.hasCityBoxGaps) failures.push(`${label}: neighbouring City boxes touch or overlap under the tilt`);
      if (!tilt.isPlaneClearOfHud) failures.push(`${label}: tilted board overlaps the top status bar`);
      if (!tilt.isPlaneClearOfCockpit) failures.push(`${label}: tilted board overlaps the cockpit`);
      const restingHits = await page.evaluate(measureRestingHits);
      console.log(`  ${label} resting hits:`, JSON.stringify(restingHits));
      if (!restingHits.isRestingCardHitIntact) {
        failures.push(`${label}: a resting City or HQ card does not take its own clicks under the tilt`);
      }

      const cityHover = await hoverAndMeasure(page, '[data-testid="play-city-villain"]', true);
      console.log(`  ${label} City hover:`, JSON.stringify(cityHover));
      collectHoverFailures(failures, label, 'City', cityHover, true);
      const hqHover = await hoverAndMeasure(page, '[data-testid="play-hq-hero"]', false);
      console.log(`  ${label} HQ hover:`, JSON.stringify({
        found: hqHover.found,
        isHqHoverLifted: hqHover.isHoverLifted,
        isHqHoverVisible: hqHover.isHoverVisible,
        isHqHoverChainIntact: hqHover.isHoverChainIntact,
        isHqHoverBottomCovered: hqHover.isHoverBottomCovered,
        restingTop: hqHover.restingTop,
        liftedTop: hqHover.liftedTop,
        brokenLinks: hqHover.brokenLinks,
      }));
      collectHoverFailures(failures, label, 'HQ', hqHover, false);

      const citySlide = await slideAndClick(page, '[data-testid="play-city-villain"]');
      console.log(`  ${label} City slide-and-click:`, JSON.stringify(citySlide));
      if (!citySlide.isSlideClickIntact) {
        failures.push(`${label}: a click right after sliding onto a City card missed it: ${JSON.stringify(citySlide.missedSlides)}`);
      }
      const hqSlide = await slideAndClick(page, '[data-testid="play-hq-hero"]');
      console.log(`  ${label} HQ slide-and-click:`, JSON.stringify({
        slideCount: hqSlide.slideCount,
        isHqSlideClickIntact: hqSlide.isSlideClickIntact,
        missedSlides: hqSlide.missedSlides,
      }));
      if (!hqSlide.isSlideClickIntact) {
        failures.push(`${label}: a click right after sliding onto an HQ card missed it: ${JSON.stringify(hqSlide.missedSlides)}`);
      }

      // why: last, because it re-stages the board; the fit invariants above are
      // measured on the untouched fixture.
      const chooser = await page.evaluate(measureDiscardChooser);
      console.log(`  ${label} discard chooser:`, JSON.stringify(chooser));
      await page.screenshot({ path: join(SCREENSHOT_DIR, `play-desktop-${label}-discard-chooser.png`) });
      if (!chooser.staged) {
        failures.push(`${label}: could not stage the discard chooser (${chooser.reason})`);
      } else if (!chooser.chooserOpened) {
        failures.push(`${label}: clicking a discard-cost villain did not open the discard chooser`);
      } else if (chooser.coveredButtons.length > 0) {
        failures.push(`${label}: discard chooser buttons are covered and cannot be clicked: ${JSON.stringify(chooser.coveredButtons)}`);
      } else {
        // why: WP-852 — a raw mouse move, because the open chooser covers the
        // villain button and page.hover() would refuse to hover a covered element.
        const spaceRect = await page.evaluate(readChooserSpaceRect);
        if (spaceRect === null) {
          failures.push(`${label}: discard chooser space not found for the hovered re-check`);
        } else {
          await page.mouse.move(spaceRect.left + spaceRect.width / 2, spaceRect.top + spaceRect.height / 2);
          await page.waitForTimeout(300);
          const hoveredChooser = await page.evaluate(measureChooserCoveredButtons);
          console.log(`  ${label} discard chooser (space hovered):`, JSON.stringify(hoveredChooser));
          if (!hoveredChooser.chooserOpen || hoveredChooser.coveredButtons.length > 0) {
            failures.push(`${label}: discard chooser covered while its space is hovered`);
          }
        }
      }

      await page.close();
    }

    // why: WP-852 — Effect Intensity off flattens the board. Its own fresh page
    // (a new browser context), with the preference stored before the app loads.
    const offPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await offPage.addInitScript(() => {
      localStorage.setItem('arenaClientEffectIntensity', 'off');
    });
    await loadBoard(offPage, baseUrl, 30_000);
    await offPage.waitForTimeout(700);
    const offM22 = await offPage.evaluate(readPlaneM22);
    console.log('  1280x720 off:', JSON.stringify({ planeM22: offM22 }));
    if (offM22 === null || offM22 < 0.999) {
      failures.push('1280x720 off: board still tilted at Effect Intensity off');
    }
    await offPage.close();
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
