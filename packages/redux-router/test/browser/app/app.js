import { applyMiddleware, combineReducers, legacy_createStore } from '/node_modules/redux/dist/redux.browser.mjs';
import { createRoute, createRouter, q } from '/dist/index.js';

const guardLog = [];
let guardDelay = 0;
const route = createRoute();

const routes = {
  home: route('/', { title: 'Home' }),
  users: route('/users/:userId', {
    query: { source: q.optional(q.string) },
    async shouldNavigate(context) {
      guardLog.push(`parent:${context.params.userId}:${context.state.auth.allowed}`);
      if (guardDelay) {
        await new Promise((resolve) => setTimeout(resolve, guardDelay));
        guardLog.push(`parent-settled:${context.params.userId}:${context.state.auth.allowed}`);
      }
      return context.state.auth.allowed;
    },
    children: (child) => ({
      post: child('/posts/:postId', {
        query: {
          view: q.enum('post', 'comments'),
          page: q.default(q.int, 1),
        },
        title: ({ params }) => `Post ${params.postId}`,
        shouldNavigate(context) {
          guardLog.push(`child:${context.params.postId}:${context.query.view}`);
          return context.query.view !== 'comments';
        },
      }),
    }),
  }),
  notFound: route('/404', { title: 'Not found' }),
};

const router = createRouter({ routes, fallback: 'notFound' });

function auth(state = { allowed: true }, action) {
  return action.type === 'APP/SET_ALLOWED'
    ? { allowed: Boolean(action.allowed) }
    : state;
}

const store = legacy_createStore(
  combineReducers({ auth, router: router.reducer }),
  applyMiddleware(router.middleware),
);

function render() {
  document.querySelector('#state').textContent = JSON.stringify(store.getState(), null, 2);
}

store.subscribe(render);
render();

window.__routerTest = {
  router,
  state: () => store.getState(),
  guardLog,
  clearGuardLog: () => { guardLog.length = 0; },
  setAllowed: (allowed) => store.dispatch({ type: 'APP/SET_ALLOWED', allowed }),
  setGuardDelay: (milliseconds) => { guardDelay = milliseconds; },
  patchPostQuery: (patch, options) => store.dispatch(router.patchQuery('users.post', patch, options)),
  navigatePost: (userId, postId, view = 'post') => store.dispatch(router.navigate('users.post', {
    params: { userId, postId },
    query: { view },
  })),
};
