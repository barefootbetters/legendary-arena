// PAR calibration support: extract exact scoring-input anchors from saved match
// diagnostics exports (uiStateSnapshot.gameOver + progress). Reads a directory of
// *DIAGNOSTIC*.json files and prints one row per FINISHED game — the real-play
// anchors that ground the interim PAR recalibration (WP scoping, 2026-08-23).
//
// Usage: node scripts/extract-par-anchors.mjs <matches-dir>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Shipped scoring weights (centesimal), from parScoring — kept in sync manually
// for this analysis tool (it never writes artifacts, only reports).
const W = { villainEscaped: 100, bystanderLost: 400, schemeTwist: 300, bystanderReward: 200, vpReward: 10 };
const SEED_PAR = -1150; // the Red Skull / Midtown / Hydra+Masters 2p seed PAR, for contrast

const dir = process.argv[2] ?? 'C:/pcloud/matches';

function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
  );
}

const files = walk(dir).filter((f) => /diagnostic/i.test(f) && /\.json$/i.test(f));

const rows = [];
for (const file of files) {
  let d;
  try { d = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
  const u = d.uiStateSnapshot;
  if (!u) continue;
  const gameOver = u.gameOver;
  const setup = d.matchSetup ?? {};
  const scheme = (setup.schemeId ?? '?').replace(/^core\//, '');
  const mastermind = (setup.mastermindId ?? '?').replace(/^core\//, '');
  const players = Array.isArray(setup.heroDeckIds)
    ? (u.players?.length ?? '?')
    : (u.players?.length ?? '?');
  const finished = !!gameOver;
  const won = gameOver?.outcome === 'heroes-win';
  const bystanders = u.progress?.bystandersRescued ?? 0;
  const escapes = u.progress?.escapedVillains ?? 0;
  const vp = finished
    ? gameOver.scores.players.reduce((s, p) => s + p.totalVP, 0)
    : (u.players?.reduce((s, p) => s + (p.victoryVP ?? 0), 0) ?? 0);
  const twists = (JSON.stringify(u.log ?? []).match(/twist count incremented/gi) ?? []).length;
  // bystandersLost: best-effort from the escaped-pile scheme-loss signal.
  const bystandersLost = u.progress?.schemeLossKind === 'escaped-pile'
    ? (u.progress?.schemeLossProgress ?? 0)
    : 0;

  const penalties = escapes * W.villainEscaped + bystandersLost * W.bystanderLost + twists * W.schemeTwist;
  const rawScore = penalties - bystanders * W.bystanderReward - vp * W.vpReward;
  const finalVsSeed = rawScore - SEED_PAR;

  rows.push({ file: file.split(/[\\/]/).pop(), scheme, mastermind, players, finished, won, bystanders, vp, escapes, twists, bystandersLost, rawScore, finalVsSeed });
}

// Print grouped by scheme.
rows.sort((a, b) => a.scheme.localeCompare(b.scheme) || a.players - b.players);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('scheme', 26), pad('mm', 11), pad('P', 2), pad('win', 4), pad('bys', 4), pad('VP', 5), pad('esc', 4), pad('tw', 3), pad('bLost', 6), pad('raw', 7), 'finalVsSeedPAR');
for (const r of rows) {
  if (!r.finished) { console.log(pad(r.scheme, 26), pad(r.mastermind, 11), pad(r.players, 2), '-- UNFINISHED SNAPSHOT --', r.file); continue; }
  console.log(
    pad(r.scheme, 26), pad(r.mastermind, 11), pad(r.players, 2), pad(r.won ? 'W' : 'L', 4),
    pad(r.bystanders, 4), pad(r.vp, 5), pad(r.escapes, 4), pad(r.twists, 3), pad(r.bystandersLost, 6),
    pad(r.rawScore, 7), r.finalVsSeed,
  );
}
console.log(`\n${rows.filter((r) => r.finished).length} finished games from ${files.length} diagnostics files.`);
console.log('finalVsSeedPAR = rawScore - (-1150 seed PAR). Deeply negative => seed PAR far too easy.');
