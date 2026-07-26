import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flushPromises, mount } from '@vue/test-utils';
import GameLogPanel from './GameLogPanel.vue';
import { buildGameLogText } from './gameLogExport';

test('GameLogPanel renders the role="status" empty-state region when log is []', () => {
  const wrapper = mount(GameLogPanel, { props: { log: [] } });

  const empty = wrapper.find('[role="status"]');
  assert.equal(empty.exists(), true);
  assert.equal(empty.text(), 'Game log is empty.');
  assert.equal(wrapper.find('[data-testid="game-log-line"]').exists(), false);
  wrapper.unmount();
});

test('GameLogPanel renders one <li> per entry in source order with stable data-index', () => {
  const log = [
    { text: 'first entry', outcome: 'neutral' as const },
    { text: 'second entry', outcome: 'neutral' as const },
    { text: 'third entry', outcome: 'neutral' as const },
  ];

  const wrapper = mount(GameLogPanel, { props: { log } });

  const lines = wrapper.findAll('[data-testid="game-log-line"]');
  assert.equal(lines.length, 3);
  assert.equal(lines[0]?.text(), 'first entry');
  assert.equal(lines[1]?.text(), 'second entry');
  assert.equal(lines[2]?.text(), 'third entry');
  assert.equal(lines[0]?.attributes('data-index'), '0');
  assert.equal(lines[1]?.attributes('data-index'), '1');
  assert.equal(lines[2]?.attributes('data-index'), '2');
  wrapper.unmount();
});

test('GameLogPanel list element carries aria-live="polite"', () => {
  const wrapper = mount(GameLogPanel, {
    props: { log: [{ text: 'only entry', outcome: 'neutral' }] },
  });

  const list = wrapper.find('ol');
  assert.equal(list.exists(), true);
  assert.equal(list.attributes('aria-live'), 'polite');
  wrapper.unmount();
});

test('GameLogPanel does not mutate the supplied log array through render', () => {
  const log = [
    { text: 'alpha', outcome: 'neutral' as const },
    { text: 'bravo', outcome: 'neutral' as const },
    { text: 'charlie', outcome: 'neutral' as const },
  ];
  const before = JSON.stringify(log);

  mount(GameLogPanel, { props: { log } });

  assert.strictEqual(JSON.stringify(log), before);
  assert.equal(log.length, 3);
});

test('GameLogPanel renders a Copy / Save / Expand toolbar with typed, labelled buttons', () => {
  const wrapper = mount(GameLogPanel, { props: { log: [{ text: 'a', outcome: 'neutral' }] } });

  const copy = wrapper.find('[data-testid="game-log-copy"]');
  const save = wrapper.find('[data-testid="game-log-save"]');
  const expand = wrapper.find('[data-testid="game-log-expand"]');
  assert.equal(copy.exists(), true);
  assert.equal(save.exists(), true);
  assert.equal(expand.exists(), true);
  assert.equal(copy.attributes('type'), 'button');
  assert.equal(save.attributes('type'), 'button');
  assert.equal(expand.attributes('type'), 'button');
  assert.equal(copy.attributes('aria-label'), 'Copy game log to clipboard');
  assert.equal(save.attributes('aria-label'), 'Save game log to a file');
  assert.equal(expand.attributes('aria-label'), 'Expand game log to full screen');
  wrapper.unmount();
});

test('GameLogPanel does not render the expand overlay until Expand is clicked', () => {
  const wrapper = mount(GameLogPanel, { props: { log: [{ text: 'a', outcome: 'neutral' }] } });

  // why: the <Teleport> node itself is v-if-gated — closed means no dialog
  // anywhere under document.body.
  assert.equal(
    document.body.querySelector('[data-testid="game-log-modal"]'),
    null,
  );
  wrapper.unmount();
});

test('clicking Expand mounts a role="dialog" overlay under document.body with the same entries', async () => {
  const log = [
    { text: 'first', outcome: 'neutral' as const },
    { text: 'second', outcome: 'neutral' as const },
    { text: 'third', outcome: 'neutral' as const },
  ];
  const wrapper = mount(GameLogPanel, { props: { log } });

  await wrapper.find('[data-testid="game-log-expand"]').trigger('click');

  const modal = document.body.querySelector('[data-testid="game-log-modal"]');
  assert.notEqual(modal, null);
  assert.equal(modal?.getAttribute('role'), 'dialog');
  assert.equal(modal?.getAttribute('aria-modal'), 'true');
  // why: AC #2 — the teleported overlay lives under document.body, NOT inside
  // the mount container.
  assert.equal(
    wrapper.element.querySelector('[data-testid="game-log-modal"]'),
    null,
  );
  const items = document.body.querySelectorAll(
    '[data-testid="game-log-modal-viewport"] li',
  );
  assert.equal(items.length, 3);
  assert.equal(items[0]?.textContent?.trim(), 'first');
  assert.equal(items[2]?.textContent?.trim(), 'third');
  wrapper.unmount();
});

test('clicking Collapse closes the expand overlay', async () => {
  const wrapper = mount(GameLogPanel, { props: { log: [{ text: 'a', outcome: 'neutral' }] } });
  await wrapper.find('[data-testid="game-log-expand"]').trigger('click');
  assert.notEqual(
    document.body.querySelector('[data-testid="game-log-modal"]'),
    null,
  );

  const collapse = document.body.querySelector('[data-testid="game-log-collapse"]');
  (collapse as HTMLElement).click();
  await flushPromises();

  assert.equal(
    document.body.querySelector('[data-testid="game-log-modal"]'),
    null,
  );
  wrapper.unmount();
});

test('Escape keydown closes the expand overlay; backdrop click closes it too', async () => {
  const wrapper = mount(GameLogPanel, { props: { log: [{ text: 'a', outcome: 'neutral' }] } });

  await wrapper.find('[data-testid="game-log-expand"]').trigger('click');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  await flushPromises();
  assert.equal(
    document.body.querySelector('[data-testid="game-log-modal"]'),
    null,
    'Escape should collapse the overlay',
  );

  await wrapper.find('[data-testid="game-log-expand"]').trigger('click');
  const backdrop = document.body.querySelector('[data-testid="game-log-modal"]');
  (backdrop as HTMLElement).click();
  await flushPromises();
  assert.equal(
    document.body.querySelector('[data-testid="game-log-modal"]'),
    null,
    'backdrop click should collapse the overlay',
  );
  wrapper.unmount();
});

test('clicking Copy writes the built log transcript to the clipboard', async () => {
  const log = [
    { text: 'first', outcome: 'neutral' as const },
    { text: 'second', outcome: 'neutral' as const },
  ];
  let capturedText: string | null = null;
  // why: jsdom's navigator has no Clipboard API — install a configurable stub
  // that captures the written text, then remove it so it does not leak to other
  // tests. The component guards on `writeText` being a function, so this drives
  // the real copy path.
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: (text: string): Promise<void> => {
        capturedText = text;
        return Promise.resolve();
      },
    },
    configurable: true,
  });
  try {
    const wrapper = mount(GameLogPanel, { props: { log } });
    await wrapper.find('[data-testid="game-log-copy"]').trigger('click');
    await flushPromises();
    assert.equal(capturedText, buildGameLogText(log));
    assert.equal(capturedText, 'first\nsecond\n');
    wrapper.unmount();
  } finally {
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard');
  }
});

// why: WP-435 — each non-neutral line carries its outcome colour CLASS + a decorative
// aria-hidden glyph + an sr-only outcome word (colour is never the only signal);
// neutral lines stay unstyled with no glyph/label.
const OUTCOME_LOG = [
  { text: 'played Nightcrawler.', outcome: 'neutral' as const },
  { text: 'drew 1 card(s) from Quick Draw.', outcome: 'applied' as const },
  { text: 'drew 1 of 2 card(s).', outcome: 'partial' as const },
  { text: 'ability did not activate.', outcome: 'blocked' as const },
];
const OUTCOME_EXPECT = {
  neutral: { cls: null, glyph: null, label: null },
  applied: { cls: 'game-log__line--applied', glyph: '✓', label: 'applied:' },
  partial: { cls: 'game-log__line--partial', glyph: '⚠', label: 'partial:' },
  blocked: { cls: 'game-log__line--blocked', glyph: '✕', label: 'blocked:' },
} as const;

test('GameLogPanel colours each compact line by outcome (class + aria-hidden glyph + sr-only word); neutral is unstyled', () => {
  const wrapper = mount(GameLogPanel, { props: { log: OUTCOME_LOG } });
  const lines = wrapper.findAll('[data-testid="game-log-line"]');
  assert.equal(lines.length, 4);
  OUTCOME_LOG.forEach((entry, i) => {
    const expect = OUTCOME_EXPECT[entry.outcome];
    const line = lines[i]!;
    const glyph = line.find('.game-log__glyph');
    const srOnly = line.find('.sr-only');
    if (expect.cls === null) {
      // neutral: no outcome class, no glyph, no sr-only label
      assert.equal(line.classes().some((c) => c.startsWith('game-log__line--')), false);
      assert.equal(glyph.exists(), false);
      assert.equal(srOnly.exists(), false);
    } else {
      assert.ok(line.classes().includes(expect.cls), `line ${i} missing class ${expect.cls}`);
      assert.equal(glyph.exists(), true);
      assert.equal(glyph.text(), expect.glyph);
      assert.equal(glyph.attributes('aria-hidden'), 'true');
      assert.equal(srOnly.exists(), true);
      assert.equal(srOnly.text(), expect.label);
    }
    // the printed text is always present regardless of outcome
    assert.ok(line.text().includes(entry.text));
  });
  wrapper.unmount();
});

test('GameLogPanel colours the modal (expanded) lines identically to the compact lines', async () => {
  const wrapper = mount(GameLogPanel, { props: { log: OUTCOME_LOG } });
  await wrapper.find('[data-testid="game-log-expand"]').trigger('click');
  await flushPromises();
  const modalLines = document.body.querySelectorAll('[data-testid="game-log-modal-line"]');
  assert.equal(modalLines.length, 4);
  OUTCOME_LOG.forEach((entry, i) => {
    const expect = OUTCOME_EXPECT[entry.outcome];
    const line = modalLines[i] as HTMLElement;
    const glyph = line.querySelector('.game-log__glyph');
    const srOnly = line.querySelector('.sr-only');
    if (expect.cls === null) {
      assert.equal(line.className.includes('game-log__line--'), false);
      assert.equal(glyph, null);
      assert.equal(srOnly, null);
    } else {
      assert.ok(line.className.includes(expect.cls));
      assert.equal(glyph?.textContent, expect.glyph);
      assert.equal(glyph?.getAttribute('aria-hidden'), 'true');
      assert.equal(srOnly?.textContent?.trim(), expect.label);
    }
  });
  wrapper.unmount();
});
