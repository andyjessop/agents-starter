/**
 * Serialises a DOM subtree to compact Jade/Pug source for debug captures.
 * Only what structure debugging needs survives: tag with class/id shorthand,
 * attributes and text. Script/style bodies, comments and whitespace-only text
 * are dropped, and the output is bounded by depth and size caps. The node
 * interface is structural so the transformer works against the live DOM and
 * against fake nodes in Node unit tests.
 */

export interface JadeDomNode {
  nodeType: number;
  nodeName?: string | undefined;
  tagName?: string | undefined;
  textContent?: string | null;
  attributes?: ArrayLike<{ name: string; value: string }> | undefined;
  childNodes?: ArrayLike<JadeDomNode> | undefined;
}

export interface JadeOptions {
  maxBytes?: number | undefined;
  maxDepth?: number | undefined;
  skip?: ((element: JadeDomNode) => boolean) | undefined;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DEFAULT_MAX_BYTES = 262_144;
const DEFAULT_MAX_DEPTH = 30;
const MAX_TEXT = 300;
const MAX_ATTRIBUTE = 500;

type Attribute = { name: string; value: string };
type RenderedChild = { kind: "element"; node: JadeDomNode } | { kind: "text"; text: string };

function indent(depth: number): string {
  return "  ".repeat(depth);
}

function isShorthandSafe(token: string): boolean {
  return /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(token);
}

function escapeAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function truncateAttr(value: string): string {
  return value.length <= MAX_ATTRIBUTE
    ? value
    : `${value.slice(0, MAX_ATTRIBUTE)}…(+${value.length - MAX_ATTRIBUTE})`;
}

function normaliseText(content: string | null | undefined): string | null {
  if (typeof content !== "string") {
    return null;
  }
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length === 0) {
    return null;
  }
  return text.length <= MAX_TEXT
    ? text
    : `${text.slice(0, MAX_TEXT)}…(+${text.length - MAX_TEXT})`;
}

function formatAttribute(name: string, value: string): string {
  if (value === "") {
    return name;
  }
  return `${name}="${escapeAttr(truncateAttr(value))}"`;
}

function splitAttributes(attributes: ArrayLike<Attribute>): {
  classes: string[];
  id: string | undefined;
  rest: string[];
} {
  const classes: string[] = [];
  let id: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < attributes.length; i += 1) {
    const { name, value } = attributes[i];
    if (name === "class") {
      const tokens = value.split(/\s+/).filter((token) => token.length > 0);
      if (tokens.every(isShorthandSafe)) {
        classes.push(...tokens);
      } else {
        rest.push(formatAttribute("class", value));
      }
    } else if (name === "id") {
      if (isShorthandSafe(value)) {
        id = value;
      } else {
        rest.push(formatAttribute("id", value));
      }
    } else {
      rest.push(formatAttribute(name, value));
    }
  }
  return { classes, id, rest };
}

function elementHead(node: JadeDomNode, tag: string): string {
  const { classes, id, rest } = splitAttributes(node.attributes ?? []);
  const base = tag === "div" && (classes.length > 0 || id !== undefined) ? "" : tag;
  const shorthand = `${classes.map((name) => `.${name}`).join("")}${id === undefined ? "" : `#${id}`}`;
  return `${base}${shorthand}${rest.length > 0 ? `(${rest.join(" ")})` : ""}`;
}

function meaningfulChildren(node: JadeDomNode): RenderedChild[] {
  const children: RenderedChild[] = [];
  const childNodes = node.childNodes ?? [];
  for (let i = 0; i < childNodes.length; i += 1) {
    const child = childNodes[i];
    if (child.nodeType === ELEMENT_NODE) {
      children.push({ kind: "element", node: child });
    } else if (child.nodeType === TEXT_NODE) {
      const text = normaliseText(child.textContent);
      if (text !== null) {
        children.push({ kind: "text", text });
      }
    }
  }
  return children;
}

function isElidedTag(tag: string): boolean {
  return tag === "script" || tag === "style";
}

export function domToJade(root: JadeDomNode, options: JadeOptions = {}): string {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const skip = options.skip;
  const out: string[] = [];
  let bytes = 0;
  let stopped = false;

  const push = (line: string): void => {
    if (stopped) {
      return;
    }
    out.push(line);
    bytes += line.length + 1;
    if (bytes > maxBytes) {
      out.push(`//- truncated: size cap (${maxBytes} B)`);
      stopped = true;
    }
  };

  const renderElidedBody = (node: JadeDomNode, head: string, depth: number): void => {
    const body = typeof node.textContent === "string" ? node.textContent : "";
    if (body.trim().length > 0) {
      push(`${indent(depth)}${head} (${(body.length / 1024).toFixed(1)} KB omitted)`);
      return;
    }
    push(`${indent(depth)}${head}`);
  };

  const renderChildren = (node: JadeDomNode, head: string, depth: number): void => {
    const children = meaningfulChildren(node);
    if (children.length === 0) {
      push(`${indent(depth)}${head}`);
      return;
    }
    if (children.length === 1 && children[0].kind === "text") {
      push(`${indent(depth)}${head} ${children[0].text}`);
      return;
    }
    push(`${indent(depth)}${head}`);
    for (const child of children) {
      if (child.kind === "text") {
        push(`${indent(depth + 1)}| ${child.text}`);
      } else {
        renderElement(child.node, depth + 1);
      }
    }
  };

  const renderElement = (node: JadeDomNode, depth: number): void => {
    const tag = (node.tagName ?? node.nodeName ?? "div").toLowerCase();
    if (skip?.(node) === true) {
      return;
    }
    if (depth >= maxDepth) {
      push(`${indent(depth)}//- depth cap: <${tag}> subtree omitted`);
      return;
    }
    const head = elementHead(node, tag);
    if (isElidedTag(tag)) {
      renderElidedBody(node, head, depth);
      return;
    }
    renderChildren(node, head, depth);
  };

  if (root.nodeType === ELEMENT_NODE) {
    push("doctype html");
    renderElement(root, 0);
  }
  return out.join("\n");
}
