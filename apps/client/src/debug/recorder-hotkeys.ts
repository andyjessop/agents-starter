import { domToJade, type JadeDomNode } from "./dom-to-jade.ts";
import { appReduxRecorder, type RecorderExport } from "./redux-recorder.ts";

/**
 * Browser wiring for the debug Redux recorder: keyboard-only controls, DOM
 * toasts and a REC badge that live outside Redux and React so they keep
 * working when the app itself is the bug. Shortcuts:
 *
 * - Alt+Shift+R — start recording (survives refreshes)
 * - Alt+Shift+S — stop recording and copy the JSONL capture
 * - Alt+Shift+C — copy current state + last 100 actions + DOM snapshot,
 *   even when not recording (recording is not interrupted)
 * - Alt+Shift+X — clear recorded data
 *
 * Every capture also embeds a Jade/Pug snapshot of the live DOM.
 */

const RECORDER_PREFIX = "debug-recorder-";
const STYLE_ID = `${RECORDER_PREFIX}style`;

const RECORDER_CSS = `
@layer app {
  .${RECORDER_PREFIX}overlay {
    --${RECORDER_PREFIX}z: 2147483000;
  }
  .${RECORDER_PREFIX}toast-stack {
    position: fixed;
    right: var(--ui-space-4);
    bottom: var(--ui-space-4);
    z-index: var(--${RECORDER_PREFIX}z);
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    pointer-events: none;
  }
  .${RECORDER_PREFIX}toast {
    background: var(--ui-surface-raised);
    color: var(--ui-text);
    font-family: var(--ui-font-sans);
    font-size: var(--ui-font-size-sm);
    line-height: 1.4;
    padding: var(--ui-space-2) var(--ui-space-3);
    border-radius: var(--ui-radius-md);
    box-shadow: 0 var(--ui-space-1) var(--ui-space-3) var(--ui-shadow-ink);
    max-width: 28rem;
    animation: ${RECORDER_PREFIX}in 160ms ease-out;
    transition: opacity 200ms ease-in;
  }
  .${RECORDER_PREFIX}toast-warn {
    border: var(--ui-border-width-strong) var(--ui-border-style) var(--ui-danger);
  }
  .${RECORDER_PREFIX}toast-out {
    opacity: 0;
  }
  .${RECORDER_PREFIX}badge {
    position: fixed;
    left: var(--ui-space-4);
    bottom: var(--ui-space-4);
    z-index: var(--${RECORDER_PREFIX}z);
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    background: var(--ui-surface-raised);
    color: var(--ui-text);
    font-family: var(--ui-font-mono);
    font-size: var(--ui-font-size-xs);
    padding: var(--ui-space-1) var(--ui-space-2);
    border-radius: var(--ui-radius-pill);
    box-shadow: 0 var(--ui-space-1) var(--ui-space-3) var(--ui-shadow-ink);
    pointer-events: none;
  }
  .${RECORDER_PREFIX}badge[hidden] {
    display: none;
  }
  .${RECORDER_PREFIX}badge::before {
    content: "";
    width: var(--ui-space-2);
    height: var(--ui-space-2);
    border-radius: var(--ui-radius-pill);
    background: var(--ui-danger);
    animation: ${RECORDER_PREFIX}pulse 1.6s ease-in-out infinite;
  }
  .${RECORDER_PREFIX}copy-fallback {
    position: fixed;
    opacity: 0;
    pointer-events: none;
  }
}
@keyframes ${RECORDER_PREFIX}in {
  from {
    opacity: 0;
    transform: translateY(var(--ui-space-1));
  }
}
@keyframes ${RECORDER_PREFIX}pulse {
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .${RECORDER_PREFIX}toast,
  .${RECORDER_PREFIX}badge::before {
    animation: none;
    transition: none;
  }
}
`;

const SHORTCUTS: Record<string, "start" | "stop" | "capture" | "clear"> = {
  KeyR: "start",
  KeyS: "stop",
  KeyC: "capture",
  KeyX: "clear",
};

let installed = false;

function isRecorderElement(element: JadeDomNode): boolean {
  const attributes = element.attributes;
  if (attributes === undefined) {
    return false;
  }
  for (let i = 0; i < attributes.length; i += 1) {
    const { name, value } = attributes[i];
    if (name === "id" && value.startsWith(RECORDER_PREFIX)) {
      return true;
    }
    if (
      name === "class" &&
      value.split(/\s+/).some((token) => token.startsWith(RECORDER_PREFIX))
    ) {
      return true;
    }
  }
  return false;
}

function captureDomJade(): string {
  return domToJade(document.documentElement, { skip: isRecorderElement });
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function copyText(text: string): Promise<"clipboard" | "fallback" | "download"> {
  try {
    await navigator.clipboard.writeText(text);
    return "clipboard";
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const holder = document.createElement("textarea");
    holder.value = text;
    holder.className = `${RECORDER_PREFIX}copy-fallback`;
    document.body.append(holder);
    holder.select();
    const copied = document.execCommand("copy");
    holder.remove();
    if (copied) {
      return "fallback";
    }
  } catch {
    // Fall through to the download path.
  }
  const blob = new Blob([text], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agent-starter-redux-${Date.now()}.jsonl`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return "download";
}

export function installReduxRecorderHotkeys(): void {
  if (installed) {
    return;
  }
  installed = true;

  if (document.getElementById(STYLE_ID) === null) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = RECORDER_CSS;
    document.head.append(style);
  }

  const stack = document.createElement("div");
  stack.className = `${RECORDER_PREFIX}overlay ${RECORDER_PREFIX}toast-stack`;
  document.body.append(stack);

  const badge = document.createElement("div");
  badge.className = `${RECORDER_PREFIX}overlay ${RECORDER_PREFIX}badge`;
  badge.textContent = "REC";
  badge.hidden = true;
  document.body.append(badge);

  const syncBadge = (): void => {
    badge.hidden = !appReduxRecorder.isRecording();
  };

  const toast = (message: string, tone: "info" | "warn" = "info"): void => {
    const element = document.createElement("div");
    element.className = `${RECORDER_PREFIX}toast${
      tone === "warn" ? ` ${RECORDER_PREFIX}toast-warn` : ""
    }`;
    element.textContent = message;
    stack.append(element);
    window.setTimeout(() => {
      element.classList.add(`${RECORDER_PREFIX}toast-out`);
      window.setTimeout(() => element.remove(), 220);
    }, 3200);
  };

  const copyExport = async (capture: RecorderExport, label: string): Promise<void> => {
    const how = await copyText(capture.text);
    if (how === "download") {
      toast(`⚠ ${label} — clipboard blocked; downloaded .jsonl (${formatKb(capture.bytes)})`, "warn");
      return;
    }
    if (appReduxRecorder.storageBroken()) {
      toast("⚠ Recorder storage is failing; this capture was memory-only", "warn");
    }
    toast(`${label} — ${capture.lines} lines, ${formatKb(capture.bytes)}`);
  };

  const stopAndCopy = async (): Promise<void> => {
    const capture = appReduxRecorder.stopRecording(captureDomJade());
    syncBadge();
    if (capture === null) {
      const last = appReduxRecorder.recopyLastRecording();
      if (last === null) {
        toast("Not recording — nothing to copy");
        return;
      }
      await copyExport(last, "Copied previous recording");
      return;
    }
    await copyExport(capture, "⏹ Recording stopped");
  };

  const captureNow = async (): Promise<void> => {
    const capture = appReduxRecorder.captureNow(captureDomJade());
    const still = appReduxRecorder.isRecording() ? " — still recording" : "";
    await copyExport(capture, `✦ Captured state + ${capture.actions} actions${still}`);
  };

  const runShortcut = (kind: "start" | "stop" | "capture" | "clear"): void => {
    if (kind === "start") {
      const result = appReduxRecorder.startRecording();
      if (!result.started) {
        const status = appReduxRecorder.status();
        const seconds = Math.max(1, Math.round((Date.now() - status.startedAt) / 1000));
        toast(`⏺ Already recording (${seconds}s, ${status.lines} lines)`);
        return;
      }
      syncBadge();
      toast("⏺ Recording started — Alt+Shift+S stops and copies");
      return;
    }
    if (kind === "stop") {
      void stopAndCopy();
      return;
    }
    if (kind === "capture") {
      void captureNow();
      return;
    }
    appReduxRecorder.clear();
    syncBadge();
    toast("Recorder cleared");
  };

  syncBadge();

  window.addEventListener(
    "keydown",
    (event) => {
      if (!event.altKey || !event.shiftKey || event.metaKey || event.ctrlKey) {
        return;
      }
      if (event.repeat || event.isComposing) {
        return;
      }
      const kind = SHORTCUTS[event.code];
      if (kind === undefined) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      runShortcut(kind);
    },
    { capture: true },
  );

  window.addEventListener("pagehide", () => {
    appReduxRecorder.notePageHide();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      appReduxRecorder.flush();
    }
  });
}
