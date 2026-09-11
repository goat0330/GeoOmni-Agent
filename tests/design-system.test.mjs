import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFile(path.join(root, relative), "utf8");

test("design tokens capture GeoOmni semantic system", async () => {
  const css = await read("design-system/tokens.css");
  for (const token of ["--geo-color-primary", "--geo-bg-surface", "--geo-text-primary", "--geo-radius-dialog", "--geo-shadow-dialog", "--geo-font-family"]) {
    assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("design system is light-scoped and does not globally restyle body", async () => {
  const css = await read("design-system/base.css");
  assert.match(css, /\.geo-ui[\s\S]*color-scheme:\s*light/);
  assert.doesNotMatch(css, /(^|\})\s*body\s*\{/m);
});

test("both application entries load design system after compiled stylesheet", async () => {
  for (const file of ["index.html", "native.html"]) {
    const html = await read(file);
    const compiled = html.indexOf("/assets/index-");
    const design = html.indexOf("/design-system/index.css");
    assert.ok(compiled >= 0, `${file} should retain compiled stylesheet`);
    assert.ok(design > compiled, `${file} should load design system after compiled stylesheet`);
  }
});

test("golden reference uses reusable primitives and recipient pattern", async () => {
  const html = await read("design-system/examples.html");
  assert.match(html, /geo-ui-dialog/);
  assert.match(html, /geo-ui-button--primary/);
  assert.match(html, /geo-pattern-recipient/);
});

test("agent contract is installed", async () => {
  const agents = await read("AGENTS.md");
  assert.match(agents, /GEOOMNI_DESIGN_SYSTEM_CONTRACT_V1/);
  assert.match(agents, /design-system\/DESIGN\.md/);
});
