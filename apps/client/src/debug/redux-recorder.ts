import type { StoreEnhancer } from "@reduxjs/toolkit";
import { z } from "zod";

/**
 * Debug-only Redux recorder for the console. It deliberately sits outside
 * Redux and React: it never dispatches (so it cannot record itself), never
 * subscribes, and renders no components. An innermost store enhancer taps the
 * plain actions the reducers actually see; a rolling in-memory ring backs
 * retro captures, and a bounded log persisted to `localStorage` keeps page
 * refreshes and full reloads inside one recording. Captures are minified
 * JSONL with a self-describing legend header. Keyboard shortcuts, toasts and
 * clipboard handling live in `recorder-hotkeys.ts`.
 */

const STORAGE_KEY = "agent-starter.debug.redux-recorder.v1";

const SERIALISE_MAX_DEPTH = 12;
const SERIALISE_MAX_STRING = 1200;
const SERIALISE_MAX_CHARS = 400_000;

// String values under matching keys are replaced with "<r:N>" markers so a
// pasted capture cannot leak credentials; see LEGEND.mk.
const SENSITIVE_KEY =
  /token|secret|password|passphrase|credential|authoriz|cookie|api[-_]?key|privatekey/i;

const KNOWN_ACTION_KEYS = new Set(["type", "payload", "meta", "error"]);

const LEGEND = {
  a: "action type",
  pl: "payload",
  m: "meta",
  er: "error flag",
  x: "other action props",
  e: "event",
  s: "state snapshot",
  h: "HTML snapshot (Jade/Pug source)",
  t: "epoch ms",
  u: "url",
  w: "window id",
  ev: "load,recStart,recStop,pagehide,capture,clear",
  mk: "<r:N> redacted string of length N; <+N> N more chars dropped; <cut> size cap; <deep> depth cap; <cycle> circular; <fn> <sym> <Map:N> <Set:N> structural markers; NaN/Infinity as strings; 123n BigInt",
} as const;

export interface RecorderLimits {
  /** Rolling in-memory ring size backing retro captures. */
  memoryLines: number;
  /** Action lines included in a retro capture window. */
  retroActions: number;
  /** Hard caps on the persisted recording log. */
  logMaxLines: number;
  logMaxBytes: number;
  /** Debounce for localStorage writes while recording. */
  flushDelayMs: number;
}

const DEFAULT_LIMITS: RecorderLimits = {
  memoryLines: 240,
  retroActions: 100,
  logMaxLines: 6000,
  logMaxBytes: 1_500_000,
  flushDelayMs: 500,
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type LineKind = "a" | "n";

interface Line {
  kind: LineKind;
  text: string;
}

export interface RecorderExport {
  text: string;
  lines: number;
  actions: number;
  bytes: number;
}

export interface ReduxRecorderOptions {
  storage?: StorageLike | null;
  now?: () => number;
  windowId?: string;
  limits?: Partial<RecorderLimits>;
}

export interface ReduxRecorder {
  readonly enhancer: StoreEnhancer;
  attachStore(getState: () => unknown): void;
  isRecording(): boolean;
  status(): { recording: boolean; startedAt: number; lines: number };
  storageBroken(): boolean;
  startRecording(): { started: boolean };
  stopRecording(html?: string): RecorderExport | null;
  captureNow(html?: string): RecorderExport;
  recopyLastRecording(): RecorderExport | null;
  clear(): void;
  notePageHide(): void;
  flush(): void;
  noteAction(action: unknown): void;
}

const persistedRecordSchema = z.object({
  v: z.literal(1),
  recording: z.boolean(),
  startedAt: z.number(),
  truncated: z.boolean(),
  lines: z.array(z.tuple([z.enum(["a", "n"]), z.string()])),
});

function resolveBrowserStorage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function randomWindowId(): string {
  return Math.random().toString(36).slice(2, 6);
}

function currentUrl(): string | undefined {
  const location = (globalThis as { location?: { pathname: string; search: string } })
    .location;
  return location === undefined ? undefined : `${location.pathname}${location.search}`;
}

interface SerialiseContext {
  seen: Set<object>;
  budget: number;
}

function newSerialiseContext(): SerialiseContext {
  return { seen: new Set(), budget: SERIALISE_MAX_CHARS };
}

function truncateText(value: string): string {
  return value.length <= SERIALISE_MAX_STRING
    ? value
    : `${value.slice(0, SERIALISE_MAX_STRING)}<+${value.length - SERIALISE_MAX_STRING}>`;
}

function serialisePrimitive(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") {
    switch (typeof value) {
      case "string":
        return JSON.stringify(truncateText(value));
      case "number":
        return Number.isFinite(value) ? String(value) : JSON.stringify(String(value));
      case "boolean":
        return String(value);
      case "bigint":
        return JSON.stringify(`${value}n`);
      case "function":
        return '"<fn>"';
      case "symbol":
        return '"<sym>"';
      default:
        return "null";
    }
  }
  return undefined;
}

function serialiseBuiltIn(value: object): string | undefined {
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (value instanceof Error) {
    return `{"name":${JSON.stringify(value.name)},"message":${JSON.stringify(value.message)}}`;
  }
  if (value instanceof Map) {
    return `"<Map:${value.size}>"`;
  }
  if (value instanceof Set) {
    return `"<Set:${value.size}>"`;
  }
  if (value instanceof RegExp) {
    return JSON.stringify(String(value));
  }
  return undefined;
}

function serialiseArray(value: unknown[], depth: number, ctx: SerialiseContext): string {
  if (value.length === 0) {
    return "[]";
  }
  const body = `[${value.map((item) => serialise(item, depth + 1, ctx)).join(",")}]`;
  ctx.budget -= body.length;
  return body;
}

function serialiseRecord(value: object, depth: number, ctx: SerialiseContext): string {
  const parts: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      continue;
    }
    if (typeof entry === "string" && SENSITIVE_KEY.test(key)) {
      parts.push(`${JSON.stringify(key)}:"<r:${entry.length}>"`);
      continue;
    }
    parts.push(`${JSON.stringify(key)}:${serialise(entry, depth + 1, ctx)}`);
  }
  const body = `{${parts.join(",")}}`;
  ctx.budget -= body.length;
  return body;
}

function serialise(value: unknown, depth: number, ctx: SerialiseContext): string {
  if (ctx.budget <= 0) {
    return '"<cut>"';
  }
  const primitive = serialisePrimitive(value);
  if (primitive !== undefined) {
    return primitive;
  }
  const object = value as object;
  if (ctx.seen.has(object)) {
    return '"<cycle>"';
  }
  if (depth >= SERIALISE_MAX_DEPTH) {
    return '"<deep>"';
  }
  const builtIn = serialiseBuiltIn(object);
  if (builtIn !== undefined) {
    return builtIn;
  }
  ctx.seen.add(object);
  try {
    if (Array.isArray(object)) {
      return serialiseArray(object, depth, ctx);
    }
    return serialiseRecord(object, depth, ctx);
  } finally {
    ctx.seen.delete(object);
  }
}

function actionLine(action: Record<string, unknown>, at: number): string {
  const ctx = newSerialiseContext();
  const parts: string[] = [`"a":${JSON.stringify(String(action.type))}`];
  if (action.payload !== undefined) {
    parts.push(`"pl":${serialise(action.payload, 0, ctx)}`);
  }
  if (action.meta !== undefined) {
    parts.push(`"m":${serialise(action.meta, 0, ctx)}`);
  }
  if (action.error !== undefined) {
    parts.push(`"er":${serialise(action.error, 0, ctx)}`);
  }
  const extras: string[] = [];
  for (const [key, entry] of Object.entries(action)) {
    if (KNOWN_ACTION_KEYS.has(key) || entry === undefined) {
      continue;
    }
    extras.push(`${JSON.stringify(key)}:${serialise(entry, 0, ctx)}`);
  }
  if (extras.length > 0) {
    parts.push(`"x":{${extras.join(",")}}`);
  }
  parts.push(`"t":${at}`);
  return `{${parts.join(",")}}`;
}

function eventLine(
  kind: string,
  at: number,
  extra: Record<string, string | number | undefined>,
): string {
  const parts: string[] = [`"e":"${kind}"`];
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) {
      continue;
    }
    parts.push(`${JSON.stringify(key)}:${JSON.stringify(value)}`);
  }
  parts.push(`"t":${at}`);
  return `{${parts.join(",")}}`;
}

function stateLine(state: unknown, at: number): string {
  return `{"s":${serialise(state, 0, newSerialiseContext())},"t":${at}}`;
}

function htmlLine(html: string, at: number): string {
  return `{"h":${JSON.stringify(html)},"t":${at}}`;
}

function lineTime(text: string): number | undefined {
  const match = /"t":(\d+)/.exec(text);
  return match === null ? undefined : Number.parseInt(match[1], 10);
}

function lastRecStartIndex(lines: Line[]): number {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].kind === "n" && lines[i].text.includes('"recStart"')) {
      return i;
    }
  }
  return -1;
}

export function createReduxRecorder(options: ReduxRecorderOptions = {}): ReduxRecorder {
  const storage =
    options.storage === undefined ? resolveBrowserStorage() : options.storage;
  const limits: RecorderLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const windowId = options.windowId ?? randomWindowId();
  const now = options.now ?? Date.now;

  let memory: Line[] = [];
  let log: Line[] = [];
  let logBytes = 0;
  let logTruncated = false;
  let recording = false;
  let startedAt = 0;
  let recStartIndex = -1;
  let getState: (() => unknown) | null = null;
  let dirty = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let brokenStorage = false;

  hydrate();

  function hydrate(): void {
    if (storage === null) {
      return;
    }
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    const record = persistedRecordSchema.safeParse(parsed);
    if (!record.success) {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    log = record.data.lines.map(([kind, text]) => ({ kind, text }));
    logBytes = log.reduce((total, line) => total + line.text.length + 1, 0);
    recording = record.data.recording;
    startedAt = record.data.startedAt;
    logTruncated = record.data.truncated;
    recStartIndex = lastRecStartIndex(log);
    memory = log.slice(-limits.memoryLines);
  }

  function pushMemory(line: Line): void {
    memory.push(line);
    if (memory.length > limits.memoryLines) {
      memory.splice(0, memory.length - limits.memoryLines);
    }
  }

  function evictFront(count: number): void {
    const drop = Math.min(count, log.length);
    if (drop <= 0) {
      return;
    }
    for (const line of log.splice(0, drop)) {
      logBytes -= line.text.length + 1;
    }
    recStartIndex = Math.max(-1, recStartIndex - drop);
    if (drop > 0) {
      logTruncated = true;
    }
  }

  function pushLog(line: Line): void {
    log.push(line);
    logBytes += line.text.length + 1;
    while (log.length > limits.logMaxLines || logBytes > limits.logMaxBytes) {
      if (log.length <= 1) {
        break;
      }
      evictFront(1);
    }
    schedulePersist();
  }

  function schedulePersist(): void {
    dirty = true;
    if (flushTimer !== null) {
      return;
    }
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, limits.flushDelayMs);
  }

  function persist(): void {
    if (storage === null) {
      return;
    }
    if (log.length === 0 && !recording) {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    const payload = JSON.stringify({
      v: 1,
      recording,
      startedAt,
      truncated: logTruncated,
      lines: log.map((line) => [line.kind, line.text]),
    });
    try {
      storage.setItem(STORAGE_KEY, payload);
    } catch {
      // Quota exceeded or storage disabled: halve the log and retry once so
      // recording continues in memory rather than stopping silently.
      evictFront(Math.ceil(log.length / 2));
      const reduced = JSON.stringify({
        v: 1,
        recording,
        startedAt,
        truncated: logTruncated,
        lines: log.map((line) => [line.kind, line.text]),
      });
      try {
        storage.setItem(STORAGE_KEY, reduced);
      } catch {
        brokenStorage = true;
      }
    }
  }

  function flush(): void {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!dirty) {
      return;
    }
    dirty = false;
    persist();
  }

  function buildExport(
    mode: "capture" | "recording" | "last",
    lines: Line[],
    info: { rec: boolean },
  ): RecorderExport {
    const at = now();
    const firstTime = lines.length > 0 ? lineTime(lines[0].text) : undefined;
    const lastTime = lines.length > 0 ? lineTime(lines[lines.length - 1].text) : undefined;
    const header = JSON.stringify({
      meta: "agent-starter-redux-recorder",
      v: 1,
      mode,
      rec: info.rec,
      cut: logTruncated,
      t0: firstTime ?? at,
      t1: lastTime ?? at,
      n: lines.length,
      w: windowId,
      u: currentUrl(),
      legend: LEGEND,
    });
    const text = `${header}\n${lines.map((line) => line.text).join("\n")}\n`;
    return {
      text,
      lines: lines.length,
      actions: lines.filter((line) => line.kind === "a").length,
      bytes: text.length,
    };
  }

  function noteAction(action: unknown): void {
    if (typeof action !== "object" || action === null || Array.isArray(action)) {
      return;
    }
    const record = action as Record<string, unknown>;
    const type = record.type;
    if (typeof type !== "string" || type.startsWith("@@redux/")) {
      return;
    }
    const line: Line = { kind: "a", text: actionLine(record, now()) };
    pushMemory(line);
    if (recording) {
      pushLog(line);
    }
  }

  function noteLoad(at: number): void {
    const load: Line = {
      kind: "n",
      text: eventLine("load", at, { u: currentUrl(), w: windowId }),
    };
    pushMemory(load);
    if (recording) {
      pushLog(load);
      if (getState !== null) {
        pushLog({ kind: "n", text: stateLine(getState(), at) });
      }
    }
  }

  function tailWindow(maxActions: number): Line[] {
    if (maxActions <= 0) {
      return [];
    }
    const taken: Line[] = [];
    let actions = 0;
    for (let i = memory.length - 1; i >= 0; i -= 1) {
      const line = memory[i];
      taken.push(line);
      if (line.kind === "a") {
        actions += 1;
      }
      if (actions >= maxActions) {
        break;
      }
    }
    return taken.reverse();
  }

  function attachStore(getStateFn: () => unknown): void {
    getState = getStateFn;
    noteLoad(now());
  }

  function startRecording(): { started: boolean } {
    if (recording) {
      return { started: false };
    }
    recording = true;
    startedAt = now();
    log = [];
    logBytes = 0;
    logTruncated = false;
    const start: Line = {
      kind: "n",
      text: eventLine("recStart", startedAt, { u: currentUrl() }),
    };
    pushLog(start);
    recStartIndex = 0;
    pushMemory(start);
    if (getState !== null) {
      pushLog({ kind: "n", text: stateLine(getState(), startedAt) });
    }
    schedulePersist();
    return { started: true };
  }

  function stopRecording(html?: string): RecorderExport | null {
    if (!recording) {
      return null;
    }
    const at = now();
    const tail: Line[] = [];
    if (html !== undefined) {
      tail.push({ kind: "n", text: htmlLine(html, at) });
    }
    if (getState !== null) {
      tail.push({ kind: "n", text: stateLine(getState(), at) });
    }
    tail.push({ kind: "n", text: eventLine("recStop", at, { u: currentUrl() }) });
    for (const line of tail) {
      pushLog(line);
      pushMemory(line);
    }
    const from = recStartIndex >= 0 ? recStartIndex : 0;
    const capture = buildExport("recording", log.slice(from), { rec: true });
    recording = false;
    flush();
    return capture;
  }

  function captureNow(html?: string): RecorderExport {
    const at = now();
    const windowLines = tailWindow(limits.retroActions);
    const tail: Line[] = [
      { kind: "n", text: eventLine("capture", at, { u: currentUrl() }) },
    ];
    if (html !== undefined) {
      tail.push({ kind: "n", text: htmlLine(html, at) });
    }
    if (getState !== null) {
      tail.push({ kind: "n", text: stateLine(getState(), at) });
    }
    for (const line of tail) {
      pushMemory(line);
    }
    if (recording) {
      for (const line of tail) {
        pushLog(line);
      }
    }
    return buildExport("capture", [...windowLines, ...tail], { rec: recording });
  }

  function recopyLastRecording(): RecorderExport | null {
    if (log.length === 0) {
      return null;
    }
    return buildExport("last", log, { rec: false });
  }

  function clear(): void {
    memory = [];
    log = [];
    logBytes = 0;
    logTruncated = false;
    recording = false;
    startedAt = 0;
    recStartIndex = -1;
    dirty = false;
    if (storage !== null) {
      storage.removeItem(STORAGE_KEY);
    }
    pushMemory({ kind: "n", text: eventLine("clear", now(), { w: windowId }) });
  }

  function notePageHide(): void {
    if (recording) {
      const at = now();
      const event: Line = { kind: "n", text: eventLine("pagehide", at, {}) };
      if (getState !== null) {
        pushLog({ kind: "n", text: stateLine(getState(), at) });
      }
      pushLog(event);
      pushMemory(event);
    }
    flush();
  }

  // Wrapping the root reducer (not dispatch) sees exactly the plain actions
  // the reducers receive — thunks are already resolved by the middleware
  // enhancer above — without touching the store's generic dispatch type.
  const enhancer: StoreEnhancer = (createStore) => (reducer, preloadedState) => {
    const instrumented: typeof reducer = (state, action) => {
      noteAction(action);
      return reducer(state, action);
    };
    return createStore(instrumented, preloadedState);
  };

  return {
    enhancer,
    attachStore,
    isRecording: () => recording,
    status: () => ({ recording, startedAt, lines: log.length }),
    storageBroken: () => brokenStorage,
    startRecording,
    stopRecording,
    captureNow,
    recopyLastRecording,
    clear,
    notePageHide,
    flush,
    noteAction,
  };
}

/** Shared instance wired into the app store and the keyboard shortcuts. */
export const appReduxRecorder = createReduxRecorder();
