import { describe, expect, it } from "vitest";

import { domToJade, type JadeDomNode } from "./dom-to-jade.ts";

function text(content: string): JadeDomNode {
  return { nodeType: 3, textContent: content };
}

function el(
  tag: string,
  attributes: Record<string, string> = {},
  children: JadeDomNode[] = [],
  textContent?: string,
): JadeDomNode {
  return {
    nodeType: 1,
    tagName: tag,
    attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })),
    childNodes: children,
    ...(textContent === undefined ? {} : { textContent }),
  };
}

describe("domToJade", () => {
  it("uses class/id shorthand, boolean attrs and inline text", () => {
    const jade = domToJade(
      el("div", { class: "a b", id: "root" }, [
        el("button", { class: "btn", type: "submit", disabled: "" }, [text("Save")]),
        el("span", {}, [text("  hello   world  ")]),
      ]),
    );
    expect(jade.split("\n")).toEqual([
      "doctype html",
      ".a.b#root",
      '  button.btn(type="submit" disabled) Save',
      "  span hello world",
    ]);
  });

  it("falls back to attribute form for shorthand-unsafe class or id", () => {
    const jade = domToJade(
      el("section", {}, [
        el("div", { class: "ok weird:class" }),
        el("div", { id: "1x" }),
      ]),
    );
    expect(jade.split("\n")).toEqual([
      "doctype html",
      "section",
      '  div(class="ok weird:class")',
      '  div(id="1x")',
    ]);
  });

  it("renders mixed text children as pipe lines", () => {
    const jade = domToJade(
      el("p", {}, [text("leading"), el("b", {}, [text("bold")])]),
    );
    expect(jade.split("\n")).toEqual(["doctype html", "p", "  | leading", "  b bold"]);
  });

  it("drops whitespace-only text and comments", () => {
    const jade = domToJade(
      el("div", {}, [
        text("   "),
        { nodeType: 8, textContent: "a comment" },
        text("\n\t"),
        el("i"),
      ]),
    );
    expect(jade.split("\n")).toEqual(["doctype html", "div", "  i"]);
  });

  it("elides script and style bodies but keeps their attributes", () => {
    const jade = domToJade(
      el("div", {}, [
        el("script", { src: "https://cdn.example.test/bundle.js" }, [], ""),
        el("script", {}, [], "(function(){})".repeat(200)),
        el("style", {}, [], "body { color: red }".repeat(50)),
      ]),
    );
    const lines = jade.split("\n");
    expect(lines[0]).toBe("doctype html");
    expect(lines[1]).toBe("div");
    expect(lines[2]).toBe('  script(src="https://cdn.example.test/bundle.js")');
    expect(lines[3]).toContain("KB omitted");
    expect(lines[4]).toContain("KB omitted");
  });

  it("escapes and truncates attribute values", () => {
    const jade = domToJade(
      el("div", {
        title: 'say "hi"',
        "data-big": "z".repeat(600),
      }),
    );
    expect(jade).toContain('title="say \\"hi\\""');
    expect(jade).toContain(`…(+100)`);
  });

  it("omits subtrees the skip predicate rejects", () => {
    const jade = domToJade(
      el("div", {}, [
        el("noscript", {}, [el("p", {}, [text("hidden")])]),
        el("p", {}, [text("kept")]),
      ]),
      { skip: (node) => node.tagName === "noscript" },
    );
    expect(jade).toContain("p kept");
    expect(jade).not.toContain("noscript");
    expect(jade).not.toContain("hidden");
  });

  it("stops at the size cap with a truncation marker", () => {
    const jade = domToJade(
      el("div", {}, Array.from({ length: 50 }, (_, i) => el("p", {}, [text(`line ${i}`)]))),
      { maxBytes: 80 },
    );
    expect(jade).toContain("//- truncated: size cap");
    expect(jade).not.toContain("line 49");
  });

  it("stops at the depth cap instead of recursing forever", () => {
    let node: JadeDomNode = el("p", {}, [text("bottom")]);
    for (let i = 0; i < 40; i += 1) {
      node = el("div", {}, [node]);
    }
    const jade = domToJade(node, { maxDepth: 10 });
    expect(jade).toContain("depth cap");
    expect(jade).not.toContain("bottom");
  });
});
