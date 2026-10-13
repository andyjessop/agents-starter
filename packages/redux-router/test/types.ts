import {
  createRoute,
  createRouter,
  q,
  type MatchedRouteForName,
  type RouteName,
} from '../src/index.js';

type AppState = {
  auth: { signedIn: boolean };
  users: { allowed: ReadonlySet<string> };
};

const route = createRoute<AppState>();

const routes = {
  home: route('/', { title: 'Home' }),
  users: route('/users/:userId', {
    query: {
      source: q.optional(q.enum('search', 'inbox')),
    },
    shouldNavigate({ params, query, state, hash, signal }) {
      const userId: string = params.userId;
      const source: 'search' | 'inbox' | undefined = query.source;
      const signedIn: boolean = state.auth.signedIn;
      const typedHash: string | undefined = hash;
      const typedSignal: AbortSignal = signal;
      return signedIn && state.users.allowed.has(userId) && source !== 'inbox' && typedHash !== 'blocked' && !typedSignal.aborted;
    },
    children: (route) => ({
      post: route('/posts/:postId', {
        query: {
          view: q.enum('post', 'comments'),
          page: q.default(q.int, 1),
        },
        shouldNavigate({ params, query, state }) {
          const userId: string = params.userId;
          const postId: string = params.postId;
          const source: 'search' | 'inbox' | undefined = query.source;
          const view: 'post' | 'comments' = query.view;
          const page: number = query.page;
          return state.auth.signedIn && userId !== postId && source !== undefined && view !== 'comments' && page !== 0;
        },
      }),
      files: route('/files/*path'),
    }),
  }),
  login: route('/login'),
  notFound: route('/404'),
} as const;

const router = createRouter({ routes, fallback: 'notFound', browser: null });

type Names = RouteName<typeof routes>;
const name1: Names = 'users';
const name2: Names = 'users.post';
const name3: Names = 'users.files';
void [name1, name2, name3];

router.navigate('home');
// @ts-expect-error raw URL navigation is intentionally not part of the public API
router.navigateUrl('/untyped');
router.navigate('users', { params: { userId: 'USER-1' } });
router.navigate('users.post', {
  params: { userId: 'USER-1', postId: 'POST-1' },
  query: { source: 'search', view: 'post' },
  hash: 'details',
});
router.navigate('users.files', {
  params: { userId: 'USER-1', path: 'a/b/c' },
});
router.href('users.post', {
  params: { userId: 'USER-1', postId: 'POST-1' },
  query: { view: 'comments' },
});

router.patchQuery('users.post', { page: 3 });
router.patchQuery('users.post', { source: 'search', view: 'comments', page: undefined });
router.patchQuery('users.post', { source: undefined }, { history: 'push' });
router.patchQuery('home', {});
// @ts-expect-error unknown route
router.patchQuery('user.post', {});
// @ts-expect-error query patch is exact for the named route
router.patchQuery('users.post', { nope: true });
// @ts-expect-error page is a number
router.patchQuery('users.post', { page: '3' });
// @ts-expect-error view is a literal union
router.patchQuery('users.post', { view: 'scan' });
// @ts-expect-error required query values cannot be cleared
router.patchQuery('users.post', { view: undefined });
// @ts-expect-error patch history is only push or replace
router.patchQuery('users.post', {}, { history: 'none' });

// @ts-expect-error unknown route
router.navigate('user.post');
// @ts-expect-error child route requires inherited userId
router.navigate('users.post', { params: { postId: 'POST-1' }, query: { view: 'post' } });
// @ts-expect-error child route requires local postId
router.navigate('users.post', { params: { userId: 'USER-1' }, query: { view: 'post' } });
// @ts-expect-error view is required
router.navigate('users.post', { params: { userId: 'USER-1', postId: 'POST-1' } });
// @ts-expect-error view is a literal union
router.navigate('users.post', { params: { userId: 'USER-1', postId: 'POST-1' }, query: { view: 'scan' } });
// @ts-expect-error page is a number
router.navigate('users.post', { params: { userId: 'USER-1', postId: 'POST-1' }, query: { view: 'post', page: '2' } });
// @ts-expect-error extra params are rejected
router.navigate('users.post', { params: { userId: 'USER-1', postId: 'POST-1', nope: 'x' }, query: { view: 'post' } });
// @ts-expect-error extra query fields are rejected
router.navigate('users.post', { params: { userId: 'USER-1', postId: 'POST-1' }, query: { view: 'post', nope: true } });
// @ts-expect-error hash must be a string
router.navigate('home', { hash: 123 });

const matched = router.match('/users/USER-1/posts/POST-1?view=post');
if (matched?.name === 'users.post') {
  const userId: string = matched.params.userId;
  const postId: string = matched.params.postId;
  const view: 'post' | 'comments' = matched.query.view;
  const page: number = matched.query.page;
  void [userId, postId, view, page];
}

const selectPost = router.selectors.route('users.post');
type Post = NonNullable<ReturnType<typeof selectPost>>;
type ExpectedPost = MatchedRouteForName<typeof routes, 'users.post'>;
const typeEquality: Post extends ExpectedPost ? ExpectedPost extends Post ? true : false : false = true;
void typeEquality;

route('/a', {
  query: { page: q.int },
  children: (child) => ({
    // @ts-expect-error inherited query keys cannot be shadowed
    bad: child('/b', { query: { page: q.string } }),
  }),
});

// @ts-expect-error root routes must start with '/'
route('relative');
route('/parent', {
  children: (child) => ({
    // @ts-expect-error child fragments must start with '/'
    badRelative: child('relative'),
    // @ts-expect-error '/' would create an ambiguous index child
    badRoot: child('/'),
  }),
});

const fallbackRoutes = {
  protected: route('/protected/:id'),
  safe: route('/safe'),
} as const;
// @ts-expect-error shorthand fallback cannot target a route requiring params
createRouter({ routes: fallbackRoutes, fallback: 'protected', browser: null });
createRouter({ routes: fallbackRoutes, fallback: { name: 'protected', params: { id: '1' } }, browser: null });
