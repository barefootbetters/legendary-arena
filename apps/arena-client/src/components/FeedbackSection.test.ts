// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import FeedbackSection from './FeedbackSection.vue';

enableAutoUnmount(afterEach);

interface StubResponse {
  status: number;
  body: unknown;
}

const originalFetch = globalThis.fetch;
let routeHandler: (url: string, init: RequestInit) => StubResponse;
const capturedCalls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = [];

beforeEach(() => {
  capturedCalls.length = 0;
  routeHandler = () => ({ status: 201, body: { id: 1 } });
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const resolvedInit = init ?? {};
    capturedCalls.push({
      url: String(url),
      method: String(resolvedInit.method ?? 'GET'),
      headers: (resolvedInit.headers ?? {}) as Record<string, string>,
      body:
        typeof resolvedInit.body === 'string'
          ? JSON.parse(resolvedInit.body)
          : null,
    });
    const { status, body } = routeHandler(String(url), resolvedInit);
    return { status, json: async () => body } as Response;
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Mount the section signed in, with a valid draft already typed in. */
async function mountSignedIn() {
  const wrapper = mount(FeedbackSection, { props: { authToken: 'token' } });
  await flushPromises();
  return wrapper;
}

/** Type a valid title + description so the Submit button is enabled. */
async function fillValidDraft(wrapper: Awaited<ReturnType<typeof mountSignedIn>>) {
  await wrapper.find('[data-testid="feedback-title"]').setValue('A better tutorial');
  await wrapper.find('[data-testid="feedback-description"]').setValue('Add a first-match walkthrough.');
}

test('with a null token, only the signed-out line renders', async () => {
  const wrapper = mount(FeedbackSection, { props: { authToken: null } });
  await flushPromises();
  assert.equal(wrapper.find('[data-testid="feedback-signed-out"]').exists(), true);
  assert.match(
    wrapper.find('[data-testid="feedback-signed-out"]').text(),
    /Sign in to send feedback\./,
  );
  assert.equal(wrapper.find('[data-testid="feedback-kind"]').exists(), false);
  assert.equal(wrapper.find('[data-testid="feedback-submit"]').exists(), false);
});

test('the section root carries id="send-feedback"', async () => {
  const wrapper = await mountSignedIn();
  const root = wrapper.find('[data-testid="feedback-section"]');
  assert.equal(root.exists(), true);
  assert.equal(root.attributes('id'), 'send-feedback');
});

test('the kind control offers Bug report / Feature idea / Review in order, Feature idea default', async () => {
  const wrapper = await mountSignedIn();
  const options = wrapper.find('[data-testid="feedback-kind"]').findAll('option');
  assert.equal(options.length, 3);
  assert.equal(options[0]?.element.value, 'bug');
  assert.match(options[0]?.text() ?? '', /Bug report/);
  assert.equal(options[1]?.element.value, 'enhancement');
  assert.match(options[1]?.text() ?? '', /Feature idea/);
  assert.equal(options[2]?.element.value, 'review');
  assert.match(options[2]?.text() ?? '', /Review/);
  const select = wrapper.find('[data-testid="feedback-kind"]').element as HTMLSelectElement;
  assert.equal(select.value, 'enhancement');
});

test('Submit is disabled for an empty title even with a valid description', async () => {
  const wrapper = await mountSignedIn();
  await wrapper.find('[data-testid="feedback-description"]').setValue('A valid description.');
  const submit = wrapper.find('[data-testid="feedback-submit"]').element as HTMLButtonElement;
  assert.equal(submit.disabled, true);
});

test('Submit is disabled for a whitespace-only title', async () => {
  const wrapper = await mountSignedIn();
  await wrapper.find('[data-testid="feedback-description"]').setValue('A valid description.');
  await wrapper.find('[data-testid="feedback-title"]').setValue('    ');
  const submit = wrapper.find('[data-testid="feedback-submit"]').element as HTMLButtonElement;
  assert.equal(submit.disabled, true);
});

test('Submit is enabled for a valid title and description', async () => {
  const wrapper = await mountSignedIn();
  await fillValidDraft(wrapper);
  const submit = wrapper.find('[data-testid="feedback-submit"]').element as HTMLButtonElement;
  assert.equal(submit.disabled, false);
});

test('the privacy helper shows for Feature idea and is absent for Bug report', async () => {
  const wrapper = await mountSignedIn();
  // Feature idea is the default.
  assert.equal(wrapper.find('[data-testid="feedback-privacy"]').exists(), true);
  await wrapper.find('[data-testid="feedback-kind"]').setValue('bug');
  assert.equal(wrapper.find('[data-testid="feedback-privacy"]').exists(), false);
});

test('a happy-path Feature idea submit sends the trimmed body, shows both sentences + the roadmap link, and resets', async () => {
  const wrapper = await mountSignedIn();
  await wrapper.find('[data-testid="feedback-title"]').setValue('  A better tutorial  ');
  await wrapper.find('[data-testid="feedback-description"]').setValue('  Add a first-match walkthrough.  ');
  await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
  await flushPromises();

  const post = capturedCalls.find((call) => call.method === 'POST' && call.url.endsWith('/api/feedback'));
  assert.ok(post, 'a POST to /api/feedback fired');
  assert.deepEqual(post.body, {
    type: 'enhancement',
    title: 'A better tutorial',
    description: 'Add a first-match walkthrough.',
  });
  assert.equal(post.headers['Content-Type'], 'application/json');
  assert.equal(post.headers.Accept, 'application/json');
  assert.equal(post.headers.Authorization, 'Bearer token');

  const success = wrapper.find('[data-testid="feedback-success"]');
  assert.equal(success.exists(), true);
  assert.match(success.text(), /Thanks — we received your feedback\./);
  assert.match(success.text(), /public roadmap/);
  assert.equal(success.find('a').attributes('href'), 'https://www.legendary-arena.com/roadmap/');

  // Form reset.
  assert.equal((wrapper.find('[data-testid="feedback-title"]').element as HTMLInputElement).value, '');
  assert.equal((wrapper.find('[data-testid="feedback-description"]').element as HTMLTextAreaElement).value, '');
  assert.equal((wrapper.find('[data-testid="feedback-kind"]').element as HTMLSelectElement).value, 'enhancement');
});

test('a Bug report submit shows only the thanks line (no roadmap), and resets the kind to enhancement', async () => {
  const wrapper = await mountSignedIn();
  await wrapper.find('[data-testid="feedback-kind"]').setValue('bug');
  await fillValidDraft(wrapper);
  await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
  await flushPromises();

  const success = wrapper.find('[data-testid="feedback-success"]');
  assert.equal(success.exists(), true);
  assert.match(success.text(), /Thanks — we received your feedback\./);
  assert.doesNotMatch(success.text(), /public roadmap/);
  assert.equal(success.find('a').exists(), false);
  assert.equal((wrapper.find('[data-testid="feedback-kind"]').element as HTMLSelectElement).value, 'enhancement');
});

test('a 400 invalid_description shows the description-limit sentence and keeps the typed text', async () => {
  const wrapper = await mountSignedIn();
  await fillValidDraft(wrapper);
  routeHandler = () => ({ status: 400, body: { error: 'invalid_description' } });
  await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
  await flushPromises();
  assert.match(
    wrapper.find('[data-testid="feedback-error"]').text(),
    /Your description needs to be between 1 and 5000 characters\./,
  );
  assert.equal(
    (wrapper.find('[data-testid="feedback-description"]').element as HTMLTextAreaElement).value,
    'Add a first-match walkthrough.',
  );
});

test('a 400 invalid_title shows the title-limit sentence', async () => {
  const wrapper = await mountSignedIn();
  await fillValidDraft(wrapper);
  routeHandler = () => ({ status: 400, body: { error: 'invalid_title' } });
  await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
  await flushPromises();
  assert.match(
    wrapper.find('[data-testid="feedback-error"]').text(),
    /Your title needs to be between 1 and 200 characters\./,
  );
});

test('a rejected fetch shows the generic sentence and keeps the typed text', async () => {
  const wrapper = await mountSignedIn();
  await fillValidDraft(wrapper);
  globalThis.fetch = (async () => {
    throw new Error('Simulated network failure.');
  }) as typeof globalThis.fetch;
  await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
  await flushPromises();
  assert.match(
    wrapper.find('[data-testid="feedback-error"]').text(),
    /Your feedback could not be sent\. Please try again\./,
  );
  assert.equal(
    (wrapper.find('[data-testid="feedback-title"]').element as HTMLInputElement).value,
    'A better tutorial',
  );
});

test('after a success, typing in the title hides the success message', async () => {
  const wrapper = await mountSignedIn();
  await fillValidDraft(wrapper);
  await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
  await flushPromises();
  assert.equal(wrapper.find('[data-testid="feedback-success"]').exists(), true);
  await wrapper.find('[data-testid="feedback-title"]').setValue('new text');
  assert.equal(wrapper.find('[data-testid="feedback-success"]').exists(), false);
});

test('a 401 shows "Please sign in again." and keeps the typed text', async () => {
  const wrapper = await mountSignedIn();
  await fillValidDraft(wrapper);
  routeHandler = () => ({ status: 401, body: { error: 'missing_token' } });
  await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
  await flushPromises();
  assert.match(
    wrapper.find('[data-testid="feedback-error"]').text(),
    /Please sign in again\./,
  );
  assert.equal(
    (wrapper.find('[data-testid="feedback-title"]').element as HTMLInputElement).value,
    'A better tutorial',
  );
});

test('a 500 lookup_failed shows the generic sentence and leaks no raw code to the DOM', async () => {
  const wrapper = await mountSignedIn();
  await fillValidDraft(wrapper);
  routeHandler = () => ({ status: 500, body: { error: 'lookup_failed' } });
  await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
  await flushPromises();
  assert.match(
    wrapper.find('[data-testid="feedback-error"]').text(),
    /Your feedback could not be sent\. Please try again\./,
  );
  assert.equal(wrapper.html().includes('lookup_failed'), false);
});

test('in-flight: Submit is disabled during the request and re-enabled (text kept) on a 500', async () => {
  const wrapper = await mountSignedIn();
  await fillValidDraft(wrapper);

  // why: the executor runs synchronously when fetch builds the promise during
  // submit, so resolveFetch is assigned before the trigger awaits; a no-op
  // default keeps the type non-null (a closure assignment is not tracked for
  // narrowing).
  let resolveFetch: () => void = () => {};
  globalThis.fetch = (async () =>
    new Promise<Response>((resolve) => {
      resolveFetch = () =>
        resolve({ status: 500, json: async () => ({ error: 'internal_error' }) } as Response);
    })) as typeof globalThis.fetch;

  await wrapper.find('[data-testid="feedback-submit"]').trigger('click');
  await wrapper.vm.$nextTick();
  assert.equal(
    (wrapper.find('[data-testid="feedback-submit"]').element as HTMLButtonElement).disabled,
    true,
  );

  resolveFetch();
  await flushPromises();
  assert.equal(
    (wrapper.find('[data-testid="feedback-submit"]').element as HTMLButtonElement).disabled,
    false,
  );
  assert.equal(
    (wrapper.find('[data-testid="feedback-title"]').element as HTMLInputElement).value,
    'A better tutorial',
  );
});
