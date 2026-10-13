import type { Middleware } from 'redux';

export type MaybePromise<T> = T | Promise<T>;

type Simplify<T> = { [K in keyof T]: T[K] } & {};
type StringKey<T> = Extract<keyof T, string>;
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T];

type SegmentParam<S extends string> =
  S extends `:${infer P}` ? P :
  S extends `*${infer P}` ? P :
  never;

type PathParamNames<Path extends string> =
  Path extends `${infer Head}/${infer Tail}`
    ? SegmentParam<Head> | PathParamNames<Tail>
    : SegmentParam<Path>;

export type PathParams<Path extends string> =
  [PathParamNames<Path>] extends [never]
    ? {}
    : { [K in PathParamNames<Path>]: string };

export interface QueryCodec<
  T,
  InputOptional extends boolean = false,
  OutputOptional extends boolean = InputOptional,
> {
  readonly optional: InputOptional;
  readonly outputOptional?: OutputOptional;
  readonly isDefault?: (value: T) => boolean;
  parse(values: readonly string[] | undefined): T | undefined;
  format(value: T): readonly string[];
}

type AnyCodec = QueryCodec<any, any, any>;
export type QuerySchema = Readonly<Record<string, AnyCodec>>;

type CodecValue<C> = C extends QueryCodec<infer T, any, any> ? T : never;
type InputOptionalCodecKeys<S extends QuerySchema> = {
  [K in keyof S]-?: S[K] extends QueryCodec<any, true, any> ? K : never
}[keyof S];
type OutputOptionalCodecKeys<S extends QuerySchema> = {
  [K in keyof S]-?: S[K] extends QueryCodec<any, any, true> ? K : never
}[keyof S];
type RequiredInputCodecKeys<S extends QuerySchema> = Exclude<keyof S, InputOptionalCodecKeys<S>>;
type RequiredOutputCodecKeys<S extends QuerySchema> = Exclude<keyof S, OutputOptionalCodecKeys<S>>;

export type QueryInput<S extends QuerySchema> = Simplify<
  { [K in RequiredInputCodecKeys<S>]: CodecValue<S[K]> } &
  { [K in InputOptionalCodecKeys<S>]?: CodecValue<S[K]> }
>;

export type QueryValue<S extends QuerySchema> = Simplify<
  { [K in RequiredOutputCodecKeys<S>]: CodecValue<S[K]> } &
  { [K in OutputOptionalCodecKeys<S>]?: CodecValue<S[K]> }
>;

export type QueryPatch<S extends QuerySchema> = Simplify<
  { [K in RequiredInputCodecKeys<S>]?: CodecValue<S[K]> } &
  { [K in InputOptionalCodecKeys<S>]?: CodecValue<S[K]> | undefined }
>;

function scalarCodec<T>(
  parseOne: (value: string) => T,
  formatOne: (value: T) => string,
): QueryCodec<T, false, false> {
  return {
    optional: false,
    parse(values) {
      if (!values?.length) throw new Error('Missing required value');
      return parseOne(values[values.length - 1]!);
    },
    format(value) {
      return [formatOne(value)];
    },
  };
}

const stringCodec = scalarCodec<string>(
  (value) => value,
  (value) => {
    if (typeof value !== 'string') throw new Error('Expected string');
    return value;
  },
);

const intCodec = scalarCodec<number>(
  (value) => {
    if (!/^-?\d+$/.test(value)) throw new Error(`Expected integer, got ${JSON.stringify(value)}`);
    const result = Number(value);
    if (!Number.isSafeInteger(result)) throw new Error(`Integer is outside the safe range: ${value}`);
    return result;
  },
  (value) => {
    if (!Number.isSafeInteger(value)) throw new Error(`Expected safe integer, got ${String(value)}`);
    return String(value);
  },
);

const numberCodec = scalarCodec<number>(
  (value) => {
    if (value.trim() === '') throw new Error('Expected number, got an empty string');
    const result = Number(value);
    if (!Number.isFinite(result)) throw new Error(`Expected finite number, got ${JSON.stringify(value)}`);
    return result;
  },
  (value) => {
    if (!Number.isFinite(value)) throw new Error(`Expected finite number, got ${String(value)}`);
    return String(value);
  },
);

const booleanCodec = scalarCodec<boolean>(
  (value) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new Error(`Expected boolean, got ${JSON.stringify(value)}`);
  },
  (value) => {
    if (typeof value !== 'boolean') throw new Error('Expected boolean');
    return value ? 'true' : 'false';
  },
);

export const q = {
  string: stringCodec,
  int: intCodec,
  number: numberCodec,
  boolean: booleanCodec,

  enum<const Values extends readonly [string, ...string[]]>(...values: Values): QueryCodec<Values[number], false, false> {
    const allowed = new Set<string>(values);
    return scalarCodec<Values[number]>(
      (value) => {
        if (!allowed.has(value)) {
          throw new Error(`Expected one of ${values.join(', ')}, got ${JSON.stringify(value)}`);
        }
        return value as Values[number];
      },
      (value) => {
        if (!allowed.has(value)) {
          throw new Error(`Expected one of ${values.join(', ')}, got ${JSON.stringify(value)}`);
        }
        return value;
      },
    );
  },

  optional<T>(codec: QueryCodec<T, false, false>): QueryCodec<T, true, true> {
    return {
      optional: true,
      parse(values) {
        if (!values?.length) return undefined;
        return codec.parse(values);
      },
      format(value) {
        return codec.format(value);
      },
    };
  },

  default<T extends string | number | boolean>(
    codec: QueryCodec<T, false, false>,
    value: T,
  ): QueryCodec<T, true, false> {
    const encoded = codec.format(value);
    if (encoded.length === 0) throw new Error('Default query value must encode to at least one value');
    return {
      optional: true,
      outputOptional: false,
      isDefault: (candidate) => Object.is(candidate, value),
      parse(values) {
        if (!values?.length) return value;
        return codec.parse(values);
      },
      format(candidate) {
        return codec.format(candidate);
      },
    };
  },

  array<T>(codec: QueryCodec<T, false, false>): QueryCodec<readonly T[], false, false> {
    return {
      optional: false,
      parse(values) {
        if (!values?.length) throw new Error('Missing required array value');
        return values.map((value) => codec.parse([value]) as T);
      },
      format(values) {
        if (!Array.isArray(values) || values.length === 0) throw new Error('Expected a non-empty array');
        return values.flatMap((value) => codec.format(value));
      },
    };
  },
} as const;

type MergeQuery<Parent extends QuerySchema, Own extends QuerySchema> = Simplify<Parent & Own>;
type NoQueryOverlap<Parent extends QuerySchema, Own extends QuerySchema> =
  Extract<keyof Parent, keyof Own> extends never ? unknown : {
    readonly __query_keys_must_be_unique_across_route_ancestors__: never;
  };

type JoinPath<Parent extends string, Child extends string> = Parent extends '' | '/' ? Child : `${Parent}${Child}`;
type RootPath = `/${string}`;
type ChildPath<Path extends string> = Path extends '/' ? never : Path extends `/${string}` ? Path : never;

export interface RouteContext<Path extends string, Q extends QuerySchema> {
  readonly url: string;
  readonly pathname: string;
  readonly params: PathParams<Path>;
  readonly query: QueryValue<Q>;
  readonly hash: string | undefined;
}

export interface ShouldNavigateContext<State, Path extends string, Q extends QuerySchema>
  extends RouteContext<Path, Q> {
  readonly state: State;
  readonly signal: AbortSignal;
}

export type ShouldNavigate<State, Path extends string, Q extends QuerySchema> = (
  context: ShouldNavigateContext<State, Path, Q>,
) => MaybePromise<boolean>;

export interface RouteNode<
  State,
  Path extends string,
  Q extends QuerySchema,
  Children,
> {
  readonly path: Path;
  readonly query: Q;
  readonly title?: string | ((context: RouteContext<Path, Q>) => string);
  readonly shouldNavigate?: ShouldNavigate<State, Path, Q>;
  readonly children: Children;
}

export type AnyRouteNode<State = any> = RouteNode<State, any, any, any>;
export type RouteTree<State = any> = Readonly<Record<string, AnyRouteNode<State>>>;

type RouteOptions<
  State,
  Path extends string,
  ParentQ extends QuerySchema,
  OwnQ extends QuerySchema,
  EffectiveQ extends QuerySchema,
  Children extends RouteTree<State>,
> = {
  readonly query?: OwnQ & NoQueryOverlap<ParentQ, OwnQ>;
  readonly title?: string | ((context: RouteContext<Path, EffectiveQ>) => string);
  readonly shouldNavigate?: ShouldNavigate<State, Path, EffectiveQ>;
  readonly children?: (route: RouteFactory<State, Path, EffectiveQ>) => Children;
};

export interface RouteFactory<
  State,
  ParentPath extends string = '',
  ParentQ extends QuerySchema = {},
> {
  <const Path extends string>(
    path: ParentPath extends '' ? Path & RootPath : Path & ChildPath<Path>,
  ): RouteNode<State, JoinPath<ParentPath, Path>, ParentQ, {}>;

  <
    const Path extends string,
    const OwnQ extends QuerySchema = {},
    const Children extends RouteTree<State> = {},
  >(
    path: ParentPath extends '' ? Path & RootPath : Path & ChildPath<Path>,
    options: RouteOptions<
      State,
      JoinPath<ParentPath, Path>,
      ParentQ,
      OwnQ,
      MergeQuery<ParentQ, OwnQ>,
      Children
    >,
  ): RouteNode<State, JoinPath<ParentPath, Path>, MergeQuery<ParentQ, OwnQ>, Children>;
}

function validateRouteFragment(parentPath: string, path: string): void {
  if (parentPath === '') {
    if (!path.startsWith('/')) throw new Error(`Root route path must start with "/": ${path}`);
  } else if (!path.startsWith('/') || path === '/') {
    throw new Error(`Child route path must be a non-root fragment such as "/settings": ${path}`);
  }
  if (path.length > 1 && path.endsWith('/')) throw new Error(`Route path must not end with "/": ${path}`);
  if (path.includes('//')) throw new Error(`Route path must not contain empty segments: ${path}`);
  if (path.includes('?') || path.includes('#')) throw new Error(`Route path must not contain query or hash text: ${path}`);
  const segments = path.split('/').filter(Boolean);
  for (const segment of segments) {
    if (segment === '.' || segment === '..') throw new Error(`Route path must not contain ${segment} segments: ${path}`);
    if ((segment.includes(':') || segment.includes('*')) && !segment.startsWith(':') && !segment.startsWith('*')) {
      throw new Error(`Route parameters must occupy a whole segment: ${segment}`);
    }
    if (segment.startsWith(':') || segment.startsWith('*')) {
      const name = segment.slice(1);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid route parameter: ${segment}`);
    }
  }
}

function makeRouteFactory<State, ParentPath extends string, ParentQ extends QuerySchema>(
  parentPath: ParentPath,
  parentQuery: ParentQ,
): RouteFactory<State, ParentPath, ParentQ> {
  const route = (path: string, options: {
    query?: QuerySchema;
    title?: string | ((context: RouteContext<string, QuerySchema>) => string);
    shouldNavigate?: ShouldNavigate<State, string, QuerySchema>;
    children?: (route: RouteFactory<State, string, QuerySchema>) => RouteTree<State>;
  } = {}): AnyRouteNode<State> => {
    validateRouteFragment(parentPath, path);
    const ownQuery = options.query ?? {};
    for (const key of Object.keys(ownQuery)) {
      if (key in parentQuery) throw new Error(`Query parameter ${JSON.stringify(key)} is already defined by an ancestor route`);
    }
    const fullPath = parentPath === '/' ? path : `${parentPath}${path}`;
    const query = { ...parentQuery, ...ownQuery } as QuerySchema;
    const childRoute = makeRouteFactory<State, string, QuerySchema>(fullPath, query);
    const children = options.children?.(childRoute) ?? {};
    return {
      path: fullPath,
      query,
      ...(options.title === undefined ? {} : { title: options.title }),
      ...(options.shouldNavigate === undefined ? {} : { shouldNavigate: options.shouldNavigate }),
      children,
    };
  };
  return route as RouteFactory<State, ParentPath, ParentQ>;
}

export function createRoute<State = unknown>(): RouteFactory<State> {
  return makeRouteFactory<State, '', {}>('', {});
}

export const route = createRoute<unknown>();

type Entry<Tree, Prefix extends string = ''> = Tree extends Readonly<Record<string, any>> ? {
  [K in StringKey<Tree>]: Tree[K] extends RouteNode<any, any, any, infer Children>
    ? | { readonly name: Prefix extends '' ? K : `${Prefix}${K}`; readonly node: Tree[K] }
      | (Children extends Readonly<Record<string, any>>
          ? Entry<Children, Prefix extends '' ? `${K}.` : `${Prefix}${K}.`>
          : never)
    : never
}[StringKey<Tree>] : never;

export type RouteName<Tree extends RouteTree<any>> = Entry<Tree>['name'];
type NodeForName<Tree extends RouteTree<any>, Name extends RouteName<Tree>> = Extract<Entry<Tree>, { name: Name }>['node'];
type PathOf<Node> = Node extends RouteNode<any, infer Path, any, any> ? Path : never;
type QueryOf<Node> = Node extends RouteNode<any, any, infer Q, any> ? Q : never;
type StateOfTree<Tree extends RouteTree<any>> = Tree[StringKey<Tree>] extends RouteNode<infer State, any, any, any> ? State : unknown;

type ParamsArg<Node> = keyof PathParams<PathOf<Node>> extends never ? {} : { readonly params: PathParams<PathOf<Node>> };
type QueryArg<Node> = keyof QueryInput<QueryOf<Node>> extends never
  ? {}
  : RequiredKeys<QueryInput<QueryOf<Node>>> extends never
    ? { readonly query?: QueryInput<QueryOf<Node>> }
    : { readonly query: QueryInput<QueryOf<Node>> };
type HashArg = { readonly hash?: string };

export type RouteArgs<Node extends AnyRouteNode> = Simplify<ParamsArg<Node> & QueryArg<Node> & HashArg>;
type RouteArgsTuple<Node extends AnyRouteNode> = RequiredKeys<RouteArgs<Node>> extends never
  ? [args?: RouteArgs<Node>]
  : [args: RouteArgs<Node>];

export type RouteTarget<
  Tree extends RouteTree<any>,
  Name extends RouteName<Tree> = RouteName<Tree>,
> = Name extends RouteName<Tree>
  ? Simplify<{ readonly name: Name } & RouteArgs<NodeForName<Tree, Name>>>
  : never;

export type MatchedRouteForName<
  Tree extends RouteTree<any>,
  Name extends RouteName<Tree>,
> = Simplify<{
  readonly name: Name;
  readonly pattern: PathOf<NodeForName<Tree, Name>>;
  readonly url: string;
  readonly pathname: string;
  readonly params: PathParams<PathOf<NodeForName<Tree, Name>>>;
  readonly query: QueryValue<QueryOf<NodeForName<Tree, Name>>>;
  readonly hash: string | undefined;
  readonly title: string;
}>;

export type MatchedRoute<Tree extends RouteTree<any>> = {
  [Name in RouteName<Tree>]: MatchedRouteForName<Tree, Name>
}[RouteName<Tree>];

export interface RouterState<Tree extends RouteTree<any>> {
  readonly status: 'idle' | 'navigating';
  readonly current: MatchedRoute<Tree> | null;
  readonly pending: MatchedRoute<Tree> | null;
  readonly blocked: MatchedRoute<Tree> | null;
  readonly error: string | null;
  readonly navigationId: number;
}

export interface BrowserPort {
  readonly href: string;
  readonly baseURI: string;
  readonly origin: string;
  readonly state?: unknown;
  push(url: string, state?: unknown): void;
  replace(url: string, state?: unknown): void;
  go?(delta: number): void;
  back(): void;
  forward(): void;
  setTitle(title: string): void;
  addEventListener(type: 'popstate' | 'click', listener: EventListener): void;
  removeEventListener(type: 'popstate' | 'click', listener: EventListener): void;
}

function createWindowBrowser(): BrowserPort | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return {
    get href() { return window.location.href; },
    get baseURI() { return document.baseURI; },
    get origin() { return window.location.origin; },
    get state() { return window.history.state; },
    push(url, state) { window.history.pushState(state, '', url); },
    replace(url, state) { window.history.replaceState(state, '', url); },
    go(delta) { window.history.go(delta); },
    back() { window.history.back(); },
    forward() { window.history.forward(); },
    setTitle(title) { document.title = title; },
    addEventListener(type, listener) { window.addEventListener(type, listener); },
    removeEventListener(type, listener) { window.removeEventListener(type, listener); },
  };
}

export type NavigationResult = 'committed' | 'blocked' | 'superseded';
export type HistoryMode = 'push' | 'replace' | 'none';
export interface PatchQueryOptions {
  readonly history?: Exclude<HistoryMode, 'none'>;
}

const ACTION = {
  navigate: '@@typed-redux-router/NAVIGATE',
  patchQuery: '@@typed-redux-router/PATCH_QUERY',
  started: '@@typed-redux-router/STARTED',
  committed: '@@typed-redux-router/COMMITTED',
  blocked: '@@typed-redux-router/BLOCKED',
  failed: '@@typed-redux-router/FAILED',
  cancelled: '@@typed-redux-router/CANCELLED',
} as const;

type NavigateAction<Tree extends RouteTree<any>> = {
  readonly type: typeof ACTION.navigate;
  readonly routerKey: string;
  readonly payload: {
    readonly target?: RouteTarget<Tree>;
    readonly url?: string;
    readonly history: HistoryMode;
    readonly historyIndex?: number;
  };
};

type PatchQueryActionForName<
  Tree extends RouteTree<any>,
  Name extends RouteName<Tree>,
> = {
  readonly type: typeof ACTION.patchQuery;
  readonly routerKey: string;
  readonly payload: {
    readonly name: Name;
    readonly patch: QueryPatch<QueryOf<NodeForName<Tree, Name>>>;
    readonly history: Exclude<HistoryMode, 'none'>;
  };
};

type PatchQueryAction<Tree extends RouteTree<any>> = {
  [Name in RouteName<Tree>]: PatchQueryActionForName<Tree, Name>
}[RouteName<Tree>];

type ExternalAction<Tree extends RouteTree<any>> = NavigateAction<Tree> | PatchQueryAction<Tree>;

type InternalAction<Tree extends RouteTree<any>> =
  | { readonly type: typeof ACTION.started; readonly routerKey: string; readonly payload: { readonly id: number; readonly route: MatchedRoute<Tree> } }
  | { readonly type: typeof ACTION.committed; readonly routerKey: string; readonly payload: { readonly id: number; readonly route: MatchedRoute<Tree> } }
  | { readonly type: typeof ACTION.blocked; readonly routerKey: string; readonly payload: { readonly id: number; readonly route: MatchedRoute<Tree> } }
  | { readonly type: typeof ACTION.failed; readonly routerKey: string; readonly payload: { readonly id: number; readonly error: string } }
  | { readonly type: typeof ACTION.cancelled; readonly routerKey: string; readonly payload: { readonly id: number } };

export type RouterAction<Tree extends RouteTree<any>> = ExternalAction<Tree> | InternalAction<Tree>;

type OptionalRouteName<Tree extends RouteTree<any>> = {
  [Name in RouteName<Tree>]: RequiredKeys<RouteArgs<NodeForName<Tree, Name>>> extends never ? Name : never
}[RouteName<Tree>];
type Fallback<Tree extends RouteTree<any>> = OptionalRouteName<Tree> | RouteTarget<Tree>;

export interface RouterConfig<Tree extends RouteTree<any>> {
  readonly routes: Tree;
  readonly fallback?: Fallback<Tree>;
  readonly browser?: BrowserPort | null;
  readonly key?: string;
}

interface RuntimeRouteNode {
  readonly path: string;
  readonly query: QuerySchema;
  readonly title?: string | ((context: RouteContext<string, QuerySchema>) => string);
  readonly shouldNavigate?: ShouldNavigate<any, string, QuerySchema>;
  readonly children: Readonly<Record<string, RuntimeRouteNode>>;
}

interface CompiledRoute {
  readonly name: string;
  readonly node: RuntimeRouteNode;
  readonly regex: RegExp;
  readonly paramNames: readonly string[];
  readonly splatNames: ReadonlySet<string>;
  readonly specificity: readonly number[];
  readonly guards: readonly RuntimeRouteNode[];
  readonly order: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePath(path: string): {
  regex: RegExp;
  paramNames: string[];
  splatNames: Set<string>;
  specificity: number[];
} {
  if (path === '/') return { regex: /^\/?$/, paramNames: [], splatNames: new Set(), specificity: [] };
  const paramNames: string[] = [];
  const splatNames = new Set<string>();
  const specificity: number[] = [];
  const segments = path.split('/').slice(1);
  const regexSegments = segments.map((segment, index) => {
    if (segment.startsWith(':')) {
      const name = segment.slice(1);
      if (paramNames.includes(name)) throw new Error(`Duplicate route parameter :${name} in ${path}`);
      paramNames.push(name);
      specificity.push(2);
      return '([^/]+)';
    }
    if (segment.startsWith('*')) {
      const name = segment.slice(1);
      if (index !== segments.length - 1) throw new Error(`Splat parameter must be the final segment in ${path}`);
      if (paramNames.includes(name)) throw new Error(`Duplicate route parameter *${name} in ${path}`);
      paramNames.push(name);
      splatNames.add(name);
      specificity.push(1);
      return '(.+)';
    }
    specificity.push(3);
    return escapeRegExp(encodeURI(segment));
  });
  return {
    regex: new RegExp(`^/${regexSegments.join('/')}/?$`),
    paramNames,
    splatNames,
    specificity,
  };
}

function routeShape(path: string): string {
  return path.split('/').map((segment) => {
    if (segment.startsWith(':')) return ':';
    if (segment.startsWith('*')) return '*';
    return segment;
  }).join('/');
}

function compareSpecificity(a: CompiledRoute, b: CompiledRoute): number {
  const length = Math.max(a.specificity.length, b.specificity.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (b.specificity[index] ?? 0) - (a.specificity[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.order - b.order;
}

function parseQuery<S extends QuerySchema>(schema: S, searchParams: URLSearchParams): QueryValue<S> {
  const result: Record<string, unknown> = {};
  for (const [key, codec] of Object.entries(schema)) {
    const values = searchParams.getAll(key);
    const parsed = codec.parse(values.length ? values : undefined);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result as QueryValue<S>;
}

function hasValidPercentEncoding(value: string): boolean {
  try {
    decodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

function parseHash(hash: string): string | undefined {
  return hash ? decodeURIComponent(hash.slice(1)) : undefined;
}

function expectedParamNames(path: string): string[] {
  return path.split('/').filter((segment) => segment.startsWith(':') || segment.startsWith('*')).map((segment) => segment.slice(1));
}

function formatPath(path: string, params: Record<string, string>, routeName: string): string {
  return path.split('/').map((segment) => {
    if (segment.startsWith(':')) {
      const key = segment.slice(1);
      const value = params[key];
      if (typeof value !== 'string' || value === '') throw new Error(`Missing parameter ${key} for route ${routeName}`);
      return encodeURIComponent(value);
    }
    if (segment.startsWith('*')) {
      const key = segment.slice(1);
      const value = params[key];
      if (typeof value !== 'string' || value === '') throw new Error(`Missing splat parameter ${key} for route ${routeName}`);
      return value.split('/').map((part) => encodeURIComponent(part)).join('/');
    }
    return encodeURI(segment);
  }).join('/');
}

function relativeUrl(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function argsFromTarget(target: Record<string, any>): Record<string, any> {
  const { name: _name, ...args } = target;
  return args;
}

export class NavigationNotFoundError extends Error {
  constructor(readonly url: string) {
    super(`No route matched ${url}`);
    this.name = 'NavigationNotFoundError';
  }
}

export type RouterDispatchExtension<Tree extends RouteTree<any>> = {
  (action: ExternalAction<Tree>): Promise<NavigationResult>;
};

export interface TypedRouter<Tree extends RouteTree<any>> {
  readonly initialState: RouterState<Tree>;
  readonly reducer: (state: RouterState<Tree> | undefined, action: unknown) => RouterState<Tree>;
  readonly middleware: Middleware<RouterDispatchExtension<Tree>>;

  navigate<Name extends RouteName<Tree>>(name: Name, ...args: RouteArgsTuple<NodeForName<Tree, Name>>): NavigateAction<Tree>;
  replace<Name extends RouteName<Tree>>(name: Name, ...args: RouteArgsTuple<NodeForName<Tree, Name>>): NavigateAction<Tree>;
  patchQuery<Name extends RouteName<Tree>>(
    name: Name,
    patch: QueryPatch<QueryOf<NodeForName<Tree, Name>>>,
    options?: PatchQueryOptions,
  ): PatchQueryActionForName<Tree, Name>;
  href<Name extends RouteName<Tree>>(name: Name, ...args: RouteArgsTuple<NodeForName<Tree, Name>>): string;
  match(url: string | URL): MatchedRoute<Tree> | null;
  back(): void;
  forward(): void;

  readonly selectors: {
    current(state: RouterState<Tree>): MatchedRoute<Tree> | null;
    pending(state: RouterState<Tree>): MatchedRoute<Tree> | null;
    blocked(state: RouterState<Tree>): MatchedRoute<Tree> | null;
    status(state: RouterState<Tree>): RouterState<Tree>['status'];
    error(state: RouterState<Tree>): string | null;
    route<Name extends RouteName<Tree>>(name: Name): (state: RouterState<Tree>) => MatchedRouteForName<Tree, Name> | null;
  };

  readonly actionTypes: {
    readonly navigationBlocked: typeof ACTION.blocked;
    readonly navigationFailed: typeof ACTION.failed;
  };

  destroy(): void;
}

export function createRouter<const Tree extends RouteTree<any>>(config: RouterConfig<Tree>): TypedRouter<Tree> {
  type State = StateOfTree<Tree>;
  const routerKey = config.key ?? 'router';
  const browser = config.browser === undefined ? createWindowBrowser() : config.browser;
  const baseURI = browser?.baseURI ?? 'http://typed-redux-router.local/';
  const byName = new Map<string, CompiledRoute>();
  const compiled: CompiledRoute[] = [];
  const shapes = new Map<string, string>();
  let order = 0;

  const visit = (
    tree: Readonly<Record<string, RuntimeRouteNode>>,
    prefix: string,
    ancestors: readonly RuntimeRouteNode[],
  ): void => {
    for (const [key, node] of Object.entries(tree)) {
      if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error(`Invalid route name ${JSON.stringify(key)}`);
      if (!node || typeof node.path !== 'string' || !node.children) throw new Error(`Route ${prefix}${key} is not a route() definition`);
      const name = prefix ? `${prefix}.${key}` : key;
      const shape = routeShape(node.path);
      const existing = shapes.get(shape);
      if (existing) throw new Error(`Ambiguous route patterns: ${existing} and ${name}`);
      shapes.set(shape, name);
      const result = compilePath(node.path);
      const guards = node.shouldNavigate ? [...ancestors, node] : ancestors;
      const candidate: CompiledRoute = {
        name,
        node,
        regex: result.regex,
        paramNames: result.paramNames,
        splatNames: result.splatNames,
        specificity: result.specificity,
        guards,
        order: order++,
      };
      compiled.push(candidate);
      byName.set(name, candidate);
      visit(node.children, name, guards);
    }
  };

  visit(config.routes as Readonly<Record<string, RuntimeRouteNode>>, '', []);
  compiled.sort(compareSpecificity);

  const initialState: RouterState<Tree> = {
    status: 'idle',
    current: null,
    pending: null,
    blocked: null,
    error: null,
    navigationId: 0,
  };

  function getRuntimeRoute(name: string): CompiledRoute {
    const route = byName.get(name);
    if (!route) throw new Error(`Unknown route ${JSON.stringify(name)}`);
    return route;
  }

  function buildHref(name: string, args: Record<string, any> = {}): string {
    const runtime = getRuntimeRoute(name);
    const allowedArgs = new Set(['params', 'query', 'hash']);
    for (const key of Object.keys(args)) {
      if (!allowedArgs.has(key)) throw new Error(`Unknown route argument ${JSON.stringify(key)}`);
    }
    const params = (args['params'] ?? {}) as Record<string, string>;
    const requiredParams = expectedParamNames(runtime.node.path);
    for (const key of Object.keys(params)) {
      if (!requiredParams.includes(key)) throw new Error(`Unknown parameter ${key} for route ${name}`);
    }
    const pathname = formatPath(runtime.node.path, params, name);
    const url = new URL(pathname, baseURI);
    const query = (args['query'] ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(query)) {
      if (!(key in runtime.node.query)) throw new Error(`Unknown query parameter ${key} for route ${name}`);
    }
    for (const [key, codec] of Object.entries(runtime.node.query)) {
      const value = query[key];
      if (value === undefined) {
        if (!codec.optional) throw new Error(`Missing query parameter ${key} for route ${name}`);
        continue;
      }
      if (codec.isDefault?.(value)) continue;
      const encoded = codec.format(value);
      if (encoded.length === 0) throw new Error(`Query codec for ${key} produced no values`);
      for (const item of encoded) url.searchParams.append(key, item);
    }
    const hash = args['hash'] as unknown;
    if (hash !== undefined && typeof hash !== 'string') throw new Error(`Hash for route ${name} must be a string`);
    url.hash = (hash as string | undefined) ?? '';
    return relativeUrl(url);
  }

  function href<Name extends RouteName<Tree>>(
    name: Name,
    ...argsTuple: RouteArgsTuple<NodeForName<Tree, Name>>
  ): string {
    return buildHref(name, (argsTuple[0] ?? {}) as Record<string, any>);
  }

  function matchCandidate(candidate: CompiledRoute, url: URL): MatchedRoute<Tree> | null {
    const result = candidate.regex.exec(url.pathname);
    if (!result) return null;
    let params: Record<string, string>;
    let query: QueryValue<QuerySchema>;
    let hash: string | undefined;
    try {
      params = {};
      candidate.paramNames.forEach((name, index) => {
        const raw = result[index + 1]!;
        params[name] = candidate.splatNames.has(name)
          ? raw.split('/').map(decodeURIComponent).join('/')
          : decodeURIComponent(raw);
      });
      if (url.search && !hasValidPercentEncoding(url.search.slice(1).replace(/\+/g, '%20'))) return null;
      query = parseQuery(candidate.node.query, url.searchParams);
      hash = parseHash(url.hash);
    } catch {
      return null;
    }
    const context = {
      url: relativeUrl(url),
      pathname: url.pathname,
      params,
      query,
      hash,
    } as RouteContext<string, QuerySchema>;
    const title = typeof candidate.node.title === 'function'
      ? candidate.node.title(context)
      : candidate.node.title ?? '';
    return {
      name: candidate.name,
      pattern: candidate.node.path,
      url: relativeUrl(url),
      pathname: url.pathname,
      params,
      query,
      hash,
      title,
    } as MatchedRoute<Tree>;
  }

  function match(rawUrl: string | URL): MatchedRoute<Tree> | null {
    const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl, baseURI);
    for (const candidate of compiled) {
      const matched = matchCandidate(candidate, url);
      if (matched) return matched;
    }
    return null;
  }

  function targetFromFallback(): RouteTarget<Tree> | null {
    if (config.fallback === undefined) return null;
    return typeof config.fallback === 'string'
      ? { name: config.fallback } as RouteTarget<Tree>
      : config.fallback;
  }

  const fallbackTarget = targetFromFallback();
  const fallbackUrl = fallbackTarget
    ? new URL(buildHref(fallbackTarget.name, argsFromTarget(fallbackTarget as Record<string, any>)), baseURI)
    : null;

  function resolveUrl(url: URL): { route: MatchedRoute<Tree>; runtime: CompiledRoute; url: URL; usedFallback: boolean } {
    for (const runtime of compiled) {
      const route = matchCandidate(runtime, url);
      if (route) return { route, runtime, url, usedFallback: false };
    }
    if (fallbackUrl && fallbackTarget) {
      const runtime = getRuntimeRoute(fallbackTarget.name);
      const route = matchCandidate(runtime, fallbackUrl);
      if (!route) throw new Error('Configured fallback does not match its own route');
      return { route, runtime, url: fallbackUrl, usedFallback: true };
    }
    throw new NavigationNotFoundError(relativeUrl(url));
  }

  function reducer(state: RouterState<Tree> = initialState, action: unknown): RouterState<Tree> {
    if (!isRecord(action) || action['routerKey'] !== routerKey || typeof action['type'] !== 'string') return state;
    switch (action['type']) {
      case ACTION.started: {
        const payload = (action as Extract<InternalAction<Tree>, { type: typeof ACTION.started }>).payload;
        if (payload.id < state.navigationId) return state;
        return { ...state, status: 'navigating', pending: payload.route, blocked: null, error: null, navigationId: payload.id };
      }
      case ACTION.committed: {
        const payload = (action as Extract<InternalAction<Tree>, { type: typeof ACTION.committed }>).payload;
        if (payload.id !== state.navigationId) return state;
        return { ...state, status: 'idle', current: payload.route, pending: null, blocked: null, error: null };
      }
      case ACTION.blocked: {
        const payload = (action as Extract<InternalAction<Tree>, { type: typeof ACTION.blocked }>).payload;
        if (payload.id !== state.navigationId) return state;
        return { ...state, status: 'idle', pending: null, blocked: payload.route, error: null };
      }
      case ACTION.failed: {
        const payload = (action as Extract<InternalAction<Tree>, { type: typeof ACTION.failed }>).payload;
        if (payload.id < state.navigationId) return state;
        return {
          ...state,
          status: 'idle',
          pending: null,
          blocked: null,
          error: payload.error,
          navigationId: payload.id,
        };
      }
      case ACTION.cancelled: {
        const payload = (action as Extract<InternalAction<Tree>, { type: typeof ACTION.cancelled }>).payload;
        if (payload.id !== state.navigationId) return state;
        return { ...state, status: 'idle', pending: null };
      }
      default:
        return state;
    }
  }

  let installed = false;
  let destroyed = false;
  let installedApi: { dispatch(action: any): any; getState(): unknown } | null = null;
  let sequence = 0;
  let active: { id: number; controller: AbortController } | null = null;
  let lastCommittedUrl: string | null = null;
  let committedHistoryIndex: number | null = null;
  let restoringHistoryIndex: number | null = null;
  const historyStateKey = '@@typed-redux-router';

  function readHistoryIndex(state: unknown): number | null {
    if (!isRecord(state)) return null;
    const marker = state[historyStateKey];
    if (!isRecord(marker) || marker['routerKey'] !== routerKey || !Number.isSafeInteger(marker['index'])) return null;
    return marker['index'] as number;
  }

  function markedHistoryState(index: number, preserveCurrent: boolean): Record<string, unknown> {
    const base = preserveCurrent && isRecord(browser?.state) ? browser.state : {};
    return {
      ...base,
      [historyStateKey]: { routerKey, index },
    };
  }

  function contextForGuard(node: RuntimeRouteNode, matched: MatchedRoute<Tree>, url: URL, signal: AbortSignal, state: State): ShouldNavigateContext<State, string, QuerySchema> {
    const params: Record<string, string> = {};
    for (const name of expectedParamNames(node.path)) params[name] = (matched.params as Record<string, string>)[name]!;
    return {
      url: relativeUrl(url),
      pathname: url.pathname,
      params,
      query: parseQuery(node.query, url.searchParams),
      hash: parseHash(url.hash),
      state,
      signal,
    };
  }

  function restoreLastCommitted(fromIndex?: number): void {
    const currentBrowser = browser!;
    const committedUrl = lastCommittedUrl!;
    if (
      fromIndex !== undefined
      && committedHistoryIndex !== null
      && fromIndex !== committedHistoryIndex
      && currentBrowser.go
    ) {
      restoringHistoryIndex = committedHistoryIndex;
      currentBrowser.go(committedHistoryIndex - fromIndex);
      return;
    }
    const state = committedHistoryIndex === null
      ? currentBrowser.state
      : markedHistoryState(committedHistoryIndex, true);
    currentBrowser.replace(committedUrl, state);
  }

  function beginTransition(): { id: number; controller: AbortController } {
    const id = ++sequence;
    active?.controller.abort();
    const controller = new AbortController();
    active = { id, controller };
    return { id, controller };
  }

  function failBeforeStart(
    api: { dispatch(action: any): any },
    id: number,
    error: unknown,
  ): never {
    api.dispatch({ type: ACTION.failed, routerKey, payload: { id, error: errorMessage(error) } } satisfies InternalAction<Tree>);
    if (active?.id === id) active = null;
    throw error;
  }

  async function commitResolvedNavigation(
    api: { dispatch(action: any): any; getState(): unknown },
    action: NavigateAction<Tree>,
    resolved: ReturnType<typeof resolveUrl>,
    id: number,
    controller: AbortController,
    runGuards: boolean,
  ): Promise<NavigationResult> {
    api.dispatch({ type: ACTION.started, routerKey, payload: { id, route: resolved.route } } satisfies InternalAction<Tree>);

    try {
      if (runGuards) {
        for (const guardNode of resolved.runtime.guards) {
          const allowed = await guardNode.shouldNavigate!(contextForGuard(
            guardNode,
            resolved.route,
            resolved.url,
            controller.signal,
            api.getState() as State,
          ));
          if (controller.signal.aborted || active?.id !== id) return 'superseded';
          if (typeof allowed !== 'boolean') throw new Error('shouldNavigate must return a boolean');
          if (!allowed) {
            api.dispatch({ type: ACTION.blocked, routerKey, payload: { id, route: resolved.route } } satisfies InternalAction<Tree>);
            if (action.payload.history === 'none') restoreLastCommitted(action.payload.historyIndex);
            if (active?.id === id) active = null;
            return 'blocked';
          }
        }
      }

      const nextUrl = relativeUrl(resolved.url);
      let nextHistoryIndex = committedHistoryIndex;
      if (browser) {
        if (action.payload.history === 'replace' || resolved.usedFallback) {
          const index = action.payload.historyIndex ?? committedHistoryIndex ?? 0;
          browser.replace(nextUrl, markedHistoryState(index, true));
          nextHistoryIndex = index;
        } else if (action.payload.history === 'push') {
          const index = (committedHistoryIndex ?? -1) + 1;
          browser.push(nextUrl, markedHistoryState(index, false));
          nextHistoryIndex = index;
        } else {
          nextHistoryIndex = action.payload.historyIndex ?? null;
        }
        browser.setTitle(resolved.route.title);
      }
      lastCommittedUrl = nextUrl;
      committedHistoryIndex = nextHistoryIndex;
      api.dispatch({ type: ACTION.committed, routerKey, payload: { id, route: resolved.route } } satisfies InternalAction<Tree>);
      if (active?.id === id) active = null;
      return 'committed';
    } catch (error) {
      if (controller.signal.aborted || active?.id !== id) return 'superseded';
      api.dispatch({ type: ACTION.failed, routerKey, payload: { id, error: errorMessage(error) } } satisfies InternalAction<Tree>);
      if (action.payload.history === 'none') restoreLastCommitted(action.payload.historyIndex);
      active = null;
      throw error;
    }
  }

  async function performNavigation(
    api: { dispatch(action: any): any; getState(): unknown },
    action: NavigateAction<Tree>,
  ): Promise<NavigationResult> {
    const { id, controller } = beginTransition();

    let resolved: ReturnType<typeof resolveUrl>;
    try {
      if (action.payload.target) {
        const targetUrl = new URL(buildHref(action.payload.target.name, argsFromTarget(action.payload.target as Record<string, any>)), baseURI);
        const runtime = getRuntimeRoute(action.payload.target.name);
        const route = matchCandidate(runtime, targetUrl);
        if (!route) throw new NavigationNotFoundError(relativeUrl(targetUrl));
        resolved = { route, runtime, url: targetUrl, usedFallback: false };
      } else {
        const raw = action.payload.url!;
        const url = new URL(raw, baseURI);
        if (browser && url.origin !== browser.origin) throw new Error(`Cannot navigate to a different origin: ${url.origin}`);
        resolved = resolveUrl(url);
      }
    } catch (error) {
      return failBeforeStart(api, id, error);
    }

    return commitResolvedNavigation(api, action, resolved, id, controller, true);
  }

  async function performPatchQuery(
    api: { dispatch(action: any): any; getState(): unknown },
    action: PatchQueryAction<Tree>,
  ): Promise<NavigationResult> {
    const { id, controller } = beginTransition();

    let resolved: ReturnType<typeof resolveUrl>;
    try {
      if (lastCommittedUrl === null) throw new Error('Cannot patch query before the first route has committed');
      const current = match(lastCommittedUrl);
      if (!current) throw new Error('Cannot patch query because the current committed URL no longer matches a route');
      if (current.name !== action.payload.name) {
        throw new Error(`Cannot patch query for route ${JSON.stringify(action.payload.name)} while ${JSON.stringify(current.name)} is current`);
      }
      const mergedQuery = { ...(current.query as Record<string, unknown>), ...(action.payload.patch as Record<string, unknown>) };
      const targetUrl = new URL(buildHref(action.payload.name, {
        params: current.params,
        query: mergedQuery,
        ...(current.hash === undefined ? {} : { hash: current.hash }),
      }), baseURI);
      const runtime = getRuntimeRoute(action.payload.name);
      const route = matchCandidate(runtime, targetUrl);
      if (!route) throw new NavigationNotFoundError(relativeUrl(targetUrl));
      resolved = { route, runtime, url: targetUrl, usedFallback: false };
    } catch (error) {
      return failBeforeStart(api, id, error);
    }

    const navigationAction: NavigateAction<Tree> = {
      type: ACTION.navigate,
      routerKey,
      payload: { url: resolved.url.href, history: action.payload.history },
    };
    return commitResolvedNavigation(api, navigationAction, resolved, id, controller, false);
  }

  const onPopState: EventListener = (event) => {
    if (!browser || !installedApi || destroyed) return;
    const targetIndex = readHistoryIndex((event as PopStateEvent).state);
    if (restoringHistoryIndex !== null && targetIndex === restoringHistoryIndex) {
      restoringHistoryIndex = null;
      return;
    }
    restoringHistoryIndex = null;
    const action: NavigateAction<Tree> = {
      type: ACTION.navigate,
      routerKey,
      payload: {
        url: browser.href,
        history: 'none',
        ...(targetIndex === null ? {} : { historyIndex: targetIndex }),
      },
    };
    Promise.resolve(installedApi!.dispatch(action)).catch(() => undefined);
  };

  const onClick: EventListener = (event) => {
    if (destroyed || !(event instanceof MouseEvent)) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    const anchor = path.find((item): item is HTMLAnchorElement => item instanceof HTMLAnchorElement);
    if (!anchor?.href || anchor.hasAttribute('download') || anchor.rel === 'external') return;
    const target = anchor.getAttribute('target');
    if (target && target.toLowerCase() !== '_self') return;
    let url: URL;
    try {
      url = new URL(anchor.href, browser!.baseURI);
    } catch {
      return;
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== browser!.origin || url.href === browser!.href) return;
    if (!match(url) && !fallbackTarget) return;
    event.preventDefault();
    const action: NavigateAction<Tree> = {
      type: ACTION.navigate,
      routerKey,
      payload: { url: url.href, history: 'push' },
    };
    Promise.resolve(installedApi!.dispatch(action)).catch(() => undefined);
  };

  const middleware: Middleware<RouterDispatchExtension<Tree>> = (api) => {
    if (installed) throw new Error('Router middleware can only be installed once');
    installed = true;
    installedApi = api;
    if (browser) {
      browser.addEventListener('popstate', onPopState);
      browser.addEventListener('click', onClick);
      queueMicrotask(() => {
        if (destroyed) return;
        const action: NavigateAction<Tree> = {
          type: ACTION.navigate,
          routerKey,
          payload: { url: browser.href, history: 'replace' },
        };
        Promise.resolve(installedApi!.dispatch(action)).catch(() => undefined);
      });
    }
    return (next) => (action) => {
      if (!isRecord(action) || action['routerKey'] !== routerKey) return next(action);
      if (action['type'] !== ACTION.navigate && action['type'] !== ACTION.patchQuery) return next(action);
      if (destroyed) return Promise.reject(new Error('Router has been destroyed'));
      return action['type'] === ACTION.navigate
        ? performNavigation(api, action as NavigateAction<Tree>)
        : performPatchQuery(api, action as PatchQueryAction<Tree>);
    };
  };

  function target<Name extends RouteName<Tree>>(
    name: Name,
    argsTuple: RouteArgsTuple<NodeForName<Tree, Name>>,
  ): RouteTarget<Tree, Name> {
    getRuntimeRoute(name);
    return { name, ...(argsTuple[0] ?? {}) } as unknown as RouteTarget<Tree, Name>;
  }

  function navigate<Name extends RouteName<Tree>>(
    name: Name,
    ...argsTuple: RouteArgsTuple<NodeForName<Tree, Name>>
  ): NavigateAction<Tree> {
    return { type: ACTION.navigate, routerKey, payload: { target: target(name, argsTuple), history: 'push' } };
  }

  function replace<Name extends RouteName<Tree>>(
    name: Name,
    ...argsTuple: RouteArgsTuple<NodeForName<Tree, Name>>
  ): NavigateAction<Tree> {
    return { type: ACTION.navigate, routerKey, payload: { target: target(name, argsTuple), history: 'replace' } };
  }

  function patchQuery<Name extends RouteName<Tree>>(
    name: Name,
    patch: QueryPatch<QueryOf<NodeForName<Tree, Name>>>,
    options: PatchQueryOptions = {},
  ): PatchQueryActionForName<Tree, Name> {
    getRuntimeRoute(name);
    return {
      type: ACTION.patchQuery,
      routerKey,
      payload: { name, patch, history: options.history ?? 'replace' },
    };
  }

  const selectors = {
    current: (state: RouterState<Tree>) => state.current,
    pending: (state: RouterState<Tree>) => state.pending,
    blocked: (state: RouterState<Tree>) => state.blocked,
    status: (state: RouterState<Tree>) => state.status,
    error: (state: RouterState<Tree>) => state.error,
    route: <Name extends RouteName<Tree>>(name: Name) => (
      state: RouterState<Tree>,
    ): MatchedRouteForName<Tree, Name> | null =>
      state.current?.name === name ? state.current as MatchedRouteForName<Tree, Name> : null,
  };

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (browser) {
      browser.removeEventListener('popstate', onPopState);
      browser.removeEventListener('click', onClick);
    }
    if (active) {
      const id = active.id;
      active.controller.abort();
      active = null;
      installedApi?.dispatch({ type: ACTION.cancelled, routerKey, payload: { id } } satisfies InternalAction<Tree>);
    }
    installedApi = null;
  }

  return {
    initialState,
    reducer,
    middleware,
    navigate,
    replace,
    patchQuery,
    href,
    match,
    selectors,
    actionTypes: {
      navigationBlocked: ACTION.blocked,
      navigationFailed: ACTION.failed,
    },
    back: () => browser?.back(),
    forward: () => browser?.forward(),
    destroy,
  };
}
