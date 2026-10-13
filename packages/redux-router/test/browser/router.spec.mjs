import { expect, test } from '@playwright/test';

async function waitReady(page) {
  await page.waitForFunction(() => {
    const testApi = window.__routerTest;
    return testApi?.state().router.status === 'idle' && testApi.state().router.current;
  });
}

async function current(page) {
  return page.evaluate(() => window.__routerTest.state().router.current);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitReady(page);
});

test('boots from the real browser location and updates the document title', async ({ page }) => {
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle('Home');
  await expect.poll(async () => (await current(page)).name).toBe('home');
});

test('intercepts nested anchor clicks and runs inherited guards root to leaf', async ({ page }) => {
  await page.evaluate(() => window.__routerTest.clearGuardLog());
  await page.locator('#post-label').click();

  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1\?view=post#details$/);
  await expect(page).toHaveTitle('Post P1');

  const route = await current(page);
  expect(route.name).toBe('users.post');
  expect(route.params).toEqual({ userId: 'U1', postId: 'P1' });
  expect(route.query).toEqual({ view: 'post', page: 1 });
  expect(route.hash).toBe('details');
  expect(await page.evaluate(() => window.__routerTest.guardLog)).toEqual([
    'parent:U1:true',
    'child:P1:post',
  ]);
});

test('patchQuery is atomic, default-aware, and does not rerun entry guards', async ({ page }) => {
  await page.locator('#post-label').click();
  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1\?view=post#details$/);

  await page.evaluate(() => window.__routerTest.clearGuardLog());
  await page.evaluate(() => window.__routerTest.patchPostQuery({ source: 'feed', page: 2 }));

  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1\?source=feed&view=post&page=2#details$/);
  expect(await page.evaluate(() => window.__routerTest.guardLog)).toEqual([]);
  expect((await current(page)).query).toEqual({ source: 'feed', view: 'post', page: 2 });

  await page.evaluate(() => window.__routerTest.patchPostQuery(
    { source: undefined, page: undefined },
    { history: 'push' },
  ));
  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1\?view=post#details$/);
  expect((await current(page)).query).toEqual({ view: 'post', page: 1 });

  await page.evaluate(() => window.__routerTest.clearGuardLog());
  await page.goBack({ waitUntil: 'commit' });
  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1\?source=feed&view=post&page=2#details$/);
  await expect.poll(async () => (await current(page)).query.source).toBe('feed');
  expect(await page.evaluate(() => window.__routerTest.guardLog)).toEqual([
    'parent:U1:true',
    'child:P1:post',
  ]);
});

test('patchQuery supersedes a pending guarded navigation and patches the committed route', async ({ page }) => {
  await page.locator('#post-label').click();
  await page.evaluate(() => {
    window.__routerTest.setGuardDelay(150);
    window.__routerTest.clearGuardLog();
    window.__pendingNavigationResult = undefined;
    window.__routerTest.navigatePost('U2', 'P2').then((result) => {
      window.__pendingNavigationResult = result;
    });
  });

  await expect.poll(async () => page.evaluate(() => window.__routerTest.state().router.pending?.params.userId)).toBe('U2');
  await page.evaluate(() => window.__routerTest.patchPostQuery({ source: 'feed' }));

  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1\?source=feed&view=post#details$/);
  await expect.poll(async () => page.evaluate(() => window.__pendingNavigationResult)).toBe('superseded');
  expect((await current(page)).params).toEqual({ userId: 'U1', postId: 'P1' });
});

test('a parent guard blocks its entire subtree without mutating browser history', async ({ page }) => {
  await page.locator('#post-label').click();
  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1/);
  const before = page.url();

  await page.evaluate(() => window.__routerTest.setAllowed(false));
  await page.locator('#post-two').click();

  await expect.poll(async () => page.evaluate(() => window.__routerTest.state().router.blocked?.params.userId)).toBe('U2');
  expect(page.url()).toBe(before);
  expect((await current(page)).params.userId).toBe('U1');
});

test('a child guard can independently block after its parent allowed navigation', async ({ page }) => {
  await page.evaluate(() => window.__routerTest.clearGuardLog());
  await page.locator('#comments').click();

  await expect.poll(async () => page.evaluate(() => window.__routerTest.state().router.blocked?.params.userId)).toBe('U3');
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => window.__routerTest.guardLog)).toEqual([
    'parent:U3:true',
    'child:P3:comments',
  ]);
});

test('unknown same-origin URLs use the configured fallback', async ({ page }) => {
  await page.locator('#unknown').click();

  await expect(page).toHaveURL(/\/404$/);
  await expect(page).toHaveTitle('Not found');
  expect((await current(page)).name).toBe('notFound');
});

test('blocked Back restores the prior history position without overwriting the denied entry', async ({ page }) => {
  await page.locator('#post-label').click();
  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1/);
  await page.locator('#home').click();
  await expect(page).toHaveURL(/\/$/);
  const historyLength = await page.evaluate(() => history.length);

  await page.evaluate(() => window.__routerTest.setAllowed(false));
  await page.goBack({ waitUntil: 'commit' });

  await expect.poll(async () => page.evaluate(() => window.__routerTest.state().router.blocked?.name)).toBe('users.post');
  await expect(page).toHaveURL(/\/$/);
  expect((await current(page)).name).toBe('home');
  expect(await page.evaluate(() => history.length)).toBe(historyLength);

  await page.evaluate(() => window.__routerTest.setAllowed(true));
  await page.goBack({ waitUntil: 'commit' });
  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1\?view=post#details$/);
  await expect.poll(async () => (await current(page)).name).toBe('users.post');

  await page.goForward({ waitUntil: 'commit' });
  await expect(page).toHaveURL(/\/$/);
});

test('rapid Back traversals supersede an older async guard without stale restoration', async ({ page }) => {
  await page.locator('#post-label').click();
  await page.locator('#home').click();
  await expect(page).toHaveURL(/\/$/);

  await page.evaluate(() => {
    window.__routerTest.setAllowed(false);
    window.__routerTest.setGuardDelay(120);
    history.back();
    setTimeout(() => history.back(), 10);
  });

  await expect.poll(async () => page.evaluate(() =>
    window.__routerTest.guardLog.includes('parent-settled:U1:false')
  )).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.__routerTest.state().router.status)).toBe('idle');
  await expect(page).toHaveURL(/\/$/);
  expect((await current(page)).name).toBe('home');

  await page.evaluate(() => {
    window.__routerTest.setAllowed(true);
    window.__routerTest.setGuardDelay(0);
  });
  await page.goForward({ waitUntil: 'commit' });
  await expect(page).toHaveURL(/\/users\/U1\/posts\/P1\?view=post#details$/);
});

test('deep links are matched during middleware startup and receive query defaults', async ({ page }) => {
  await page.goto('/users/U9/posts/P9?view=post#deep');
  await waitReady(page);

  const route = await current(page);
  expect(route.name).toBe('users.post');
  expect(route.params).toEqual({ userId: 'U9', postId: 'P9' });
  expect(route.query).toEqual({ view: 'post', page: 1 });
  expect(route.hash).toBe('deep');
  await expect(page).toHaveTitle('Post P9');
});

test('non-self targets preserve native browser behaviour', async ({ page, context }) => {
  await page.locator('#external').evaluate((anchor) => {
    anchor.setAttribute('href', '/');
    anchor.setAttribute('target', '_blank');
  });

  const popupPromise = context.waitForEvent('page');
  await page.locator('#external').click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup).toHaveURL(/\/$/);
  await popup.close();

  await expect(page).toHaveURL(/\/$/);
  expect((await current(page)).name).toBe('home');
});
