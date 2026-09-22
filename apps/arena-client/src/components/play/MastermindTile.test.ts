import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import MastermindTile from './MastermindTile.vue';
import type {
  UIMastermindState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
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
});
