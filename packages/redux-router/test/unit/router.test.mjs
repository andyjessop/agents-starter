import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NavigationNotFoundError,
  createRoute,
  createRouter,
  q,
  route,
} from '../../dist/index.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const RAW_NAVIGATE = '@@typed-redux-router/NAVIGATE';
const RAW_PATCH_QUERY = '@@typed-redux-router/PATCH_QUERY';
function rawNavigate(url, options = {}) {
  return {
    type: RAW_NAVIGATE,
    routerKey: options.routerKey ?? 'router',
    payload: {
      url: url.toString(),
      history: options.replace ? 'replace' : 'push',
    },
  };
}

function rawPatchQuery(name, patch, options = {}) {
  return {
    type: RAW_PATCH_QUERY,
    routerKey: options.routerKey ?? 'router',
    payload: {
      name,
      patch,
      history: options.history ?? 'replace',
    },
  };
}

class FakeBrowser {
  constructor(href = 'https://app.test/') {
    this._href = new URL(href).href;
    this._state = null;
    this.baseURI = 'https://app.test/';
    this.origin = 'https://app.test';
    this.host = 'app.test';
    this.pushes = [];
    this.pushStates = [];
    this.replaces = [];
    this.replaceStates = [];
    this.goCalls = [];
    this.titles = [];
    this.backCount = 0;
    this.forwardCount = 0;
    this.listeners = new Map([['popstate', new Set()], ['click', new Set()]]);
  }
  get href() { return this._href; }
  get state() { return this._state; }
  push(url, state = null) {
    this.pushes.push(url);
    this.pushStates.push(state);
    this._href = new URL(url, this.baseURI).href;
    this._state = state;
  }
  replace(url, state = null) {
    this.replaces.push(url);
    this.replaceStates.push(state);
    this._href = new URL(url, this.baseURI).href;
    this._state = state;
  }
  go(delta) { this.goCalls.push(delta); }
  back() { this.backCount += 1; }
  forward() { this.forwardCount += 1; }
  setTitle(title) { this.titles.push(title); }
  addEventListener(type, listener) { this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type).delete(listener); }
  emit(type, event = new Event(type)) { for (const listener of [...this.listeners.get(type)]) listener(event); }
  pop(url, state) {
    this._href = new URL(url, this.baseURI).href;
    this._state = state;
    const event = new Event('popstate');
    Object.defineProperty(event, 'state', { value: state });
    this.emit('popstate', event);
  }
}

function createTestStore(router, initialExtra = {}) {
  let extra = initialExtra;
  let routerState = router.reducer(undefined, { type: '@@init' });
  let dispatch;
  const getState = () => ({ ...extra, router: routerState });
  const api = {
    getState,
    dispatch: (action) => dispatch(action),
  };
  const baseDispatch = (action) => {
    if (action?.type === 'TEST/SET_STATE') extra = action.payload;
    routerState = router.reducer(routerState, action);
    return action;
  };
  dispatch = router.middleware(api)(baseDispatch);
  return {
    dispatch,
    getState,
    setState(value) { dispatch({ type: 'TEST/SET_STATE', payload: value }); },
  };
}

test('query codecs cover valid, invalid, optional and repeated values', () => {
  assert.equal(q.string.parse(['a', 'b']), 'b');
  assert.deepEqual(q.string.format('x'), ['x']);
  assert.throws(() => q.string.parse(undefined), /Missing required value/);
  assert.throws(() => q.string.format(1), /Expected string/);

  assert.equal(q.int.parse(['-12']), -12);
  assert.deepEqual(q.int.format(12), ['12']);
  assert.throws(() => q.int.parse(['1.2']), /Expected integer/);
  assert.throws(() => q.int.parse(['9007199254740992']), /outside the safe range/);
  assert.throws(() => q.int.format(Number.NaN), /Expected safe integer/);

  assert.equal(q.number.parse(['1.25']), 1.25);
  assert.deepEqual(q.number.format(-2.5), ['-2.5']);
  assert.throws(() => q.number.parse(['   ']), /empty string/);
  assert.throws(() => q.number.parse(['wat']), /Expected finite number/);
  assert.throws(() => q.number.format(Infinity), /Expected finite number/);

  assert.equal(q.boolean.parse(['true']), true);
  assert.equal(q.boolean.parse(['1']), true);
  assert.equal(q.boolean.parse(['false']), false);
  assert.equal(q.boolean.parse(['0']), false);
  assert.deepEqual(q.boolean.format(true), ['true']);
  assert.deepEqual(q.boolean.format(false), ['false']);
  assert.throws(() => q.boolean.parse(['yes']), /Expected boolean/);
  assert.throws(() => q.boolean.format('true'), /Expected boolean/);

  const view = q.enum('post', 'comments');
  assert.equal(view.parse(['post']), 'post');
  assert.deepEqual(view.format('comments'), ['comments']);
  assert.throws(() => view.parse(['other']), /Expected one of post, comments/);
  assert.throws(() => view.format('other'), /Expected one of post, comments/);

  const defaultPage = q.default(q.int, 1);
  assert.equal(defaultPage.parse(undefined), 1);
  assert.equal(defaultPage.parse([]), 1);
  assert.equal(defaultPage.parse(['2']), 2);
  assert.deepEqual(defaultPage.format(3), ['3']);
  assert.equal(defaultPage.isDefault(1), true);
  assert.equal(defaultPage.isDefault(2), false);
  assert.throws(() => q.default(q.int, Number.NaN), /Expected safe integer/);
  assert.throws(() => q.default({ optional: false, parse: () => 1, format: () => [] }, 1), /at least one value/);

  const optional = q.optional(q.int);
  assert.equal(optional.parse(undefined), undefined);
  assert.equal(optional.parse([]), undefined);
  assert.equal(optional.parse(['3']), 3);
  assert.deepEqual(optional.format(4), ['4']);

  const ints = q.array(q.int);
  assert.deepEqual(ints.parse(['1', '2']), [1, 2]);
  assert.deepEqual(ints.format([3, 4]), ['3', '4']);
  assert.throws(() => ints.parse(undefined), /Missing required array/);
  assert.throws(() => ints.format([]), /non-empty array/);
  assert.throws(() => ints.format('oops'), /non-empty array/);
});

test('route builders reject malformed route trees and compose children', () => {
  const r = createRoute();
  const tree = {
    users: r('/users/:userId', {
      query: { source: q.optional(q.string) },
      children: (child) => ({
        post: child('/posts/:postId', { query: { view: q.enum('a', 'b') } }),
      }),
    }),
  };
  assert.equal(tree.users.path, '/users/:userId');
  assert.equal(tree.users.children.post.path, '/users/:userId/posts/:postId');
  assert.deepEqual(Object.keys(tree.users.children.post.query), ['source', 'view']);
  const rootTree = r('/', { children: (child) => ({ about: child('/about') }) });
  assert.equal(rootTree.children.about.path, '/about');

  assert.throws(() => r('relative'), /Root route path/);
  assert.throws(() => r('/trailing/'), /must not end/);
  assert.throws(() => r('/a//b'), /empty segments/);
  assert.throws(() => r('/a?x=1'), /query or hash/);
  assert.throws(() => r('/a#x'), /query or hash/);
  assert.throws(() => r('/a/./b'), /must not contain \. segments/);
  assert.throws(() => r('/a/../b'), /must not contain \.\. segments/);
  assert.throws(() => r('/a/foo:id'), /whole segment/);
  assert.throws(() => r('/a/:1bad'), /Invalid route parameter/);

  assert.throws(() => r('/parent', {
    children: (child) => {
      child('relative');
      return {};
    },
  }), /Child route path/);
  assert.throws(() => r('/parent', {
    children: (child) => {
      child('/');
      return {};
    },
  }), /Child route path/);
  assert.throws(() => r('/a', {
    query: { page: q.int },
    children: (child) => ({ bad: child('/b', { query: { page: q.string } }) }),
  }), /already defined by an ancestor/);
});

test('router rejects invalid definitions, duplicate shapes, splats and names', () => {
  assert.throws(() => createRouter({
    routes: { bad: route('/:id/:id') },
    fallback: { name: 'bad', params: { id: 'x' } },
    browser: null,
  }), /Duplicate route parameter/);

  assert.throws(() => createRouter({
    routes: { bad: route('/a/*rest/b') },
    fallback: { name: 'bad', params: { rest: 'x' } },
    browser: null,
  }), /Splat parameter must be the final segment/);

  assert.throws(() => createRouter({
    routes: { bad: route('/:id/*id') },
    fallback: { name: 'bad', params: { id: 'x' } },
    browser: null,
  }), /Duplicate route parameter/);

  assert.throws(() => createRouter({
    routes: { one: route('/a/:id'), two: route('/a/:name') },
    browser: null,
  }), /Ambiguous route patterns/);

  assert.throws(() => createRouter({
    routes: { 'bad.key': route('/x') },
    browser: null,
  }), /Invalid route name/);

  assert.throws(() => createRouter({
    routes: { nope: {} },
    browser: null,
  }), /is not a route/);
});

test('href and match are strict, encoded and route-specific', () => {
  const customEmpty = { optional: false, parse: () => 'x', format: () => [] };
  const routes = {
    home: route('/', { title: 'Home' }),
    literal: route('/a.+/café', { title: ({ hash }) => `Literal ${hash ?? ''}` }),
    item: route('/items/:id', {
      query: {
        view: q.enum('a', 'b'),
        page: q.optional(q.int),
        tags: q.optional(q.array(q.string)),
        limit: q.default(q.int, 20),
      },
    }),
    files: route('/files/*path'),
    empty: route('/empty', { query: { broken: customEmpty } }),
    fallback: route('/404'),
  };
  const router = createRouter({ routes, fallback: 'fallback', browser: null });

  assert.equal(router.href('home'), '/');
  assert.equal(router.href('literal', { hash: 'a b' }), '/a.+/caf%C3%A9#a%20b');
  assert.equal(router.href('item', {
    params: { id: 'a/b c' },
    query: { view: 'a', page: 2, tags: ['x y', 'z'] },
    hash: 'details / ok',
  }), '/items/a%2Fb%20c?view=a&page=2&tags=x+y&tags=z#details%20/%20ok');
  assert.equal(router.href('item', { params: { id: '1' }, query: { view: 'a', limit: 20 } }), '/items/1?view=a');
  assert.equal(router.href('item', { params: { id: '1' }, query: { view: 'a', limit: 30 } }), '/items/1?view=a&limit=30');
  assert.equal(router.href('files', { params: { path: 'a/b c' } }), '/files/a/b%20c');

  assert.throws(() => router.href('missing'), /Unknown route/);
  assert.throws(() => router.href('item', { params: { id: '1' }, query: { view: 'a' }, nope: true }), /Unknown route argument/);
  assert.throws(() => router.href('item', { params: { id: '1', extra: 'x' }, query: { view: 'a' } }), /Unknown parameter/);
  assert.throws(() => router.href('item', { params: {}, query: { view: 'a' } }), /Missing parameter/);
  assert.throws(() => router.href('item', { params: { id: '' }, query: { view: 'a' } }), /Missing parameter/);
  assert.throws(() => router.href('files', { params: { path: '' } }), /Missing splat parameter/);
  assert.throws(() => router.href('item', { params: { id: '1' }, query: { view: 'a', extra: true } }), /Unknown query parameter/);
  assert.throws(() => router.href('item', { params: { id: '1' }, query: {} }), /Missing query parameter/);
  assert.throws(() => router.href('home', { hash: 1 }), /Hash .* must be a string/);
  assert.throws(() => router.href('empty', { query: { broken: 'x' } }), /produced no values/);

  const matched = router.match('/items/a%2Fb%20c?view=b&page=-2&tags=x&tags=y#hello%20world');
  assert.equal(matched.name, 'item');
  assert.deepEqual(matched.params, { id: 'a/b c' });
  assert.deepEqual(matched.query, { view: 'b', page: -2, tags: ['x', 'y'], limit: 20 });
  assert.equal(matched.hash, 'hello world');
  assert.equal(matched.title, '');
  assert.equal(matched.url, '/items/a%2Fb%20c?view=b&page=-2&tags=x&tags=y#hello%20world');
  assert.equal(router.match(new URL('https://elsewhere.test/items/1?view=a')).name, 'item');
  assert.deepEqual(router.match('/items/1?view=a&limit=20').query, { view: 'a', limit: 20 });
  assert.equal(router.match('/items/1?view=nope'), null);
  assert.equal(router.match('/items/1?view=%E0%A4%A'), null);
  assert.equal(router.match('/items/%E0%A4%A?view=a'), null);
  assert.equal(router.match('/items/1?view=a#%E0%A4%A'), null);
  assert.equal(router.match('/nope'), null);
  assert.equal(router.match('/items/1/?view=a').name, 'item');
  assert.equal(router.match('/literal')?.name, undefined);
  assert.equal(router.match('/a.+/caf%C3%A9#x').title, 'Literal x');
});

test('static routes outrank parameters and splats', () => {
  const router = createRouter({
    routes: {
      dynamic: route('/:id'),
      splat: route('/files/*path'),
      static: route('/settings'),
      fileStatic: route('/files/settings'),
    },
    browser: null,
  });
  assert.equal(router.match('/settings').name, 'static');
  assert.equal(router.match('/files/settings').name, 'fileStatic');
  assert.equal(router.match('/files/a/b').name, 'splat');
});

test('reducers ignore foreign and stale actions and selectors narrow state', async () => {
  const router = createRouter({ routes: { home: route('/') }, browser: null, key: 'r' });
  const initial = router.reducer(undefined, null);
  assert.equal(initial, router.initialState);
  assert.equal(router.reducer(initial, { type: 'X' }), initial);
  assert.equal(router.reducer(initial, { type: '@@typed-redux-router/STARTED', routerKey: 'other', payload: {} }), initial);
  assert.equal(router.reducer(initial, { type: 1, routerKey: 'r' }), initial);

  const matched = router.match('/');
  const started = router.reducer(initial, { type: '@@typed-redux-router/STARTED', routerKey: 'r', payload: { id: 2, route: matched } });
  assert.equal(started.status, 'navigating');
  assert.equal(started.navigationId, 2);
  assert.equal(router.reducer(started, { type: '@@typed-redux-router/STARTED', routerKey: 'r', payload: { id: 1, route: matched } }), started);
  assert.equal(router.reducer(started, { type: '@@typed-redux-router/COMMITTED', routerKey: 'r', payload: { id: 1, route: matched } }), started);
  assert.equal(router.reducer(started, { type: '@@typed-redux-router/BLOCKED', routerKey: 'r', payload: { id: 1, route: matched } }), started);
  assert.equal(router.reducer(started, { type: '@@typed-redux-router/FAILED', routerKey: 'r', payload: { id: 1, error: 'x' } }), started);
  assert.equal(router.reducer(started, { type: '@@typed-redux-router/CANCELLED', routerKey: 'r', payload: { id: 1 } }), started);

  const committed = router.reducer(started, { type: '@@typed-redux-router/COMMITTED', routerKey: 'r', payload: { id: 2, route: matched } });
  assert.equal(committed.current.name, 'home');
  const blocked = router.reducer(started, { type: '@@typed-redux-router/BLOCKED', routerKey: 'r', payload: { id: 2, route: matched } });
  assert.equal(blocked.blocked.name, 'home');
  const failed = router.reducer(started, { type: '@@typed-redux-router/FAILED', routerKey: 'r', payload: { id: 2, error: 'boom' } });
  assert.equal(failed.error, 'boom');
  const cancelled = router.reducer(started, { type: '@@typed-redux-router/CANCELLED', routerKey: 'r', payload: { id: 2 } });
  assert.equal(cancelled.status, 'idle');
  assert.equal(router.reducer(started, { type: 'OTHER', routerKey: 'r' }), started);

  assert.equal(router.selectors.current(committed).name, 'home');
  assert.equal(router.selectors.pending(started).name, 'home');
  assert.equal(router.selectors.blocked(blocked).name, 'home');
  assert.equal(router.selectors.status(started), 'navigating');
  assert.equal(router.selectors.error(failed), 'boom');
  assert.equal(router.selectors.route('home')(committed).name, 'home');
  assert.equal(router.selectors.route('home')(initial), null);
  assert.equal(router.actionTypes.navigationBlocked, '@@typed-redux-router/BLOCKED');
  assert.equal(router.actionTypes.navigationFailed, '@@typed-redux-router/FAILED');

  const store = createTestStore(router);
  assert.equal(await store.dispatch(router.navigate('home')), 'committed');
});

test('guards run root to leaf with inherited params/query and current Redux state', async () => {
  const calls = [];
  const r = createRoute();
  const routes = {
    home: r('/'),
    users: r('/users/:userId', {
      query: { source: q.optional(q.string) },
      shouldNavigate(ctx) {
        calls.push(['parent', ctx.params, ctx.query, ctx.hash, ctx.state.auth.allowed, ctx.signal.aborted]);
        return ctx.state.auth.allowed;
      },
      children: (child) => ({
        post: child('/posts/:postId', {
          query: { view: q.enum('post', 'comments') },
          async shouldNavigate(ctx) {
            await Promise.resolve();
            calls.push(['child', ctx.params, ctx.query, ctx.hash, ctx.state.auth.allowed, ctx.signal.aborted]);
            return ctx.query.view === 'post';
          },
        }),
      }),
    }),
    notFound: r('/404'),
  };
  const router = createRouter({ routes, fallback: 'notFound', browser: null });
  const store = createTestStore(router, { auth: { allowed: true } });

  const action = router.navigate('users.post', {
    params: { userId: 'U1', postId: 'P1' },
    query: { source: 'search', view: 'post' },
    hash: 'details',
  });
  assert.equal(await store.dispatch(action), 'committed');
  assert.deepEqual(calls[0], ['parent', { userId: 'U1' }, { source: 'search' }, 'details', true, false]);
  assert.deepEqual(calls[1], ['child', { userId: 'U1', postId: 'P1' }, { source: 'search', view: 'post' }, 'details', true, false]);
  assert.equal(store.getState().router.current.name, 'users.post');

  store.setState({ auth: { allowed: false } });
  calls.length = 0;
  assert.equal(await store.dispatch(router.navigate('users.post', {
    params: { userId: 'U2', postId: 'P2' },
    query: { view: 'post' },
  })), 'blocked');
  assert.equal(calls.length, 1);
  assert.equal(store.getState().router.current.params.userId, 'U1');
  assert.equal(store.getState().router.blocked.params.userId, 'U2');

  store.setState({ auth: { allowed: true } });
  calls.length = 0;
  assert.equal(await store.dispatch(router.navigate('users.post', {
    params: { userId: 'U3', postId: 'P3' },
    query: { view: 'comments' },
  })), 'blocked');
  assert.equal(calls.length, 2);
  assert.equal(store.getState().router.blocked.params.userId, 'U3');
});


test('patchQuery atomically patches the current named route, preserves route state and skips entry guards', async () => {
  const browser = new FakeBrowser('https://app.test/');
  const calls = [];
  const r = createRoute();
  const router = createRouter({
    routes: {
      home: r('/'),
      users: r('/users/:userId', {
        query: { source: q.optional(q.string) },
        shouldNavigate() { calls.push('parent'); return true; },
        children: (child) => ({
          post: child('/posts/:postId', {
            query: {
              view: q.enum('post', 'comments'),
              page: q.default(q.int, 1),
            },
            shouldNavigate({ query }) { calls.push('child'); return query.view === 'post'; },
          }),
        }),
      }),
    },
    browser,
  });
  const store = createTestStore(router);
  await tick();

  assert.equal(await store.dispatch(router.navigate('users.post', {
    params: { userId: 'U1', postId: 'P1' },
    query: { source: 'search', view: 'post' },
    hash: 'details',
  })), 'committed');
  assert.deepEqual(calls, ['parent', 'child']);
  calls.length = 0;

  const defaultAction = router.patchQuery('users.post', { page: 2 });
  assert.equal(defaultAction.payload.history, 'replace');
  assert.equal(await store.dispatch(defaultAction), 'committed');
  assert.deepEqual(calls, []);
  assert.equal(browser.replaces.at(-1), '/users/U1/posts/P1?source=search&view=post&page=2#details');
  assert.deepEqual(store.getState().router.current.params, { userId: 'U1', postId: 'P1' });
  assert.deepEqual(store.getState().router.current.query, { source: 'search', view: 'post', page: 2 });
  assert.equal(store.getState().router.current.hash, 'details');

  assert.equal(await store.dispatch(router.patchQuery(
    'users.post',
    { source: undefined, page: undefined, view: 'comments' },
    { history: 'push' },
  )), 'committed');
  assert.deepEqual(calls, []);
  assert.equal(browser.pushes.at(-1), '/users/U1/posts/P1?view=comments#details');
  assert.deepEqual(store.getState().router.current.query, { view: 'comments', page: 1 });

  calls.length = 0;
  assert.equal(await store.dispatch(router.navigate('users.post', {
    params: { userId: 'U1', postId: 'P1' },
    query: { view: 'comments' },
    hash: 'details',
  })), 'blocked');
  assert.deepEqual(calls, ['parent', 'child']);
  assert.deepEqual(store.getState().router.current.query, { view: 'comments', page: 1 });

  await assert.rejects(store.dispatch(router.patchQuery('home', {})), /while "users.post" is current/);
  assert.equal(store.getState().router.current.name, 'users.post');
  assert.throws(() => router.patchQuery('does-not-exist', {}), /Unknown route/);

  await assert.rejects(store.dispatch(rawPatchQuery('users.post', { nope: true })), /Unknown query parameter nope/);
  await assert.rejects(store.dispatch(rawPatchQuery('users.post', { view: undefined })), /Missing query parameter view/);
});

test('patchQuery supersedes an in-flight navigation and patches the last committed route', async () => {
  let release;
  const r = createRoute();
  const router = createRouter({
    routes: {
      posts: r('/posts', { query: { page: q.default(q.int, 1) } }),
      user: r('/users/:userId', {
        shouldNavigate() {
          return new Promise((resolve) => { release = resolve; });
        },
      }),
    },
    browser: null,
  });
  const store = createTestStore(router);

  assert.equal(await store.dispatch(router.navigate('posts')), 'committed');
  const pending = store.dispatch(router.navigate('user', { params: { userId: 'U2' } }));
  await Promise.resolve();
  assert.equal(store.getState().router.status, 'navigating');
  assert.equal(store.getState().router.pending.name, 'user');

  const patch = store.dispatch(router.patchQuery('posts', { page: 2 }));
  release(true);

  assert.equal(await pending, 'superseded');
  assert.equal(await patch, 'committed');
  assert.equal(store.getState().router.current.name, 'posts');
  assert.deepEqual(store.getState().router.current.query, { page: 2 });
});

test('patchQuery fails deterministically before first commit and for pathological non-round-tripping codecs', async () => {
  const noCurrent = createRouter({ routes: { home: route('/') }, browser: null });
  const noCurrentStore = createTestStore(noCurrent);
  await assert.rejects(noCurrentStore.dispatch(noCurrent.patchQuery('home', {})), /before the first route has committed/);

  let currentParses = 0;
  const currentBreaks = {
    optional: false,
    format(value) { return [String(value)]; },
    parse(values) {
      currentParses += 1;
      if (currentParses > 1) throw new Error('current stopped parsing');
      return values.at(-1);
    },
  };
  const currentRouter = createRouter({
    routes: { item: route('/item', { query: { value: currentBreaks } }) },
    browser: null,
  });
  const currentStore = createTestStore(currentRouter);
  assert.equal(await currentStore.dispatch(currentRouter.navigate('item', { query: { value: 'a' } })), 'committed');
  await assert.rejects(
    currentStore.dispatch(currentRouter.patchQuery('item', { value: 'b' })),
    /current committed URL no longer matches a route/,
  );

  let targetParses = 0;
  const targetBreaks = {
    optional: false,
    format(value) { return [String(value)]; },
    parse(values) {
      targetParses += 1;
      if (targetParses === 3) throw new Error('patched target stopped parsing');
      return values.at(-1);
    },
  };
  const targetRouter = createRouter({
    routes: { item: route('/item', { query: { value: targetBreaks } }) },
    browser: null,
  });
  const targetStore = createTestStore(targetRouter);
  assert.equal(await targetStore.dispatch(targetRouter.navigate('item', { query: { value: 'a' } })), 'committed');
  await assert.rejects(
    targetStore.dispatch(targetRouter.patchQuery('item', { value: 'b' })),
    NavigationNotFoundError,
  );
});

test('async guard navigation is race safe and destroy cancels an active navigation', async () => {
  const waits = [];
  const r = createRoute();
  const router = createRouter({
    routes: {
      home: r('/'),
      slow: r('/slow/:id', {
        shouldNavigate({ signal }) {
          return new Promise((resolve) => waits.push({ resolve, signal }));
        },
      }),
    },
    browser: null,
  });
  const store = createTestStore(router);

  const first = store.dispatch(router.navigate('slow', { params: { id: '1' } }));
  await Promise.resolve();
  assert.equal(waits.length, 1);
  const second = store.dispatch(router.navigate('home'));
  waits[0].resolve(true);
  assert.equal(await first, 'superseded');
  assert.equal(await second, 'committed');
  assert.equal(waits[0].signal.aborted, true);
  assert.equal(store.getState().router.current.name, 'home');

  const rejects = [];
  const rejectRouter = createRouter({
    routes: {
      home: route('/'),
      slow: route('/slow', {
        shouldNavigate({ signal }) {
          return new Promise((_resolve, reject) => rejects.push({ reject, signal }));
        },
      }),
    },
    browser: null,
  });
  const rejectStore = createTestStore(rejectRouter);
  const rejectedNavigation = rejectStore.dispatch(rejectRouter.navigate('slow'));
  await Promise.resolve();
  const winningNavigation = rejectStore.dispatch(rejectRouter.navigate('home'));
  rejects[0].reject(new Error('late rejection'));
  assert.equal(await rejectedNavigation, 'superseded');
  assert.equal(await winningNavigation, 'committed');
  assert.equal(rejects[0].signal.aborted, true);

  const third = store.dispatch(router.navigate('slow', { params: { id: '2' } }));
  await Promise.resolve();
  assert.equal(waits.length, 2);
  router.destroy();
  assert.equal(waits[1].signal.aborted, true);
  waits[1].resolve(true);
  assert.equal(await third, 'superseded');
  assert.equal(store.getState().router.status, 'idle');
  router.destroy();
  await assert.rejects(store.dispatch(router.navigate('home')), /destroyed/);
});

test('guard errors and invalid return values are recorded and rejected', async () => {
  const r = createRoute();
  const router = createRouter({
    routes: {
      bad: r('/bad', { shouldNavigate() { throw new Error('guard exploded'); } }),
      weird: r('/weird', { shouldNavigate() { return 'yes'; } }),
      rejected: r('/rejected', { async shouldNavigate() { throw 'string failure'; } }),
    },
    browser: null,
  });
  const store = createTestStore(router);
  await assert.rejects(store.dispatch(router.navigate('bad')), /guard exploded/);
  assert.equal(store.getState().router.error, 'guard exploded');
  await assert.rejects(store.dispatch(router.navigate('weird')), /must return a boolean/);
  assert.equal(store.getState().router.error, 'shouldNavigate must return a boolean');
  await assert.rejects(store.dispatch(router.navigate('rejected')), (error) => error === 'string failure');
  assert.equal(store.getState().router.error, 'string failure');
});

test('navigation failure, fallback, replace and browser history are deterministic', async () => {
  const browser = new FakeBrowser('https://app.test/');
  const r = createRoute();
  const router = createRouter({
    routes: {
      home: r('/', { title: 'Home' }),
      item: r('/items/:id', { title: ({ params }) => `Item ${params.id}` }),
      missing: r('/404', { title: 'Missing' }),
    },
    fallback: 'missing',
    browser,
  });
  const store = createTestStore(router);
  await tick();
  assert.equal(store.getState().router.current.name, 'home');
  assert.deepEqual(browser.replaces, ['/']);
  assert.equal(browser.titles.at(-1), 'Home');

  assert.equal(await store.dispatch(router.navigate('item', { params: { id: '1' } })), 'committed');
  assert.equal(browser.pushes.at(-1), '/items/1');
  assert.equal(browser.titles.at(-1), 'Item 1');

  assert.equal(await store.dispatch(router.replace('item', { params: { id: '2' } })), 'committed');
  assert.equal(browser.replaces.at(-1), '/items/2');

  assert.equal(await store.dispatch(rawNavigate('/does-not-exist')), 'committed');
  assert.equal(store.getState().router.current.name, 'missing');
  assert.equal(browser.replaces.at(-1), '/404');

  assert.equal(await store.dispatch(rawNavigate(new URL('https://app.test/items/3'), { replace: true })), 'committed');
  assert.equal(browser.replaces.at(-1), '/items/3');
  await assert.rejects(store.dispatch(rawNavigate('https://evil.test/items/4')), /different origin/);
  assert.match(store.getState().router.error, /different origin/);

  router.back();
  router.forward();
  assert.equal(browser.backCount, 1);
  assert.equal(browser.forwardCount, 1);
});


test('full fallback targets and defensive self-match failures are deterministic', async () => {
  const broken = {
    optional: false,
    format(value) { return [String(value)]; },
    parse() { throw new Error('cannot parse'); },
  };

  const fallbackRouter = createRouter({
    routes: {
      home: route('/'),
      fallback: route('/fallback', { query: { broken } }),
    },
    fallback: { name: 'fallback', query: { broken: 'x' } },
    browser: null,
  });
  const fallbackStore = createTestStore(fallbackRouter);
  await assert.rejects(
    fallbackStore.dispatch(rawNavigate('/unknown')),
    /Configured fallback does not match its own route/,
  );
  assert.equal(fallbackStore.getState().router.error, 'Configured fallback does not match its own route');

  const targetRouter = createRouter({
    routes: { bad: route('/bad', { query: { broken } }) },
    browser: null,
  });
  const targetStore = createTestStore(targetRouter);
  await assert.rejects(
    targetStore.dispatch(targetRouter.navigate('bad', { query: { broken: 'x' } })),
    NavigationNotFoundError,
  );
  assert.equal(targetStore.getState().router.error, 'No route matched /bad?broken=x');
});

test('without a fallback, unmatched navigation fails with NavigationNotFoundError', async () => {
  const router = createRouter({ routes: { home: route('/') }, browser: null });
  const store = createTestStore(router);
  await assert.rejects(store.dispatch(rawNavigate('/missing')), (error) => {
    assert.ok(error instanceof NavigationNotFoundError);
    assert.equal(error.url, '/missing');
    assert.equal(error.name, 'NavigationNotFoundError');
    return true;
  });
  assert.equal(store.getState().router.error, 'No route matched /missing');
});

test('popstate blocking restores the prior history position without replacing the denied entry', async () => {
  const browser = new FakeBrowser('https://app.test/');
  let allowed = true;
  let throws = false;
  const r = createRoute();
  const router = createRouter({
    routes: {
      home: r('/'),
      protected: r('/protected', {
        shouldNavigate() {
          if (throws) throw new Error('pop failure');
          return allowed;
        },
      }),
    },
    browser,
  });
  const store = createTestStore(router);
  await tick();
  const initialState = browser.replaceStates.at(-1);

  assert.equal(await store.dispatch(router.navigate('protected')), 'committed');
  const protectedState = browser.pushStates.at(-1);
  assert.equal(browser.href, 'https://app.test/protected');

  assert.equal(await store.dispatch(router.navigate('home')), 'committed');
  const homeState = browser.pushStates.at(-1);
  assert.equal(browser.href, 'https://app.test/');

  allowed = false;
  browser.pop('https://app.test/protected', protectedState);
  await tick();
  assert.equal(store.getState().router.current.name, 'home');
  assert.equal(store.getState().router.blocked.name, 'protected');
  assert.equal(browser.href, 'https://app.test/protected');
  assert.equal(browser.goCalls.at(-1), 1);

  const navigationId = store.getState().router.navigationId;
  browser.pop('https://app.test/', homeState);
  await tick();
  assert.equal(browser.href, 'https://app.test/');
  assert.equal(store.getState().router.current.name, 'home');
  assert.equal(store.getState().router.navigationId, navigationId);

  allowed = true;
  throws = true;
  browser._href = 'https://app.test/protected';
  browser._state = null;
  browser.emit('popstate');
  await tick();
  assert.equal(store.getState().router.error, 'pop failure');
  assert.equal(browser.href, 'https://app.test/');
  assert.equal(browser.replaces.at(-1), '/');

  assert.ok(initialState['@@typed-redux-router']);
});

test('rapid popstate traversals supersede an older async guard without stale history restoration', async () => {
  const browser = new FakeBrowser('https://app.test/');
  let defer = false;
  let release;
  const r = createRoute();
  const router = createRouter({
    routes: {
      home: r('/'),
      protected: r('/protected', {
        shouldNavigate() {
          if (!defer) return true;
          return new Promise((resolve) => { release = resolve; });
        },
      }),
    },
    browser,
  });
  const store = createTestStore(router);
  await tick();
  const initialState = browser.replaceStates.at(-1);
  assert.equal(await store.dispatch(router.navigate('protected')), 'committed');
  const protectedState = browser.pushStates.at(-1);
  assert.equal(await store.dispatch(router.navigate('home')), 'committed');

  defer = true;
  browser.pop('/protected', protectedState);
  await Promise.resolve();
  assert.equal(store.getState().router.status, 'navigating');
  assert.equal(store.getState().router.pending.name, 'protected');

  browser.pop('/', initialState);
  await tick();
  assert.equal(store.getState().router.current.name, 'home');
  assert.equal(browser.href, 'https://app.test/');

  release(false);
  await tick();
  assert.deepEqual(browser.goCalls, []);
  assert.equal(store.getState().router.current.name, 'home');
  assert.equal(store.getState().router.blocked, null);
});

test('invalid or foreign history metadata is treated as untracked popstate', async () => {
  const browser = new FakeBrowser('https://app.test/');
  const router = createRouter({ routes: { home: route('/') }, browser });
  const store = createTestStore(router);
  await tick();

  const states = [
    null,
    {},
    { '@@typed-redux-router': null },
    { '@@typed-redux-router': { routerKey: 'other', index: 0 } },
    { '@@typed-redux-router': { routerKey: 'router', index: 1.5 } },
  ];

  for (const state of states) {
    browser.pop('/', state);
    await tick();
    assert.equal(store.getState().router.current.name, 'home');
  }
});

test('untracked history entries fall back to URL restoration without inventing an index', async () => {
  const browser = new FakeBrowser('https://app.test/');
  let allowed = true;
  const router = createRouter({
    routes: {
      home: route('/'),
      protected: route('/protected', { shouldNavigate: () => allowed }),
    },
    browser,
  });
  const store = createTestStore(router);
  await tick();

  browser.pop('/', null);
  await tick();
  assert.equal(store.getState().router.current.name, 'home');

  allowed = false;
  browser.pop('/protected', null);
  await tick();
  assert.equal(store.getState().router.blocked.name, 'protected');
  assert.equal(browser.replaces.at(-1), '/');
  assert.equal(browser.replaceStates.at(-1), null);
});

test('middleware passes foreign actions through, installs once, cleans listeners and supports null browser', async () => {
  const browser = new FakeBrowser();
  const router = createRouter({ routes: { home: route('/') }, browser });
  const store = createTestStore(router);
  const foreign = { type: 'FOREIGN', value: 1 };
  assert.equal(store.dispatch(foreign), foreign);
  const sameRouterForeign = { type: 'FOREIGN', routerKey: 'router', value: 2 };
  assert.equal(store.dispatch(sameRouterForeign), sameRouterForeign);
  const wrongRouter = { ...router.navigate('home'), routerKey: 'other' };
  assert.equal(store.dispatch(wrongRouter), wrongRouter);
  await tick();
  assert.equal(browser.listeners.get('popstate').size, 1);
  assert.equal(browser.listeners.get('click').size, 1);
  assert.throws(() => createTestStore(router), /installed once/);
  router.destroy();
  assert.equal(browser.listeners.get('popstate').size, 0);
  assert.equal(browser.listeners.get('click').size, 0);

  const noBrowser = createRouter({ routes: { home: route('/') }, browser: null });
  const noBrowserStore = createTestStore(noBrowser);
  assert.equal(await noBrowserStore.dispatch(noBrowser.navigate('home')), 'committed');
  noBrowser.back();
  noBrowser.forward();
  noBrowser.destroy();
});


test('anchor interception follows native browser navigation rules', async () => {
  const oldMouseEvent = globalThis.MouseEvent;
  const oldAnchor = globalThis.HTMLAnchorElement;

  class TestAnchor {
    constructor(href, attributes = {}) {
      this.href = href;
      this.rel = attributes.rel ?? '';
      this.attributes = attributes;
    }
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
    getAttribute(name) { return this.attributes[name] ?? null; }
  }

  class TestMouseEvent {
    constructor(options = {}) {
      this.defaultPrevented = options.defaultPrevented ?? false;
      this.button = options.button ?? 0;
      this.metaKey = options.metaKey ?? false;
      this.ctrlKey = options.ctrlKey ?? false;
      this.shiftKey = options.shiftKey ?? false;
      this.altKey = options.altKey ?? false;
      this.target = options.target ?? null;
      this.path = options.path;
      this.prevented = false;
      if (options.noComposedPath) this.composedPath = undefined;
    }
    composedPath() { return this.path ?? [this.target]; }
    preventDefault() { this.defaultPrevented = true; this.prevented = true; }
  }

  globalThis.MouseEvent = TestMouseEvent;
  globalThis.HTMLAnchorElement = TestAnchor;

  try {
    const browser = new FakeBrowser('https://app.test/');
    const router = createRouter({
      routes: {
        home: route('/'),
        item: route('/items/:id'),
        bad: route('/bad', { shouldNavigate() { throw new Error('click guard failed'); } }),
        fallback: route('/404'),
      },
      fallback: 'fallback',
      browser,
    });
    const store = createTestStore(router);
    await tick();
    const click = [...browser.listeners.get('click')][0];

    click(new Event('click'));

    for (const options of [
      { defaultPrevented: true },
      { button: 1 },
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
    ]) {
      const event = new TestMouseEvent({ ...options, target: new TestAnchor('https://app.test/items/1') });
      click(event);
      assert.equal(event.prevented, false);
    }

    for (const anchor of [
      new TestAnchor(''),
      new TestAnchor('https://app.test/items/1', { download: '' }),
      new TestAnchor('https://app.test/items/1', { rel: 'external' }),
      new TestAnchor('https://app.test/items/1', { target: '_blank' }),
      new TestAnchor('http://['),
      new TestAnchor('mailto:test@example.com'),
      new TestAnchor('https://other.test/items/1'),
      new TestAnchor(browser.href),
    ]) {
      const event = new TestMouseEvent({ target: anchor });
      click(event);
      assert.equal(event.prevented, false);
    }

    const nested = { nodeName: 'SPAN' };
    const selfTarget = new TestAnchor('https://app.test/items/42', { target: '_self' });
    const event = new TestMouseEvent({ target: nested, path: [nested, selfTarget] });
    click(event);
    await tick();
    assert.equal(event.prevented, true);
    assert.equal(browser.href, 'https://app.test/items/42');
    assert.equal(store.getState().router.current.name, 'item');

    const fallbackEvent = new TestMouseEvent({
      target: new TestAnchor('https://app.test/unknown'),
      noComposedPath: true,
    });
    click(fallbackEvent);
    await tick();
    assert.equal(fallbackEvent.prevented, true);
    assert.equal(store.getState().router.current.name, 'fallback');
    assert.equal(browser.href, 'https://app.test/404');

    const badEvent = new TestMouseEvent({ target: new TestAnchor('https://app.test/bad') });
    click(badEvent);
    await tick();
    assert.equal(badEvent.prevented, true);
    assert.equal(store.getState().router.error, 'click guard failed');

    router.destroy();

    const strictBrowser = new FakeBrowser('https://app.test/');
    const strictRouter = createRouter({ routes: { home: route('/'), item: route('/items/:id') }, browser: strictBrowser });
    createTestStore(strictRouter);
    await tick();
    const strictClick = [...strictBrowser.listeners.get('click')][0];
    const unknownEvent = new TestMouseEvent({ target: new TestAnchor('https://app.test/unknown') });
    strictClick(unknownEvent);
    assert.equal(unknownEvent.prevented, false);
    strictRouter.destroy();
  } finally {
    if (oldMouseEvent === undefined) delete globalThis.MouseEvent; else globalThis.MouseEvent = oldMouseEvent;
    if (oldAnchor === undefined) delete globalThis.HTMLAnchorElement; else globalThis.HTMLAnchorElement = oldAnchor;
  }
});


test('default browser absence, destroyed startup and rejected startup are safe', async () => {
  const noWindowRouter = createRouter({ routes: { home: route('/') } });
  const noWindowStore = createTestStore(noWindowRouter);
  assert.equal(await noWindowStore.dispatch(noWindowRouter.navigate('home')), 'committed');
  noWindowRouter.destroy();

  const eagerBrowser = new FakeBrowser('https://app.test/');
  const eagerRouter = createRouter({ routes: { home: route('/'), other: route('/other') }, browser: eagerBrowser });
  const eagerStore = createTestStore(eagerRouter);
  assert.equal(await eagerStore.dispatch(eagerRouter.navigate('other')), 'committed');
  assert.equal(eagerBrowser.pushStates.at(-1)['@@typed-redux-router'].index, 0);
  await tick();
  assert.equal(eagerStore.getState().router.current.name, 'other');
  eagerRouter.destroy();

  const immediateBrowser = new FakeBrowser('https://app.test/');
  const immediateRouter = createRouter({ routes: { home: route('/') }, browser: immediateBrowser });
  createTestStore(immediateRouter);
  const savedPop = [...immediateBrowser.listeners.get('popstate')][0];
  immediateRouter.destroy();
  savedPop(new Event('popstate'));
  await tick();
  assert.equal(immediateBrowser.replaces.length, 0);

  const failingBrowser = new FakeBrowser('https://app.test/bad');
  const failingRouter = createRouter({
    routes: { bad: route('/bad', { shouldNavigate() { throw new Error('startup failed'); } }) },
    browser: failingBrowser,
  });
  const failingStore = createTestStore(failingRouter);
  await tick();
  assert.equal(failingStore.getState().router.error, 'startup failed');
  failingRouter.destroy();
});

test('default browser port works against minimal DOM-like globals', async () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const calls = { push: [], pushStates: [], replace: [], replaceStates: [], go: [], title: '', add: [], remove: [], back: 0, forward: 0 };
  const listeners = new Map();
  globalThis.window = {
    location: { href: 'https://dom.test/', origin: 'https://dom.test', host: 'dom.test' },
    history: {
      state: null,
      pushState(state, _t, url) { calls.push.push(url); calls.pushStates.push(state); this.state = state; globalThis.window.location.href = new URL(url, 'https://dom.test/').href; },
      replaceState(state, _t, url) { calls.replace.push(url); calls.replaceStates.push(state); this.state = state; globalThis.window.location.href = new URL(url, 'https://dom.test/').href; },
      go(delta) { calls.go.push(delta); },
      back() { calls.back += 1; },
      forward() { calls.forward += 1; },
    },
    addEventListener(type, listener) { calls.add.push(type); listeners.set(type, listener); },
    removeEventListener(type) { calls.remove.push(type); listeners.delete(type); },
  };
  globalThis.document = {
    baseURI: 'https://dom.test/',
    get title() { return calls.title; },
    set title(value) { calls.title = value; },
  };
  try {
    let allowed = true;
    const router = createRouter({
      routes: {
        home: route('/', { title: 'DOM Home' }),
        other: route('/other', { title: 'Other', shouldNavigate: () => allowed }),
      },
    });
    const store = createTestStore(router);
    await tick();
    assert.equal(store.getState().router.current.name, 'home');
    assert.deepEqual(calls.replace, ['/']);
    assert.equal(calls.title, 'DOM Home');
    assert.equal(await store.dispatch(router.navigate('other')), 'committed');
    const otherState = calls.pushStates.at(-1);
    assert.deepEqual(calls.push, ['/other']);
    assert.equal(calls.title, 'Other');
    assert.equal(await store.dispatch(router.navigate('home')), 'committed');
    allowed = false;
    globalThis.window.location.href = 'https://dom.test/other';
    globalThis.window.history.state = otherState;
    listeners.get('popstate')({ state: otherState });
    await tick();
    assert.deepEqual(calls.go, [1]);
    router.back();
    router.forward();
    assert.equal(calls.back, 1);
    assert.equal(calls.forward, 1);
    router.destroy();
    assert.deepEqual(calls.add.sort(), ['click', 'popstate']);
    assert.deepEqual(calls.remove.sort(), ['click', 'popstate']);
  } finally {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
  }
});
