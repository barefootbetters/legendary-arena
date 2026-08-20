import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// why: this test guards the STATUS-heading parser in
// `scripts/build-governance-snapshot.mjs`, which is a plain `.mjs` run by
// `node` (never tsx) and executes `main()` at import time. Importing it here
// would run the generator as a side effect and trip `vue-tsc`. Instead the
// test reads the generator source as text, extracts the canonical STATUS_*
// pattern literals, and reconstructs them — so the assertions run against the
// SAME regexes the generator ships, not copies that could silently drift.
//
// Companion to workIndexRowPattern.test.ts. The STATUS parser was widened after
// its original rigid `### WP-NNN / EC-NNN Executed — Title (date)` regex
// silently dropped every entry authored after 2026-07-17 (WP-387), freezing the
// Recent STATUS Entries widget. This test pins the widened parser against the
// real STATUS.md corpus so the drift cannot recur unnoticed.
const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = resolve(TEST_FILE_DIR, '..', '..');
const REPO_ROOT = resolve(DASHBOARD_DIR, '..', '..');
const GENERATOR_PATH = resolve(DASHBOARD_DIR, 'scripts/build-governance-snapshot.mjs');
const STATUS_PATH = resolve(REPO_ROOT, 'docs/ai/STATUS.md');

/**
 * Strip a leading UTF-8 byte-order mark (U+FEFF) if present, mirroring the
 * generator's own `stripBom`.
 */
function stripLeadingBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Extract one `const NAME = /BODY/FLAGS;` regex literal from the generator
 * source and rebuild it as a live RegExp. Throws a full-sentence error if the
 * declaration cannot be found, so a rename fails loudly here rather than
 * silently skipping the drift assertions.
 */
function loadCanonicalPattern(constantName: string): RegExp {
  const source = readFileSync(GENERATOR_PATH, 'utf-8');
  const declarationMatch = source.match(
    new RegExp(`^const ${constantName} = /(.*)/([a-z]*);\\s*$`, 'm'),
  );
  if (declarationMatch === null || declarationMatch[1] === undefined) {
    throw new Error(
      `Could not find the ${constantName} declaration in ${GENERATOR_PATH}; if the constant was renamed or reformatted, update statusHeadingPattern.test.ts to match.`,
    );
  }
  return new RegExp(declarationMatch[1], declarationMatch[2] ?? '');
}

const loosePattern = loadCanonicalPattern('STATUS_HEADING_LOOSE_PATTERN');
const datePattern = loadCanonicalPattern('STATUS_DATE_PATTERN');
const ecPattern = loadCanonicalPattern('STATUS_EC_PATTERN');

/**
 * Reconstruct `deriveStatusTitle` from the generator's four title-strip
 * patterns so the test derives titles exactly as the generator does.
 */
const titleLeadingPattern = loadCanonicalPattern('STATUS_TITLE_LEADING_PATTERN');
const titleDateTailPattern = loadCanonicalPattern('STATUS_TITLE_DATE_TAIL_PATTERN');
const titleStatusWordPattern = loadCanonicalPattern('STATUS_TITLE_STATUS_WORD_PATTERN');
const titleMetaParenPattern = loadCanonicalPattern('STATUS_TITLE_META_PAREN_PATTERN');

function deriveTitle(headingText: string): string {
  let title = headingText.replace(/^### /, '');
  title = title.replace(titleLeadingPattern, '');
  title = title.replace(titleDateTailPattern, '');
  title = title.replace(titleStatusWordPattern, '');
  title = title.replace(titleMetaParenPattern, '');
  title = title.replace(titleStatusWordPattern, '');
  return title.trim();
}

interface HeadingCase {
  readonly description: string;
  readonly line: string;
  readonly wpNumber: string;
  readonly ecNumber: string;
  readonly date: string;
  readonly title: string;
}

// One case per real post-drift heading shape observed in STATUS.md, plus the
// original pre-drift form. Every one must parse to the expected fields.
const MATCHING_CASES: readonly HeadingCase[] = [
  {
    description: 'original form (`/ EC-NNN Executed — Title (date)`)',
    line: '### WP-387 / EC-416 Executed — Scenario preview deep-link carries player count (leaderboard → loadout builder) (2026-07-17)',
    wpNumber: '387',
    ecNumber: '416',
    date: '2026-07-17',
    title: 'Scenario preview deep-link carries player count (leaderboard → loadout builder)',
  },
  {
    description: 'drop-Executed form (`/ EC-NNN — Title (D-NNNNN Active) (date)`)',
    line: '### WP-388 / EC-418 — co2e mastermind strike texts: Doom, Loki, Magneto, Doctor Octopus (D-24192 Active) (2026-07-18)',
    wpNumber: '388',
    ecNumber: '418',
    date: '2026-07-18',
    title: 'co2e mastermind strike texts: Doom, Loki, Magneto, Doctor Octopus',
  },
  {
    description: 'EC-in-title-paren + `shipped (date)` form',
    line: '### WP-422 — Seed PAR Publication: competitive surface turned ON (EC-457 / D-24242) shipped (2026-08-19)',
    wpNumber: '422',
    ecNumber: '457',
    date: '2026-08-19',
    title: 'Seed PAR Publication: competitive surface turned ON',
  },
  {
    description: 'em-dash `— DONE (date)` form, no EC',
    line: '### WP-559 — Hero Ledger `subsystem` Covered Status — DONE (2026-08-16)',
    wpNumber: '559',
    ecNumber: '',
    date: '2026-08-16',
    title: 'Hero Ledger `subsystem` Covered Status',
  },
  {
    description: 'hyphen `- DONE (date)` form with internal hyphens, no EC',
    line: '### WP-568 - Wait-and-See Conditional Semantics - DONE (2026-08-17)',
    wpNumber: '568',
    ecNumber: '',
    date: '2026-08-17',
    title: 'Wait-and-See Conditional Semantics',
  },
  {
    description: 'bare-date `— DONE date · tail` form (two dates, first wins), no EC',
    line: '### WP-560 — Adaptive Danger-Meter Music Channel — DONE 2026-08-16 · ✅ D-24026 CONFIRMED LIVE 2026-08-17',
    wpNumber: '560',
    ecNumber: '',
    date: '2026-08-16',
    title: 'Adaptive Danger-Meter Music Channel',
  },
  {
    description: 'meaningful in-title code parenthetical is preserved',
    line: '### WP-544 — Core Maestro Counted Self-KO (`ko-heroes-current-count-by-trait`) — DONE (2026-08-14)',
    wpNumber: '544',
    ecNumber: '',
    date: '2026-08-14',
    title: 'Core Maestro Counted Self-KO (`ko-heroes-current-count-by-trait`)',
  },
];

test('widened STATUS parser extracts wp/ec/date/title for every heading shape', () => {
  for (const headingCase of MATCHING_CASES) {
    const looseMatch = loosePattern.exec(headingCase.line);
    assert.ok(looseMatch !== null, `loose detector should match ${headingCase.description}`);
    assert.equal(looseMatch[1], headingCase.wpNumber, `wpNumber for ${headingCase.description}`);

    const dateMatch = datePattern.exec(headingCase.line);
    assert.ok(dateMatch !== null, `date should be found for ${headingCase.description}`);
    assert.equal(dateMatch[0], headingCase.date, `date for ${headingCase.description}`);

    const ecMatch = ecPattern.exec(headingCase.line);
    const ecNumber = ecMatch === null ? '' : ecMatch[1];
    assert.equal(ecNumber, headingCase.ecNumber, `ecNumber for ${headingCase.description}`);

    assert.equal(
      deriveTitle(headingCase.line),
      headingCase.title,
      `title for ${headingCase.description}`,
    );
  }
});

test('loose detector ignores non-WP and date-less headings', () => {
  const nonEntries = [
    '### D-24026 live-verify - WP-566 / WP-567 / WP-568 VERIFIED (2026-08-18)',
    '### Per-Scheme Gauntlet Variety Arc — COMPLETE (WP-471..475 + WP-483) (2026-08-01)',
    '### INFRA fix — "Edit this loadout" promotes the URL preview (D-24190 Active) (2026-07-17)',
    '### Phase 3 Exit Gate Closed (2026-04-11)',
  ];
  for (const line of nonEntries) {
    assert.equal(loosePattern.exec(line), null, `expected no loose match for: ${line}`);
  }
});

test('drift guard: every recent STATUS WP heading parses under the widened parser', () => {
  const content = stripLeadingBom(readFileSync(STATUS_PATH, 'utf-8'));
  const lines = content.split(/\r?\n/);

  const wpHeadings: string[] = [];
  const datelessOrUnparsed: string[] = [];
  let latestParsedDate = '';

  for (const line of lines) {
    const looseMatch = loosePattern.exec(line);
    if (looseMatch === null) {
      continue;
    }
    wpHeadings.push(line);
    const dateMatch = datePattern.exec(line);
    if (dateMatch === null) {
      // A `### WP-NNN` heading with no date is intentionally skipped by the
      // generator; record it so a regression that strips dates surfaces here.
      datelessOrUnparsed.push(line.slice(0, 100));
      continue;
    }
    if (dateMatch[0] > latestParsedDate) {
      latestParsedDate = dateMatch[0];
    }
  }

  assert.ok(
    wpHeadings.length > 200,
    `expected the real STATUS.md to hold >200 WP headings; found ${wpHeadings.length}`,
  );
  assert.deepEqual(
    datelessOrUnparsed,
    [],
    `every "### WP-NNN" STATUS heading must carry a parseable date, but ${datelessOrUnparsed.length} did not. First offenders: ${datelessOrUnparsed.slice(0, 5).join(' | ')}`,
  );
  // The whole point of the widening: recent entries (well past the pre-drift
  // WP-387 / 2026-07-17 freeze) must now parse. Assert the corpus reaches into
  // August 2026 so a re-narrowed regex that re-freezes the feed fails here.
  assert.ok(
    latestParsedDate >= '2026-08-01',
    `expected the parsed STATUS corpus to include entries from 2026-08 or later, but the newest parsed date was ${latestParsedDate} — the STATUS feed has re-frozen.`,
  );
});
