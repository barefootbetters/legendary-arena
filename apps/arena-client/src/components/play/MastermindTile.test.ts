import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import MastermindTile from './MastermindTile.vue';
import EnigmaGuessPicker from './EnigmaGuessPicker.vue';
import AssassinShuffleChooser from './AssassinShuffleChooser.vue';
import type {
  UIFortifier,
  UIMastermindState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import { KILLMONGER_ATTACK_LOCK_REASON } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

interface RecordedCall {
  name: UiMoveName;
  args: unknown;
}

function recorder(): { calls: RecordedCall[]; submitMove: SubmitMove } {
  const calls: RecordedCall[] = [];
  const submitMove: SubmitMove = (name, args) => {
    calls.push({ name, args });
  };
  return { calls, submitMove };
}

function mastermindLive(over: Partial<UIMastermindState> = {}): UIMastermindState {
  return {
    id: 'doctor-doom',
    tacticsRemaining: 4,
    tacticsDefeated: 0,
    display: {
      extId: 'mastermind-doom',
      name: 'Doctor Doom',
      imageUrl: 'https://images.legendary-arena.com/doom.png',
      cost: 6,
    },
    attachedBystanders: [],
    strikePile: [],
    hypnoThralls: [],
    ...over,
  };
}

function economy(over: Partial<UITurnEconomyState> = {}): UITurnEconomyState {
  return {
    attack: 0,
    recruit: 0,
    availableAttack: 0,
    availableRecruit: 0,
    piercing: 0,
    woundsDrawn: 0,
    ...over,
  };
}

describe('MastermindTile (WP-129 — extends WP-100)', () => {
  test('click emits fightMastermind with empty payload at play.main when affordable', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ attack: 6, availableAttack: 6 }),
        submitMove,
      },
    });
    void wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'fightMastermind');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('disabled with stage tooltip when currentStage is not main', () => {
    const { submitMove } = recorder();
    for (const stage of ['start', 'cleanup'] as const) {
      const wrapper = mount(MastermindTile, {
        props: {
          mastermind: mastermindLive(),
          currentStage: stage,
          economy: economy({ availableAttack: 9 }),
          submitMove,
        },
      });
      const button = wrapper.find('[data-testid="play-mastermind-button"]');
      assert.equal(button.attributes('disabled'), '');
      assert.match(button.attributes('title')!, /Only available during the Main/);
    }
  });

  test('disabled with cost tooltip when economy short of mastermind.display.cost', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ attack: 4, availableAttack: 4 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /Needs 6 attack, you have 4\./);
  });

  test('disabled with structural tooltip when tacticsRemaining is zero (precedence: stage+cost met)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ tacticsRemaining: 0, tacticsDefeated: 4 }),
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /All tactics defeated/);
  });

  test('WP-687 Final Blow: 0 tactics + finalBlowPending enables the fight + shows the affordance', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        // all tactics defeated, but the optional Final Blow rule keeps the
        // Mastermind fightable a 5th, final time (affordable)
        mastermind: mastermindLive({ tacticsRemaining: 0, tacticsDefeated: 4, finalBlowPending: true }),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), undefined, 'the final blow inverts the 0-tactics lock — fight enabled');
    assert.ok(
      wrapper.find('[data-testid="play-mastermind-final-blow"]').exists(),
      'the Final Blow affordance shows',
    );
  });

  test('WP-687 Final Blow: the cost gate still blocks an under-resourced final fight (precedence preserved)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ tacticsRemaining: 0, tacticsDefeated: 4, finalBlowPending: true }),
        currentStage: 'main',
        economy: economy({ attack: 0, availableAttack: 0 }), // short of cost 6
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '', 'an under-resourced final fight stays disabled (cost precedence)');
  });

  test('WP-687 Final Blow: finalBlowPending false keeps the existing "already fallen" lock', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ tacticsRemaining: 0, tacticsDefeated: 4, finalBlowPending: false }),
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /All tactics defeated/);
    assert.equal(
      wrapper.find('[data-testid="play-mastermind-final-blow"]').exists(),
      false,
      'no final-blow affordance when the rule is off',
    );
  });

  test('vanquished Mastermind (all tactics defeated, no Final Blow) shows the victory-assured banner', () => {
    // why: Jeff feedback (Dr. Doom / Legacy Virus 2p, turn 26) — a disabled Fight
    // button + tooltip read as "can't attack"; WP-732 / D-24553 lets the player
    // finish the turn, so the tile must say so plainly.
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ tacticsRemaining: 0, tacticsDefeated: 4 }),
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    const banner = wrapper.find('[data-testid="play-mastermind-vanquished"]');
    assert.equal(banner.exists(), true, 'the victory-assured banner renders');
    assert.match(banner.text(), /Mastermind defeated/);
    assert.match(banner.text(), /End Turn to win/);
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.match(button.attributes('title')!, /victory is assured/);
  });

  test('victory-assured banner is absent while tactics remain, under a pending Final Blow, and once the game is over', () => {
    const { submitMove } = recorder();
    const cases: Array<{ label: string; mastermind: UIMastermindState; isGameOver: boolean }> = [
      { label: 'tactics remain', mastermind: mastermindLive({ tacticsRemaining: 1, tacticsDefeated: 3 }), isGameOver: false },
      {
        label: 'Final Blow pending',
        mastermind: mastermindLive({ tacticsRemaining: 0, tacticsDefeated: 4, finalBlowPending: true }),
        isGameOver: false,
      },
      { label: 'game over', mastermind: mastermindLive({ tacticsRemaining: 0, tacticsDefeated: 4 }), isGameOver: true },
    ];
    for (const testCase of cases) {
      const wrapper = mount(MastermindTile, {
        props: {
          mastermind: testCase.mastermind,
          currentStage: 'main',
          economy: economy({ availableAttack: 9 }),
          submitMove,
          isGameOver: testCase.isGameOver,
        },
      });
      assert.equal(
        wrapper.find('[data-testid="play-mastermind-vanquished"]').exists(),
        false,
        `no victory-assured banner when ${testCase.label}`,
      );
    }
  });

  test('renders display name + cost + tactics remaining', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    const tile = wrapper.find('[data-testid="card-tile"]');
    assert.equal(tile.exists(), true);
    assert.equal(tile.attributes('title'), 'Doctor Doom');
    const costBadge = wrapper.find('[data-testid="card-tile-cost-badge"]');
    assert.equal(costBadge.exists(), true);
    assert.equal(costBadge.text(), '6');
    const tactics = wrapper.find('[data-testid="play-mastermind-tactics-remaining"]');
    assert.match(tactics.text(), /Tactics remaining: 4/);
  });

  test('renders NO bystanders section when attachedBystanders is empty (SAFE-SKIP-WP128)', () => {
    // why: the always-on "None captured." line was board noise; the section
    // now renders only when the mastermind actually has captured bystanders.
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    assert.equal(
      wrapper.find('[data-testid="play-mastermind-bystanders"]').exists(),
      false,
    );
  });

  test('Read card button emits read with the mastermind display and gameText', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({
          gameText: ['Master Strike: each player reveals the top card of their deck.'],
        }),
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    void wrapper.find('[data-testid="play-mastermind-read"]').trigger('click');
    const emitted = wrapper.emitted('read');
    assert.ok(emitted, 'expected a read event');
    assert.equal(emitted!.length, 1);
    const payload = emitted![0]![0] as {
      title: string;
      display: { name: string };
      gameText: readonly string[];
    };
    assert.equal(payload.title, 'Doctor Doom');
    assert.equal(payload.display.name, 'Doctor Doom');
    assert.equal(payload.gameText.length, 1);
    assert.match(payload.gameText[0]!, /Master Strike/);
  });

  test('renders attachedBystanders as a count-only badge (WP-505)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({
          attachedBystanders: [
            {
              extId: 'bystander-1',
              display: {
                extId: 'bystander-1',
                name: 'Civilian Alpha',
                imageUrl: 'https://images.legendary-arena.com/bystander-1.png',
                cost: null,
              },
            },
            {
              extId: 'bystander-2',
              display: {
                extId: 'bystander-2',
                name: 'Civilian Beta',
                imageUrl: 'https://images.legendary-arena.com/bystander-2.png',
                cost: null,
              },
            },
          ],
        }),
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    const badge = wrapper.find('[data-testid="play-mastermind-bystanders"]');
    assert.equal(badge.exists(), true);
    // why (Jeff feedback): the badge is now a compact icon + count (no "N captured"
    // text) — assert the count shows and the full phrase lives on the aria-label.
    assert.match(badge.text(), /2/);
    assert.equal(badge.attributes('aria-label'), '2 bystanders captured');
    // why: WP-505 — face-down bystanders are count-only; the captured
    // identities must NOT leak to the board, and the old <li> list is gone.
    assert.equal(badge.text().includes('Civilian'), false);
    assert.equal(
      wrapper.find('[data-testid="play-mastermind-bystanders-list"]').exists(),
      false,
    );
  });

  test('renders NO Hypno-Thralls group when the zone is empty (WP-399 AC-2)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ hypnoThralls: [] }),
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    // why: AC-2 — an empty zone renders nothing, matching the bystander
    // non-empty guard (no always-on empty group as board noise).
    assert.equal(
      wrapper.find('[data-testid="play-mastermind-hypno-thralls"]').exists(),
      false,
    );
  });

  test('renders Hypno-Thralls face-up by name/image, in append order (WP-399 AC-4)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({
          hypnoThralls: [
            {
              extId: 'co2e/wolverine/strike#0',
              display: {
                extId: 'co2e/wolverine/strike#0',
                name: 'Wolverine',
                imageUrl: 'https://images.legendary-arena.com/co2e-wolverine.png',
                cost: 3,
              },
            },
            {
              extId: 'co2e/storm/strike#0',
              display: {
                extId: 'co2e/storm/strike#0',
                name: 'Storm',
                imageUrl: 'https://images.legendary-arena.com/co2e-storm.png',
                cost: 5,
              },
            },
          ],
        }),
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    const group = wrapper.find('[data-testid="play-mastermind-hypno-thralls"]');
    assert.equal(group.exists(), true, 'the group renders when the zone is non-empty');
    const items = wrapper.findAll('[data-testid="play-mastermind-hypno-thrall"]');
    assert.equal(items.length, 2, 'one item per stacked Thrall');
    // why: AC-4 — Thralls are face-up Heroes, so their names ARE shown (unlike
    // the count-only face-down bystander badge). Append order preserved.
    assert.match(group.text(), /Wolverine/);
    assert.match(group.text(), /Storm/);
    assert.ok(
      group.text().indexOf('Wolverine') < group.text().indexOf('Storm'),
      'Thralls render in engine append order, not sorted',
    );
  });
});

describe('MastermindTile — Dark Portal marker (WP-727 / D-24548)', () => {
  test('renders the Dark Portal marker with +N attack when darkPortalBonus > 0', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy(),
        darkPortalBonus: 1,
        submitMove,
      },
    });
    const marker = wrapper.find('[data-testid="dark-portal-marker"]');
    assert.ok(marker.exists(), 'the marker renders when a Dark Portal is above the Mastermind');
    assert.match(marker.text(), /\+1/, 'shows the served +N attack');
  });

  test('hides the Dark Portal marker when darkPortalBonus is 0 (no portal / non-Portals scheme)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy(),
        submitMove,
      },
    });
    assert.equal(
      wrapper.find('[data-testid="dark-portal-marker"]').exists(),
      false,
      'no marker without a portal',
    );
  });
});

describe('MastermindTile — Excessive Violence affordance (WP-738 / D-24561)', () => {
  // why: the "Fight using Excessive Violence" opt-in is shown only when the fight
  // is allowed AND the availability cue is set AND the player can afford cost+1
  // (mastermind cost 6 → needs 7). It submits the useExcessiveViolence intent; the
  // normal Fight button is unchanged.
  test('no Excessive Violence button when the availability cue is absent', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-ev"]').exists(), false);
  });

  test('shows the Excessive Violence button when available and affordable at cost+1', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ attack: 7, availableAttack: 7, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-ev"]').exists(), true);
  });

  test('the Excessive Violence button renders the crossed-swords SVG icon (not a bare glyph)', () => {
    // why: graphic fix-forward 2026-09-22 — the button previously used a bare U+2694
    // codepoint the play-surface font does not carry, so it silently collapsed to
    // text and operators missed it. Lock the inline SVG in so it cannot regress.
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ attack: 7, availableAttack: 7, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    const evButton = wrapper.find('[data-testid="play-mastermind-ev"]');
    assert.equal(evButton.find('svg.crossed-swords-icon').exists(), true);
    assert.match(evButton.text(), /\+1/);
  });

  test('hides the Excessive Violence button when available but short of cost+1', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        // why: exactly the normal fight cost (6) — enough to fight, one short of the +1.
        economy: economy({ attack: 6, availableAttack: 6, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-ev"]').exists(), false);
  });

  test('clicking the Excessive Violence button submits fightMastermind with useExcessiveViolence', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ attack: 7, availableAttack: 7, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    void wrapper.find('[data-testid="play-mastermind-ev"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'fightMastermind');
    assert.deepEqual(calls[0]!.args, { useExcessiveViolence: true });
  });

  test('the normal fight button omits useExcessiveViolence even when EV is available', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ attack: 7, availableAttack: 7, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    void wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.args, {});
  });

  // why: `.mastermind-tile button` (0,1,1) makes every tile button a column flex box. A
  // single-class rule (0,1,0) on the EV or Wound button loses to it, and the icon, label and
  // "+1" pill stack vertically (the EV button rendered 141×60 px that way). jsdom computes no
  // CSS, so the selectors themselves are pinned: each button's layout rule must carry two
  // classes and lay out as a row.
  test('the EV and Wound buttons lay out as a row: their rules outrank `.mastermind-tile button`', () => {
    const source = readFileSync(new URL('./MastermindTile.vue', import.meta.url), 'utf8');
    const style = source.slice(source.indexOf('<style'));
    const rules = [...style.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
      selector: match[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim(),
      body: match[2]!,
    }));
    const columnRule = rules.find((rule) => rule.selector === '.mastermind-tile button');
    assert.ok(columnRule !== undefined && columnRule.body.includes('flex-direction: column'), 'the column rule the buttons must outrank is present');

    for (const buttonClass of ['mastermind-ev-fight', 'mastermind-wound']) {
      const buttonSelector = new RegExp(`\\.${buttonClass}(?![\\w-])`);
      const buttonRules = rules.filter((rule) => buttonSelector.test(rule.selector));
      assert.ok(buttonRules.length > 0, `${buttonClass} has style rules`);
      for (const rule of buttonRules) {
        assert.ok(rule.selector.startsWith(`.mastermind-tile .${buttonClass}`), `"${rule.selector}" must be scoped as .mastermind-tile .${buttonClass} to outrank .mastermind-tile button`);
      }
      const layoutRule = buttonRules.find((rule) => rule.selector === `.mastermind-tile .${buttonClass}`);
      assert.ok(layoutRule !== undefined && layoutRule.body.includes('flex-direction: row'), `.mastermind-tile .${buttonClass} lays out as a row`);
      assert.ok(layoutRule.body.includes('align-items: center'), `.mastermind-tile .${buttonClass} centers its row`);
    }
  });
});

// ---------------------------------------------------------------------------
// WP-750 / D-24574 — the Mastermind Fight gate reads the engine's projected
// fightCost (falling back to display.cost only when absent), and a Fight N badge
// shows the projected cost on mismatch — never from the fallback.
// ---------------------------------------------------------------------------

describe('MastermindTile — projected fight cost (WP-750 / D-24574)', () => {
  function mountWithCost(over: Partial<UIMastermindState>, availableAttack: number, isEvAvailable = false) {
    const { calls, submitMove } = recorder();
    const evField = isEvAvailable ? { excessiveViolenceAvailable: true } : {};
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(over),
        currentStage: 'main',
        economy: economy({ attack: availableAttack, availableAttack, ...evField }),
        submitMove,
      },
    });
    return { calls, wrapper };
  }

  test('fightCost printed + 1 at printed attack: Fight disabled, EV hidden, badge shown', () => {
    // why: a Portals Dark Portal on the Mastermind — printed 6, the engine charges 7.
    const { wrapper } = mountWithCost({ fightCost: 7 }, 6, true);
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /Needs 7 attack, you have 6\./);
    assert.equal(wrapper.find('[data-testid="play-mastermind-ev"]').exists(), false);
    const badge = button.find('[data-testid="play-mastermind-fight-cost"]');
    assert.equal(badge.exists(), true);
    assert.equal(badge.text(), 'Fight 7');
  });

  test('fightCost printed + 1 at printed + 1 attack: Fight enabled and submits', async () => {
    const { calls, wrapper } = mountWithCost({ fightCost: 7 }, 7);
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), undefined);
    await button.trigger('click');
    assert.deepEqual(calls, [{ name: 'fightMastermind', args: {} }]);
  });

  test('fightCost absent falls back to display.cost and renders no badge', () => {
    const { wrapper } = mountWithCost({}, 5);
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /Needs 6 attack, you have 5\./);
    assert.equal(wrapper.find('[data-testid="play-mastermind-fight-cost"]').exists(), false);
  });

  test('fightCost equal to the printed cost renders no badge', () => {
    const { wrapper } = mountWithCost({ fightCost: 6 }, 6);
    assert.equal(wrapper.find('[data-testid="play-mastermind-button"]').attributes('disabled'), undefined);
    assert.equal(wrapper.find('[data-testid="play-mastermind-fight-cost"]').exists(), false);
  });
});

// ---------------------------------------------------------------------------
// Jeff feedback (match 25-GJ0oXBwy) — the Mastermind Fight N badge is loud when it
// explains a disabled Fight.
// ---------------------------------------------------------------------------

describe('MastermindTile — louder unaffordable Fight N badge', () => {
  const UNAFFORDABLE = 'mastermind__fight-cost--unaffordable';

  function mountAt(availableAttack: number, currentStage = 'main') {
    const { submitMove } = recorder();
    return mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ fightCost: 7 }),
        currentStage,
        economy: economy({ attack: availableAttack, availableAttack }),
        submitMove,
      },
    });
  }

  test('loud when the projected cost is unaffordable in the Main stage', () => {
    const badge = mountAt(6).find('[data-testid="play-mastermind-fight-cost"]');
    assert.equal(badge.classes().includes(UNAFFORDABLE), true);
  });

  test('quiet when affordable, and quiet outside the Main stage', () => {
    assert.equal(
      mountAt(7).find('[data-testid="play-mastermind-fight-cost"]').classes().includes(UNAFFORDABLE),
      false,
    );
    assert.equal(
      mountAt(0, 'start').find('[data-testid="play-mastermind-fight-cost"]').classes().includes(UNAFFORDABLE),
      false,
    );
  });
});

describe('MastermindTile — heal lock (D-24180 / D-24614)', () => {
  test('after a heal the Fight is disabled with the heal-lock tooltip and a click submits nothing', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        hasHealedThisTurn: true,
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /cannot recruit or fight after healing this turn/);
    assert.match(button.find('[data-testid="card-tile"]').attributes('title')!, /cannot recruit or fight after healing this turn/);
    await button.trigger('click');
    assert.equal(calls.length, 0);
  });

  test('after a heal an unaffordable Fight N badge stays quiet', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ fightCost: 7 }),
        currentStage: 'main',
        hasHealedThisTurn: true,
        economy: economy({ attack: 6, availableAttack: 6 }),
        submitMove,
      },
    });
    const badge = wrapper.find('[data-testid="play-mastermind-fight-cost"]');
    assert.equal(badge.exists(), true);
    assert.equal(badge.classes().includes('mastermind__fight-cost--unaffordable'), false);
  });
});

describe('MastermindTile — restricted "usable only against" attack (WP-790 / D-24652)', () => {
  // why: availableAttack excludes restricted attack; the tile passes 'mastermind' so a grant
  // naming the Mastermind enables the fight, and a City-only grant does not.
  function mountWithRestrictedAttack(restrictedTargets: Array<'rooftops' | 'mastermind'>, over: Partial<UITurnEconomyState> = {}) {
    const { submitMove } = recorder();
    return mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({
          attack: 7,
          availableAttack: 4,
          restrictedAttack: [{ remaining: 3, targets: restrictedTargets, label: 'x' }],
          ...over,
        }),
        submitMove,
      },
    });
  }

  test('Mastermind-eligible restricted attack enables the fight', () => {
    const button = mountWithRestrictedAttack(['mastermind']).find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), undefined);
  });

  test('City-only restricted attack leaves the fight disabled, with the per-target figure', () => {
    const button = mountWithRestrictedAttack(['rooftops']).find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '');
    assert.equal(button.attributes('title'), 'Needs 6 attack, you have 4.');
  });

  test('the Excessive Violence control counts Mastermind-eligible restricted attack', () => {
    assert.equal(
      mountWithRestrictedAttack(['mastermind'], { excessiveViolenceAvailable: true }).find('[data-testid="play-mastermind-ev"]').exists(),
      true,
    );
    assert.equal(
      mountWithRestrictedAttack(['rooftops'], { excessiveViolenceAvailable: true }).find('[data-testid="play-mastermind-ev"]').exists(),
      false,
    );
  });
});

/**
 * The open Enigma guess picker. It is teleported to document.body, so the tile's own
 * wrapper.find cannot see its markup; findComponent follows the component tree instead.
 */
function guessPicker(wrapper: ReturnType<typeof mount>): ReturnType<ReturnType<typeof mount>['findComponent']> {
  return wrapper.findComponent(EnigmaGuessPicker);
}

describe('MastermindTile — WP-830 Enigma Code guess (D-24763)', () => {
  const enigmaCode = {
    isRevealed: false,
    cards: [
      { peekedBy: ['0'], display: { extId: 'ca75/winter-soldier/x#1', name: 'Seen Card', imageUrl: '', cost: 3 }, colors: ['tech'] },
      { peekedBy: [] },
    ],
  };

  test('with a code, Fight opens the guess picker instead of fighting', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.equal(calls.length, 0, 'no fight yet');
    assert.ok(guessPicker(wrapper).find('[data-testid="play-enigma-guess"]').exists());
  });

  test('the guess is submitted with the fight, a seen card starting on its color', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.equal(guessPicker(wrapper).find('[data-testid="play-enigma-guess-submit"]').attributes('disabled'), '', 'card 2 has no guess yet');
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-1-grey"]').trigger('click');
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-submit"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'fightMastermind');
    assert.deepEqual(calls[0]!.args, { enigmaGuess: ['tech', 'grey'] });
    assert.ok(!guessPicker(wrapper).exists(), 'the picker closes');
  });

  test('the picker starts over when the code changes under it (a mid-turn mix)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-1-grey"]').trigger('click');
    await wrapper.setProps({ enigmaCode: { isRevealed: false, cards: [enigmaCode.cards[1]!, enigmaCode.cards[0]!] } });
    assert.equal(guessPicker(wrapper).find('[data-testid="play-enigma-guess-submit"]').attributes('disabled'), '', 'the old pick is gone');
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-0-grey"]').trigger('click');
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-submit"]').trigger('click');
    assert.deepEqual(calls[0]!.args, { enigmaGuess: ['grey', 'tech'] }, 'the seen card keeps its color at its new position');
  });

  test('the picker closes when the fight is no longer possible (game over)', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.ok(guessPicker(wrapper).find('[data-testid="play-enigma-guess"]').exists());
    await wrapper.setProps({ isGameOver: true });
    assert.ok(!guessPicker(wrapper).exists());
  });

  test('the picker closes when the turn passes (End Turn pressed with it open)', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    await wrapper.setProps({ isViewerTurn: false });
    assert.ok(!guessPicker(wrapper).exists());
  });

  test('cancel closes the picker without fighting', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-cancel"]').trigger('click');
    assert.equal(calls.length, 0);
    assert.ok(!guessPicker(wrapper).exists());
  });

  // why: Jeff feedback (Loki / Enigma Code 2p, 2026-10-31) — inside the tile the picker was
  // ~125×112 px on the scaled, tilted board and a click read as one card's landed on the next.
  test('the picker is a dialog under document.body, not inside the tile', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    const dialog = guessPicker(wrapper).find('[data-testid="play-enigma-guess"]');
    assert.equal(dialog.attributes('role'), 'dialog');
    assert.equal(dialog.attributes('aria-modal'), 'true');
    assert.ok(document.body.contains(dialog.element), 'mounted in the document');
    assert.equal(dialog.element.closest('[data-testid="play-mastermind-tile"]'), null, 'outside the tile');
    assert.ok(!wrapper.find('[data-testid="play-enigma-guess"]').exists(), 'the tile itself holds no picker markup');
    wrapper.unmount();
  });

  test('each row names its card: what you saw, or face down', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.equal(guessPicker(wrapper).find('[data-testid="play-enigma-guess-known-0"]').text(), 'Seen Card — you saw Tech');
    assert.equal(guessPicker(wrapper).find('[data-testid="play-enigma-guess-known-1"]').text(), 'Face down');
    wrapper.unmount();
  });

  test('Escape and a backdrop click cancel without fighting; a click inside the dialog does not', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess"]').trigger('click');
    assert.ok(guessPicker(wrapper).exists(), 'a click inside the dialog keeps it open');
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-backdrop"]').trigger('click');
    assert.ok(!guessPicker(wrapper).exists(), 'the backdrop click cancels');

    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.ok(guessPicker(wrapper).exists(), 'reopened');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    assert.ok(!guessPicker(wrapper).exists(), 'Escape cancels');
    assert.equal(calls.length, 0, 'no fight');
    wrapper.unmount();
  });
});

describe('MastermindTile — band stand-up (WP-854 / D-24790)', () => {
  const enigmaCode = {
    isRevealed: false,
    cards: [
      { peekedBy: ['0'], display: { extId: 'ca75/winter-soldier/x#1', name: 'Seen Card', imageUrl: '', cost: 3 }, colors: ['tech'] },
      { peekedBy: [] },
    ],
  };

  test('without isTiltLiftEnabled the root has no mastermind-tile--tilt-lift class', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy(), submitMove },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-tile"]').classes('mastermind-tile--tilt-lift'), false);
  });

  test('with isTiltLiftEnabled the root has the mastermind-tile--tilt-lift class', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy(), submitMove, isTiltLiftEnabled: true },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-tile"]').classes('mastermind-tile--tilt-lift'), true);
  });

  test('the root gains mastermind-tile--guessing exactly when the Enigma guess picker opens', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 6, availableAttack: 6 }), submitMove, enigmaCode, isTiltLiftEnabled: true },
    });
    const root = wrapper.find('[data-testid="play-mastermind-tile"]');
    assert.equal(root.classes('mastermind-tile--guessing'), false, 'no guess before the Fight click');
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.equal(root.classes('mastermind-tile--guessing'), true, 'the guess is open after the Fight click');
    assert.ok(guessPicker(wrapper).exists(), 'the picker is present');
  });
});

describe('MastermindTile — Haunt blocks the Fight (WP-757 / D-24587)', () => {
  // why: the engine's fightMastermind refuses the fight while the Mastermind haunts an
  // HQ Hero (isMastermindHaunting); the tile must not offer a dead button on any path.
  const hauntReason = /The Mastermind is haunting a Hero in the HQ\. Exorcise that Hero first\./;

  test('while haunting, Fight is disabled with the haunt tooltip and a click submits nothing', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ isHaunting: true }),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, hauntReason);
    assert.match(button.find('[data-testid="card-tile"]').attributes('title')!, hauntReason);
    await button.trigger('click');
    assert.equal(calls.length, 0);
  });

  test('while haunting, the Excessive Violence button is not offered', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ isHaunting: true }),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-ev"]').exists(), false);
  });

  test('while haunting, Fight does not open the Enigma guess picker', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ isHaunting: true }),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
        enigmaCode: { isRevealed: false, cards: [{ peekedBy: [] }] },
      },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.equal(calls.length, 0);
    assert.ok(!guessPicker(wrapper).exists(), 'no picker while haunting');
  });

  test('precedence: an unaffordable fight shows the cost reason, not the haunt reason', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ isHaunting: true }),
        currentStage: 'main',
        economy: economy({ attack: 4, availableAttack: 4 }),
        submitMove,
      },
    });
    assert.match(wrapper.find('[data-testid="play-mastermind-button"]').attributes('title')!, /Needs 6 attack, you have 4\./);
  });

  test('a picker opened before the haunt closes once the Mastermind starts haunting', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
        enigmaCode: { isRevealed: false, cards: [{ peekedBy: [] }] },
      },
    });
    await wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');
    assert.ok(guessPicker(wrapper).exists(), 'precondition: the picker is open');
    await wrapper.setProps({ mastermind: mastermindLive({ isHaunting: true }) });
    assert.ok(!guessPicker(wrapper).exists(), 'the picker closes');
  });
});

describe('MastermindTile — Fortify blocks the Fight (WP-873 / D-24818)', () => {
  const fortifiedReason = 'Colleen Wing fortifies the Mastermind. Fight Colleen Wing first.';

  test('T30: with fortifiedReason set and enough attack, Fight is disabled with that reason and submits nothing', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ fortifiedReason }),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(button.attributes('disabled'), '');
    assert.equal(button.attributes('title'), fortifiedReason);
    await button.trigger('click');
    assert.equal(calls.length, 0);
  });

  test('D-24819: the Mastermind fortifier is drawn on the tile, outside the Fight button, and fighting it sends its place', async () => {
    const colleenWing: UIFortifier = {
      place: 'mastermind',
      placeLabel: 'the Mastermind',
      extId: 'cvwr-villain-heroes-for-hire-colleen-wing-00',
      display: { extId: 'cvwr-villain-heroes-for-hire-colleen-wing-00', name: 'Colleen Wing', imageUrl: '', cost: 9 },
      fightCost: 9,
      lockText: "the Mastermind can't be fought",
    };
    const squirrelGirl: UIFortifier = {
      place: 'sidekick-stack',
      placeLabel: 'the Sidekick Stack',
      extId: 'cvwr-villain-great-lakes-avengers-squirrel-girl-00',
      display: { extId: 'cvwr-villain-great-lakes-avengers-squirrel-girl-00', name: 'Squirrel Girl', imageUrl: '', cost: 3 },
      fightCost: 3,
      lockText: "Sidekicks can't be recruited or gained",
    };
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ fortifiedReason }),
        fortifiers: [squirrelGirl, colleenWing],
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    const chips = wrapper.findAll('[data-testid="play-fortifier"]');
    assert.equal(chips.length, 1, 'only the Mastermind fortifier is drawn on the Mastermind');
    assert.match(chips[0]!.text(), /Colleen Wing/);
    const fightButton = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(fightButton.element.contains(chips[0]!.element), false, 'not nested inside the Fight button');
    await wrapper.find('[data-testid="play-fortifier-fight"]').trigger('click');
    assert.deepStrictEqual(calls, [{ name: 'fightVillain', args: { fortifiedPlace: 'mastermind' } }]);
    const unfortified = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy(), submitMove },
    });
    assert.equal(unfortified.find('[data-testid="play-fortifier"]').exists(), false);
  });

  // why: D-24819 — the stand-up lift (WP-854 / D-24790) must never raise the Mastermind card over
  // the fortifier chip. jsdom cannot hit-test 3D, so the class and its selectors are pinned here.
  test('D-24819: the tile is --fortified exactly while the Mastermind is fortified, and no stand-up selector lifts it', () => {
    const { submitMove } = recorder();
    const fortified = mount(MastermindTile, {
      props: { mastermind: mastermindLive({ fortifiedReason }), currentStage: 'main', economy: economy(), submitMove },
    });
    assert.equal(fortified.find('[data-testid="play-mastermind-tile"]').classes().includes('mastermind-tile--fortified'), true);
    const open = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy(), submitMove },
    });
    assert.equal(open.find('[data-testid="play-mastermind-tile"]').classes().includes('mastermind-tile--fortified'), false);

    const sources = [
      readFileSync(new URL('./MastermindTile.vue', import.meta.url), 'utf8'),
      readFileSync(new URL('../../pages/PlayDesktop.vue', import.meta.url), 'utf8'),
    ];
    for (const source of sources) {
      const liftSelectors = source.match(/\.mastermind-tile--tilt-lift:not\(\.mastermind-tile--guessing\)[^ ,{]*/g) ?? [];
      assert.ok(liftSelectors.length > 0, 'the stand-up selectors are present');
      for (const selector of liftSelectors) {
        assert.ok(selector.includes(':not(.mastermind-tile--fortified)'), `${selector} must skip a fortified Mastermind`);
      }
    }
  });
});

describe('MastermindTile — Haunting badge (WP-759 / D-24587)', () => {
  test('while haunting, the Haunting badge shows outside the Fight button', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ isHaunting: true }),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    const badge = wrapper.find('[data-testid="play-mastermind-haunting"]');
    assert.equal(badge.exists(), true);
    assert.equal(badge.attributes('role'), 'status');
    assert.match(badge.text(), /exorcise it to fight/);
    assert.equal(badge.element.closest('[data-testid="play-mastermind-button"]'), null);
  });

  test('with no isHaunting there is no badge', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive(),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-haunting"]').exists(), false);
  });
});

describe('MastermindTile — Killmonger Wound him + Wounds badge (WP-771 / D-24602)', () => {
  /** Killmonger as the engine projects him while locked: printed 5, the lock reason, woundable. */
  function killmonger(over: Partial<UIMastermindState> = {}): UIMastermindState {
    return mastermindLive({
      id: 'bkpt-mastermind-killmonger',
      display: { extId: 'bkpt-mastermind-killmonger', name: 'Killmonger', imageUrl: '', cost: 5 },
      fightCost: 5,
      fortifiedReason: KILLMONGER_ATTACK_LOCK_REASON,
      woundable: true,
      ...over,
    });
  }

  /** Killmonger at 0 Attack (or vanquished): the engine projects no lock reason and no woundable. */
  function killmongerUnlocked(over: Partial<UIMastermindState> = {}): UIMastermindState {
    return mastermindLive({
      id: 'bkpt-mastermind-killmonger',
      display: { extId: 'bkpt-mastermind-killmonger', name: 'Killmonger', imageUrl: '', cost: 5 },
      fightCost: 0,
      ...over,
    });
  }

  const woundButton = '[data-testid="play-mastermind-wound"]';
  const woundsBadge = '[data-testid="play-mastermind-wounds"]';

  test('AC 1: with no woundable, woundCount or Killmonger reason there is no Wound button and no badge', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: mastermindLive(), currentStage: 'main', economy: economy({ attack: 9, availableAttack: 9 }), submitMove },
    });
    assert.equal(wrapper.find(woundButton).exists(), false);
    assert.equal(wrapper.find(woundsBadge).exists(), false);
    assert.equal(wrapper.find('[data-testid="play-mastermind-button"]').attributes('disabled'), undefined);
  });

  test('AC 2: under the lock Fight is disabled with the engine reason at any attack, and submits nothing', async () => {
    for (const availableAttack of [0, 3, 5, 9]) {
      const { calls, submitMove } = recorder();
      const wrapper = mount(MastermindTile, {
        props: { mastermind: killmonger(), currentStage: 'main', economy: economy({ attack: availableAttack, availableAttack }), submitMove },
      });
      const fight = wrapper.find('[data-testid="play-mastermind-button"]');
      assert.equal(fight.attributes('disabled'), '', `attack ${availableAttack}`);
      assert.equal(fight.attributes('title'), KILLMONGER_ATTACK_LOCK_REASON, `attack ${availableAttack}`);
      await fight.trigger('click');
      assert.equal(calls.length, 0, `attack ${availableAttack}`);
    }
  });

  test('AC 2: under the lock the Excessive Violence button is hidden', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: killmonger(),
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-ev"]').exists(), false);
  });

  test('AC 3: a non-Killmonger fortifiedReason keeps the cost gate first', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: mastermindLive({ fortifiedReason: 'Colleen Wing fortifies the Mastermind. Fight Colleen Wing first.' }),
        currentStage: 'main',
        economy: economy({ attack: 2, availableAttack: 2 }),
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-button"]').attributes('title'), 'Needs 6 attack, you have 2.');
  });

  test('AC 4: under the lock the Fight N badge shows his Attack but never goes loud', () => {
    const { submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: killmonger({ fightCost: 4, woundCount: 1 }),
        currentStage: 'main',
        economy: economy({ attack: 1, availableAttack: 1 }),
        submitMove,
      },
    });
    const badge = wrapper.find('[data-testid="play-mastermind-fight-cost"]');
    assert.equal(badge.text(), 'Fight 4');
    assert.equal(badge.classes().includes('mastermind__fight-cost--unaffordable'), false);
  });

  test('AC 5: the Wound button names his Attack and submits woundMastermind with {}', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: killmonger({ fightCost: 3, woundCount: 2 }), currentStage: 'main', economy: economy({ attack: 3, availableAttack: 3 }), submitMove },
    });
    const button = wrapper.find(woundButton);
    assert.equal(button.text(), 'Wound him — spend 3 → +1 Recruit');
    assert.equal(button.attributes('disabled'), undefined);
    assert.equal(button.find('svg').exists(), true, 'CrossedSwordsIcon, never a Unicode glyph');
    assert.equal(button.element.closest('[data-testid="play-mastermind-button"]'), null, 'not inside the Fight button');
    await button.trigger('click');
    assert.deepEqual(calls, [{ name: 'woundMastermind', args: {} }]);
  });

  test('AC 6: the Wound button is gated on turn, stage, then attack (restricted Mastermind attack counts)', async () => {
    const cases: Array<{ stage: string; isViewerTurn: boolean; availableAttack: number; reason: string }> = [
      { stage: 'main', isViewerTurn: false, availableAttack: 9, reason: 'It is not your turn.' },
      { stage: 'start', isViewerTurn: true, availableAttack: 9, reason: 'Only available during the Main (Play / Recruit / Fight) step (current: start).' },
      { stage: 'cleanup', isViewerTurn: true, availableAttack: 9, reason: 'Only available during the Main (Play / Recruit / Fight) step (current: cleanup).' },
      { stage: 'main', isViewerTurn: true, availableAttack: 4, reason: 'Needs 5 attack, you have 4.' },
    ];
    for (const blocked of cases) {
      const { calls, submitMove } = recorder();
      const wrapper = mount(MastermindTile, {
        props: {
          mastermind: killmonger(),
          currentStage: blocked.stage,
          isViewerTurn: blocked.isViewerTurn,
          economy: economy({ attack: blocked.availableAttack, availableAttack: blocked.availableAttack }),
          submitMove,
        },
      });
      const button = wrapper.find(woundButton);
      assert.equal(button.attributes('disabled'), '', blocked.reason);
      assert.equal(button.attributes('title'), blocked.reason);
      await button.trigger('click');
      assert.equal(calls.length, 0, blocked.reason);
    }
    const { submitMove } = recorder();
    const restricted = mount(MastermindTile, {
      props: {
        mastermind: killmonger(),
        currentStage: 'main',
        economy: economy({ attack: 5, availableAttack: 3, restrictedAttack: [{ remaining: 2, targets: ['mastermind'], label: 'x' }] }),
        submitMove,
      },
    });
    assert.equal(restricted.find(woundButton).attributes('disabled'), undefined);
  });

  test('AC 7: the heal lock does not block the Wound, and an Enigma code never opens the guess picker', async () => {
    const { calls, submitMove } = recorder();
    const enigmaCode = { isRevealed: false, cards: [{ peekedBy: [] }] };
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: killmonger(),
        currentStage: 'main',
        hasHealedThisTurn: true,
        economy: economy({ attack: 5, availableAttack: 5 }),
        enigmaCode,
        submitMove,
      },
    });
    const button = wrapper.find(woundButton);
    assert.equal(button.attributes('disabled'), undefined);
    assert.match(button.attributes('title') ?? '', /Wounding is not a fight\./);
    await button.trigger('click');
    assert.deepEqual(calls, [{ name: 'woundMastermind', args: {} }]);
    assert.equal(guessPicker(wrapper).exists(), false);
  });

  test('AC 8: without woundable there is no Wound button (Fight enabled at 0), and none once the game is over', () => {
    const { submitMove } = recorder();
    const atZero = mount(MastermindTile, {
      props: {
        mastermind: killmongerUnlocked({ woundCount: 5 }),
        currentStage: 'main',
        economy: economy(),
        submitMove,
      },
    });
    assert.equal(atZero.find(woundButton).exists(), false);
    assert.equal(atZero.find('[data-testid="play-mastermind-button"]').attributes('disabled'), undefined);
    const gameOver = mount(MastermindTile, {
      props: { mastermind: killmonger(), currentStage: 'main', economy: economy({ attack: 9, availableAttack: 9 }), isGameOver: true, submitMove },
    });
    assert.equal(gameOver.find(woundButton).exists(), false);
  });

  test('AC 9: the Wounds badge counts, shows under a Final Blow, and hides once vanquished (game over or not)', () => {
    const { submitMove } = recorder();
    const live = mount(MastermindTile, {
      props: { mastermind: killmonger({ woundCount: 3, fightCost: 2 }), currentStage: 'main', economy: economy(), submitMove },
    });
    const badge = live.find(woundsBadge);
    assert.equal(badge.text(), 'Wounds: 3');
    assert.equal(badge.attributes('data-count'), '3');
    assert.equal(badge.element.closest('[data-testid="play-mastermind-button"]'), null);
    const finalBlow = mount(MastermindTile, {
      props: { mastermind: killmonger({ tacticsRemaining: 0, finalBlowPending: true, woundCount: 2 }), currentStage: 'main', economy: economy(), submitMove },
    });
    assert.equal(finalBlow.find(woundsBadge).exists(), true);
    for (const isGameOver of [false, true]) {
      const vanquished = mount(MastermindTile, {
        props: {
          mastermind: killmongerUnlocked({ tacticsRemaining: 0, finalBlowPending: false, woundCount: 5 }),
          currentStage: 'main',
          economy: economy(),
          isGameOver,
          submitMove,
        },
      });
      assert.equal(vanquished.find(woundsBadge).exists(), false, `isGameOver ${isGameOver}`);
    }
  });
});

const INDESTRUCTIBLE_MAN_LOCK =
  "You can't use Attack to fight Indestructible Man. Shuffle two Elite Assassins from your Victory Pile into the Villain Deck to fight him.";

/**
 * One projected Elite Assassin, as `shuffleFight.eligibleAssassins` carries it.
 *
 * @param slug - The card slug and copy suffix.
 * @param name - The card name.
 * @returns A display entry with art.
 */
function eliteAssassin(slug: string, name: string): { extId: string; display: UIMastermindState['display'] } {
  const extId = `bkwd-villain-elite-assassins-${slug}`;
  return { extId, display: { extId, name, imageUrl: `https://images.legendary-arena.com/${slug}.webp`, cost: null } };
}

const ELIGIBLE_ASSASSINS = [
  eliteAssassin('snapdragon-01', 'Snapdragon'),
  eliteAssassin('black-lotus-00', 'Black Lotus'),
  eliteAssassin('snapdragon-02', 'Snapdragon'),
];

/**
 * Indestructible Man as WP-768 projects him: the attack lock in fortifiedReason and the
 * shuffle-fight state for the active player.
 *
 * @param shuffle - Overrides for the shuffleFight projection.
 * @param over - Overrides for the Mastermind.
 * @returns The projected Mastermind.
 */
function indestructibleMan(
  shuffle: Partial<NonNullable<UIMastermindState['shuffleFight']>> = {},
  over: Partial<UIMastermindState> = {},
): UIMastermindState {
  return mastermindLive({
    id: 'bkwd/indestructible-man',
    display: { extId: 'bkwd-mastermind-indestructible-man', name: 'Indestructible Man', imageUrl: 'https://images.legendary-arena.com/im.webp', cost: 4 },
    fightCost: 5,
    fortifiedReason: INDESTRUCTIBLE_MAN_LOCK,
    shuffleFight: {
      requiredCount: 2,
      isUsedThisTurn: false,
      isAvailable: true,
      eligibleAssassins: ELIGIBLE_ASSASSINS,
      ...shuffle,
    },
    ...over,
  });
}

/**
 * The same Mastermind with no engine reason (the engine drops it once he is vanquished).
 *
 * @param mastermind - The projected Mastermind.
 * @returns A copy without fortifiedReason.
 */
function withoutFortifiedReason(mastermind: UIMastermindState): UIMastermindState {
  const copy = { ...mastermind };
  delete copy.fortifiedReason;
  return copy;
}

/**
 * The open Assassin chooser. It is teleported to document.body, so findComponent follows the
 * component tree to it.
 */
function assassinChooser(wrapper: ReturnType<typeof mount>): ReturnType<ReturnType<typeof mount>['findComponent']> {
  return wrapper.findComponent(AssassinShuffleChooser);
}

/**
 * Picks the first two Assassins in the open chooser and confirms.
 *
 * @param wrapper - The mounted tile with the chooser open.
 */
async function chooseFirstTwoAssassins(wrapper: ReturnType<typeof mount>): Promise<void> {
  const options = assassinChooser(wrapper).findAll('[data-testid="play-assassin-option"]');
  await options[0]!.trigger('click');
  await options[1]!.trigger('click');
  await assassinChooser(wrapper).find('[data-testid="play-assassin-confirm"]').trigger('click');
}

describe('MastermindTile — Indestructible Man shuffle-fight (WP-770 / D-24601)', () => {
  const shuffleButton = '[data-testid="play-mastermind-shuffle-fight"]';
  const richEconomy = economy({ attack: 12, availableAttack: 12, excessiveViolenceAvailable: true });

  test('AC 1: without shuffleFight there is no shuffle button, even under another lock', () => {
    const { submitMove } = recorder();
    for (const mastermind of [mastermindLive(), mastermindLive({ fortifiedReason: 'Colleen Wing fortifies the Mastermind.' })]) {
      const wrapper = mount(MastermindTile, { props: { mastermind, currentStage: 'main', economy: richEconomy, submitMove } });
      assert.equal(wrapper.find(shuffleButton).exists(), false);
      assert.equal(wrapper.findComponent(AssassinShuffleChooser).exists(), false);
    }
  });

  test('AC 2: Fight keeps the card but never fights; no Fight N badge and no Excessive Violence', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      props: { mastermind: indestructibleMan(), currentStage: 'main', economy: richEconomy, submitMove },
    });
    const fight = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(fight.attributes('disabled'), '');
    assert.equal(fight.attributes('title'), INDESTRUCTIBLE_MAN_LOCK);
    const cardTile = fight.find('[data-testid="card-tile"]');
    assert.ok(cardTile.exists(), 'the Mastermind card art still renders');
    assert.equal(cardTile.classes('card-tile--interactive'), false, 'the card is not interactive');
    assert.match(wrapper.find('[data-testid="play-mastermind-tactics-remaining"]').text(), /Tactics remaining: 4/);
    assert.equal(wrapper.find('[data-testid="play-mastermind-fight-cost"]').exists(), false, 'no Fight N badge');
    assert.equal(wrapper.find('[data-testid="play-mastermind-ev"]').exists(), false, 'no Excessive Violence');
    (wrapper.vm as unknown as { onFight: () => void }).onFight();
    await nextTick();
    assert.equal(calls.length, 0, 'even a direct onFight() submits nothing');
  });

  test('AC 3: the Fight title is the lock reason, never the turn, stage or cost reason', () => {
    const { submitMove } = recorder();
    const cases = [
      { isViewerTurn: false, currentStage: 'main', economy: richEconomy },
      { isViewerTurn: true, currentStage: 'start', economy: richEconomy },
      { isViewerTurn: true, currentStage: 'main', economy: economy({ attack: 1, availableAttack: 1 }) },
    ];
    for (const props of cases) {
      const wrapper = mount(MastermindTile, { props: { mastermind: indestructibleMan(), submitMove, ...props } });
      assert.equal(wrapper.find('[data-testid="play-mastermind-button"]').attributes('title'), INDESTRUCTIBLE_MAN_LOCK, JSON.stringify(props));
    }
    const noReason = mount(MastermindTile, {
      props: { mastermind: withoutFortifiedReason(indestructibleMan()), currentStage: 'main', economy: richEconomy, submitMove },
    });
    assert.equal(noReason.find('[data-testid="play-mastermind-button"]').attributes('title'), "Indestructible Man can't be fought right now.");
  });

  test('AC 4: the shuffle button shows its label; hidden once vanquished or game over; shown for a Final Blow', () => {
    const { submitMove } = recorder();
    const live = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'main', economy: richEconomy, submitMove } });
    assert.equal(live.find(shuffleButton).text(), 'Shuffle 2 Elite Assassins → Fight');
    assert.ok(live.find(shuffleButton).find('svg').exists(), 'the crossed-swords SVG icon');
    const vanquished = mount(MastermindTile, {
      props: { mastermind: withoutFortifiedReason(indestructibleMan({ isAvailable: false }, { tacticsRemaining: 0 })), currentStage: 'main', economy: richEconomy, submitMove },
    });
    assert.equal(vanquished.find(shuffleButton).exists(), false);
    assert.match(vanquished.find('[data-testid="play-mastermind-button"]').attributes('title')!, /All tactics defeated/);
    const over = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'main', economy: richEconomy, submitMove, isGameOver: true } });
    assert.equal(over.find(shuffleButton).exists(), false);
    const finalBlow = mount(MastermindTile, {
      props: { mastermind: indestructibleMan({}, { tacticsRemaining: 0, finalBlowPending: true }), currentStage: 'main', economy: richEconomy, submitMove },
    });
    assert.equal(finalBlow.find(shuffleButton).attributes('disabled'), undefined);
  });

  test('AC 5a: the shuffle button is gated on turn, stage, then the heal lock; disabled clicks open nothing', async () => {
    const { submitMove } = recorder();
    const offTurn = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'main', isViewerTurn: false, economy: richEconomy, submitMove } });
    assert.equal(offTurn.find(shuffleButton).attributes('title'), 'It is not your turn.');
    const start = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'start', economy: richEconomy, submitMove } });
    assert.match(start.find(shuffleButton).attributes('title')!, /Only available during the Main/);
    const healed = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'main', hasHealedThisTurn: true, economy: richEconomy, submitMove } });
    assert.match(healed.find(shuffleButton).attributes('title')!, /cannot recruit or fight after healing this turn/);
    for (const wrapper of [offTurn, start, healed]) {
      assert.equal(wrapper.find(shuffleButton).attributes('disabled'), '');
      await wrapper.find(shuffleButton).trigger('click');
      assert.equal(assassinChooser(wrapper).exists(), false);
    }
  });

  test('AC 5b: then once per turn, the eligible count, the haunt, and the engine isAvailable', () => {
    const { submitMove } = recorder();
    const titleFor = (mastermind: UIMastermindState): string | undefined =>
      mount(MastermindTile, { props: { mastermind, currentStage: 'main', economy: richEconomy, submitMove } }).find(shuffleButton).attributes('title');
    assert.equal(titleFor(indestructibleMan({ isUsedThisTurn: true, isAvailable: false })), "You've already shuffled Assassins this turn.");
    assert.equal(titleFor(indestructibleMan({ eligibleAssassins: [ELIGIBLE_ASSASSINS[0]!], isAvailable: false })), 'Needs 2 Elite Assassins in your Victory Pile.');
    assert.equal(titleFor(indestructibleMan({ isAvailable: false }, { isHaunting: true })), 'The Mastermind is haunting a Hero in the HQ. Exorcise that Hero first.');
    const guardReason = 'The Blob guards the Mastermind. Defeat The Blob first.';
    assert.equal(titleFor(indestructibleMan({ isAvailable: false }, { fortifiedReason: guardReason })), guardReason);
    const open = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'main', economy: economy(), submitMove } });
    assert.equal(open.find(shuffleButton).attributes('disabled'), undefined, 'enabled at 0 Attack: Attack is never spent');
    assert.match(open.find(shuffleButton).attributes('title')!, /to fight Indestructible Man \(once per turn\)/);
  });

  test('AC 6: clicking opens the chooser as a dialog under document.body, listing the eligible Assassins', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'main', economy: richEconomy, submitMove } });
    await wrapper.find(shuffleButton).trigger('click');
    const dialog = assassinChooser(wrapper).find('[data-testid="play-assassin-chooser"]');
    assert.equal(dialog.attributes('role'), 'dialog');
    assert.ok(document.body.contains(dialog.element), 'mounted in the document');
    assert.equal(dialog.element.closest('[data-testid="play-mastermind-tile"]'), null, 'outside the tile');
    const options = assassinChooser(wrapper).findAll('[data-testid="play-assassin-option"]');
    assert.deepEqual(options.map((option) => option.attributes('data-ext-id')), ELIGIBLE_ASSASSINS.map((entry) => entry.extId));
    assert.match(options[1]!.text(), /Black Lotus/);
    assert.equal(calls.length, 0, 'opening submits nothing');
    wrapper.unmount();
  });

  test('AC 7: Confirm needs exactly 2 and submits fightMastermind with the shuffleAssassinIds', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'main', economy: richEconomy, submitMove } });
    await wrapper.find(shuffleButton).trigger('click');
    const options = assassinChooser(wrapper).findAll('[data-testid="play-assassin-option"]');
    const confirm = (): ReturnType<typeof wrapper.find> => assassinChooser(wrapper).find('[data-testid="play-assassin-confirm"]');
    for (const option of options) {
      await option.trigger('click');
    }
    assert.equal(confirm().attributes('disabled'), '', '3 chosen');
    await options[0]!.trigger('click');
    assert.equal(options[0]!.attributes('aria-pressed'), 'false');
    assert.equal(confirm().attributes('disabled'), undefined, '2 chosen');
    await confirm().trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'fightMastermind');
    assert.deepEqual(calls[0]!.args, { shuffleAssassinIds: [ELIGIBLE_ASSASSINS[1]!.extId, ELIGIBLE_ASSASSINS[2]!.extId] });
    assert.equal(assassinChooser(wrapper).exists(), false, 'the chooser closes');
    wrapper.unmount();
  });

  test('AC 8: Escape, Cancel and a backdrop click close without fighting, and focus returns to the shuffle button', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      attachTo: document.body,
      props: { mastermind: indestructibleMan(), currentStage: 'main', economy: richEconomy, submitMove },
    });
    const closers: Array<() => Promise<void>> = [
      async () => {
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
      },
      async () => assassinChooser(wrapper).find('[data-testid="play-assassin-cancel"]').trigger('click'),
      async () => assassinChooser(wrapper).find('[data-testid="play-assassin-backdrop"]').trigger('click'),
    ];
    for (const close of closers) {
      await wrapper.find(shuffleButton).trigger('click');
      await assassinChooser(wrapper).find('[data-testid="play-assassin-chooser"]').trigger('click');
      assert.ok(assassinChooser(wrapper).exists(), 'a click inside the panel keeps it open');
      await close();
      await nextTick();
      await nextTick();
      assert.equal(assassinChooser(wrapper).exists(), false);
      assert.equal(document.activeElement, wrapper.find(shuffleButton).element, 'focus returns to the shuffle button');
    }
    assert.equal(calls.length, 0);
    wrapper.unmount();
  });

  test('AC 9: with an Enigma code the guess comes next, and is sent with the Assassins', async () => {
    const enigmaCode = { isRevealed: false, cards: [{ peekedBy: [] }] };
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, {
      attachTo: document.body,
      props: { mastermind: indestructibleMan(), currentStage: 'main', economy: richEconomy, submitMove, enigmaCode },
    });
    await wrapper.find(shuffleButton).trigger('click');
    await chooseFirstTwoAssassins(wrapper);
    assert.equal(calls.length, 0, 'no fight before the guess');
    assert.equal(assassinChooser(wrapper).exists(), false);
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-cancel"]').trigger('click');
    await nextTick();
    await nextTick();
    assert.equal(guessPicker(wrapper).exists(), false);
    assert.equal(calls.length, 0, 'cancel fights nothing');
    assert.equal(document.activeElement, wrapper.find(shuffleButton).element, 'focus returns to the shuffle button');

    await wrapper.find(shuffleButton).trigger('click');
    await chooseFirstTwoAssassins(wrapper);
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-0-grey"]').trigger('click');
    await guessPicker(wrapper).find('[data-testid="play-enigma-guess-submit"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.args, {
      shuffleAssassinIds: [ELIGIBLE_ASSASSINS[0]!.extId, ELIGIBLE_ASSASSINS[1]!.extId],
      enigmaGuess: ['grey'],
    });
    wrapper.unmount();
  });

  test('AC 10: an open chooser, and the hand-off Enigma picker, close when the shuffle-fight is no longer possible', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'main', economy: richEconomy, submitMove } });
    await wrapper.find(shuffleButton).trigger('click');
    await wrapper.setProps({ isViewerTurn: false });
    assert.equal(assassinChooser(wrapper).exists(), false, 'the turn passed');
    await wrapper.setProps({ isViewerTurn: true });
    await wrapper.find(shuffleButton).trigger('click');
    assert.ok(assassinChooser(wrapper).exists(), 'reopened');
    await wrapper.setProps({ isGameOver: true });
    assert.equal(assassinChooser(wrapper).exists(), false, 'the game ended');

    const enigmaCode = { isRevealed: false, cards: [{ peekedBy: [] }] };
    const withCode = mount(MastermindTile, { props: { mastermind: indestructibleMan(), currentStage: 'main', economy: richEconomy, submitMove, enigmaCode } });
    await withCode.find(shuffleButton).trigger('click');
    await chooseFirstTwoAssassins(withCode);
    assert.ok(guessPicker(withCode).exists(), 'the hand-off picker is open');
    await withCode.setProps({ isViewerTurn: false });
    assert.equal(guessPicker(withCode).exists(), false, 'the hand-off picker closes when the turn passes');
    assert.equal(calls.length, 0);
    wrapper.unmount();
    withCode.unmount();
  });
});
