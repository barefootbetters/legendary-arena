import '../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { defineComponent, h, nextTick, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useRowFit } from './useRowFit';

/** Stubs an element's horizontal scroll metrics (jsdom has no layout engine). */
function stubWidths(element: HTMLElement, scrollWidth: number, clientWidth: number): void {
  Object.defineProperty(element, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(element, 'clientWidth', { value: clientWidth, configurable: true });
}

/** Stubs the row's rect to sit inside the jsdom window width. */
function stubRectInsideViewport(element: HTMLElement): void {
  const right = Math.min(400, window.innerWidth);
  element.getBoundingClientRect = () =>
    ({ left: 0, right, top: 0, bottom: 100, width: right, height: 100, x: 0, y: 0 }) as DOMRect;
}

/**
 * Mounts a minimal row that binds `useRowFit` to an `<ol>` (or to nothing, when
 * `isRowBound` is false) and exposes the flag and its content source.
 */
function mountRow(isRowBound: boolean) {
  const content = ref(0);
  let isRowFitting: Readonly<Ref<boolean>> = ref(false);
  const RowHarness = defineComponent({
    setup() {
      const rowElement = ref<HTMLElement | null>(null);
      isRowFitting = useRowFit(rowElement, () => content.value);
      return () => (isRowBound ? h('ol', { ref: rowElement }) : h('div'));
    },
  });
  const wrapper = mount(RowHarness, { attachTo: document.body });
  return { wrapper, content, readFit: () => isRowFitting.value };
}

describe('useRowFit (WP-852)', () => {
  test('a row that does not overflow and sits inside the viewport fits', async () => {
    const { wrapper, readFit } = mountRow(true);
    const row = wrapper.find('ol').element as HTMLElement;
    stubWidths(row, 600, 600);
    stubRectInsideViewport(row);
    window.dispatchEvent(new window.Event('resize'));
    await nextTick();
    assert.equal(readFit(), true);
    wrapper.unmount();
  });

  test('a row whose content is wider than its box does not fit', async () => {
    const { wrapper, readFit } = mountRow(true);
    const row = wrapper.find('ol').element as HTMLElement;
    stubWidths(row, 602, 600);
    stubRectInsideViewport(row);
    window.dispatchEvent(new window.Event('resize'));
    await nextTick();
    assert.equal(readFit(), false);
    wrapper.unmount();
  });

  test('a content change re-measures the row', async () => {
    const { wrapper, content, readFit } = mountRow(true);
    const row = wrapper.find('ol').element as HTMLElement;
    stubWidths(row, 600, 600);
    stubRectInsideViewport(row);
    window.dispatchEvent(new window.Event('resize'));
    await nextTick();
    assert.equal(readFit(), true, 'the row fits before its content grows');
    stubWidths(row, 900, 600);
    content.value += 1;
    await nextTick();
    assert.equal(readFit(), false, 'the wider content is read after the content source changes');
    wrapper.unmount();
  });

  test('a row with no element bound reads false', async () => {
    const { wrapper, readFit } = mountRow(false);
    await nextTick();
    assert.equal(readFit(), false);
    wrapper.unmount();
  });
});
