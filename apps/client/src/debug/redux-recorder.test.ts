import { configureStore, type UnknownAction } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import {
  createReduxRecorder,
  type ReduxRecorder,
  type StorageLike,
} from "./redux-recorder.ts";

function createFakeStorage(): StorageLike & { dump(): string | null } {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
    removeItem: () => {
      value = null;
    },
    dump: () => value,
  };
}

function createFakeNow(): () => number {
  let at = 1_700_000_000_000;
  return () => {
    at += 1;
    return at;
  };
}

function counterReducer(
  state = { count: 0 },
  action: UnknownAction & { payload?: { secret?: string } },
) {
  if (action.type === "test/increment") {
    return { count: state.count + 1 };
  }
  if (action.type === "test/storeSecret") {
    return { count: state.count, sessionToken: action.payload?.secret ?? "unset" };
  }
  return state;
}

function makeStore(recorder: ReduxRecorder) {
  return configureStore({
    reducer: { counter: counterReducer },
    enhancers: (getDefaultEnhancers) =>
      getDefaultEnhancers().concat(recorder.enhancer),
  });
}

function bodyLines(capture: { text: string }): unknown[] {
  return capture.text
    .split("\n")
    .filter((line) => line.length > 0)
    .slice(1)
    .map((line) => JSON.parse(line));
}

describe("redux recorder", () => {
  it("records the plain actions reducers see, not the thunk that dispatched them", () => {
    const recorder = createReduxRecorder({ storage: null, now: createFakeNow() });
    const store = makeStore(recorder);
    recorder.attachStore(store.getState.bind(store));

    store.dispatch({ type: "test/one" });
    store.dispatch((dispatch) => {
      dispatch({ type: "test/two" });
      dispatch({ type: "test/three" });
    });

    const capture = recorder.captureNow();
    const types = bodyLines(capture)
      .map((line) => (line as { a?: string }).a)
      .filter((type): type is string => type !== undefined);
    expect(types).toEqual(["test/one", "test/two", "test/three"]);
    expect(capture.actions).toBe(3);

    const header = JSON.parse(capture.text.split("\n")[0]) as {
      legend: { a: string };
    };
    expect(header.legend.a).toBe("action type");
  });

  it("keeps a rolling window so captures work when not recording", () => {
    const recorder = createReduxRecorder({
      storage: null,
      now: createFakeNow(),
      limits: { retroActions: 10 },
    });
    const store = makeStore(recorder);
    recorder.attachStore(store.getState.bind(store));

    for (let i = 0; i < 25; i += 1) {
      store.dispatch({ type: "test/increment", payload: { i } });
    }

    const capture = recorder.captureNow();
    expect(capture.actions).toBe(10);
    const firstAction = bodyLines(capture).find(
      (line) => (line as { a?: string }).a !== undefined,
    ) as { a: string; pl: { i: number } };
    expect(firstAction.a).toBe("test/increment");
    expect(firstAction.pl.i).toBe(15);
  });

  it("resumes recording across a simulated page reload and exports one capture", () => {
    const storage = createFakeStorage();
    const now = createFakeNow();
    const first = createReduxRecorder({ storage, now });
    const storeA = makeStore(first);
    first.attachStore(storeA.getState.bind(storeA));
    expect(first.startRecording().started).toBe(true);
    storeA.dispatch({ type: "test/before" });
    first.flush();

    const second = createReduxRecorder({ storage, now });
    expect(second.isRecording()).toBe(true);
    const storeB = makeStore(second);
    second.attachStore(storeB.getState.bind(storeB));
    storeB.dispatch({ type: "test/after" });

    const capture = second.stopRecording();
    expect(capture).not.toBeNull();
    const lines = bodyLines(capture ?? { text: "" });
    const events = lines
      .map((line) => (line as { e?: string }).e)
      .filter((event): event is string => event !== undefined);
    expect(events[0]).toBe("recStart");
    expect(events).toContain("load");
    expect(events.at(-1)).toBe("recStop");
    const types = lines
      .map((line) => (line as { a?: string }).a)
      .filter((type): type is string => type !== undefined);
    expect(types).toEqual(["test/before", "test/after"]);
    const states = lines.filter((line) => (line as { s?: unknown }).s !== undefined);
    expect(states.length).toBeGreaterThanOrEqual(2);
    expect(second.isRecording()).toBe(false);
  });

  it("redacts token-like string values in actions and state", () => {
    const recorder = createReduxRecorder({ storage: null, now: createFakeNow() });
    const store = makeStore(recorder);
    recorder.attachStore(store.getState.bind(store));

    store.dispatch({
      type: "test/leak",
      payload: { accessToken: "x".repeat(32), name: "visible" },
    });
    store.dispatch({ type: "test/storeSecret", payload: { secret: "y".repeat(24) } });

    const text = recorder.captureNow().text;
    expect(text).toContain("<r:32>");
    expect(text).toContain("<r:24>");
    expect(text).not.toContain("xxxxxxxx");
    expect(text).not.toContain("yyyyyyyy");
    expect(text).toContain("visible");
  });

  it("marks truncation, depth and cycles instead of exploding", () => {
    const recorder = createReduxRecorder({ storage: null, now: createFakeNow() });
    recorder.noteAction({
      type: "test/markers",
      payload: { long: "y".repeat(2000) },
    });
    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 15; i += 1) {
      const next: Record<string, unknown> = {};
      deep.child = next;
      deep = next;
    }
    recorder.noteAction({ type: "test/deep", payload: deep });
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    recorder.noteAction({ type: "test/cycle", payload: cycle });

    const text = recorder.captureNow().text;
    expect(text).toContain("<+800>");
    expect(text).toContain("<deep>");
    expect(text).toContain("<cycle>");
  });

  it("ignores redux internals and non-plain actions", () => {
    const recorder = createReduxRecorder({ storage: null, now: createFakeNow() });
    recorder.noteAction({ type: "@@redux/REPLACE" });
    recorder.noteAction(() => undefined);
    recorder.noteAction(["not", "an", "action"]);
    recorder.noteAction("also not an action");
    recorder.noteAction(null);
    recorder.noteAction({ type: 42 });

    expect(recorder.captureNow().actions).toBe(0);
  });

  it("drops the oldest log lines when caps are hit and flags the export", () => {
    const recorder = createReduxRecorder({
      storage: null,
      now: createFakeNow(),
      limits: { logMaxLines: 3, logMaxBytes: 1_000_000 },
    });
    const store = makeStore(recorder);
    recorder.attachStore(store.getState.bind(store));
    recorder.startRecording();
    for (let i = 0; i < 10; i += 1) {
      store.dispatch({ type: "test/increment" });
    }

    const capture = recorder.stopRecording();
    expect(capture).not.toBeNull();
    const header = JSON.parse((capture ?? { text: "" }).text.split("\n")[0]) as {
      cut: boolean;
    };
    expect(header.cut).toBe(true);
    expect((capture ?? { actions: 10 }).actions).toBeLessThan(10);
  });

  it("re-copies the last recording and clears persisted data", () => {
    const storage = createFakeStorage();
    const recorder = createReduxRecorder({ storage, now: createFakeNow() });
    const store = makeStore(recorder);
    recorder.attachStore(store.getState.bind(store));
    recorder.startRecording();
    store.dispatch({ type: "test/increment" });
    const stopped = recorder.stopRecording();
    expect(stopped).not.toBeNull();
    expect(storage.dump()).not.toBeNull();

    const again = recorder.recopyLastRecording();
    expect(again).not.toBeNull();
    expect((again ?? { lines: 0 }).lines).toBe((stopped ?? { lines: -1 }).lines);

    recorder.clear();
    expect(recorder.recopyLastRecording()).toBeNull();
    expect(storage.dump()).toBeNull();
    expect(recorder.isRecording()).toBe(false);
  });

  it("keeps recording in memory when storage writes fail", () => {
    const storage = createFakeStorage();
    storage.setItem = () => {
      throw new Error("quota exceeded");
    };
    const recorder = createReduxRecorder({ storage, now: createFakeNow() });
    const store = makeStore(recorder);
    recorder.attachStore(store.getState.bind(store));
    recorder.startRecording();
    store.dispatch({ type: "test/increment" });
    recorder.flush();

    expect(recorder.storageBroken()).toBe(true);
    const capture = recorder.stopRecording();
    expect(capture).not.toBeNull();
    expect((capture ?? { actions: 0 }).actions).toBe(1);
  });
});
