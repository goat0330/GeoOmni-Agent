import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "design-system/DESIGN.md", "design-system/COMPONENTS.md", "design-system/tokens.css", "design-system/base.css",
  "design-system/primitives.css", "design-system/patterns.css", "design-system/theme-bridge.css",
  "design-system/index.css", "design-system/examples.html", "AGENTS.md"
];
const errors = [];

for (const relative of required) {
  try { await readFile(path.join(root, relative)); }
  catch { errors.push(`missing required file: ${relative}`); }
}

for (const htmlName of ["index.html", "native.html"]) {
  try {
    const html = await readFile(path.join(root, htmlName), "utf8");
    const mainIndex = html.indexOf("/assets/index-");
    const dsIndex = html.indexOf("/design-system/index.css");
    if (dsIndex < 0) errors.push(`${htmlName}: design-system/index.css not loaded`);
    if (mainIndex >= 0 && dsIndex >= 0 && dsIndex < mainIndex) errors.push(`${htmlName}: Design System must load after the compiled app stylesheet`);
  } catch { errors.push(`${htmlName}: unreadable`); }
}

const ignoredTop = new Set(["node_modules", ".git", "mirror-clean6", ".design-system-backup"]);
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (dir === root && ignoredTop.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

for (const file of await walk(root)) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (relative.startsWith("design-system/")) continue;
  const text = await readFile(file, "utf8");
  if (!text.includes("@geo-design-enforce")) continue;

  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const rawColor = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/;
  const rawRadius = /border-radius\s*:\s*\d+(?:\.\d+)?px\b/;
  const rawFont = /font-family\s*:\s*(?!\s*var\()/;
  if (rawColor.test(noComments)) errors.push(`${relative}: raw color detected; use --geo-* token`);
  if (rawRadius.test(noComments)) errors.push(`${relative}: raw border-radius detected; use --geo-radius-* token`);
  if (rawFont.test(noComments)) errors.push(`${relative}: raw font-family detected; use --geo-font-family or inherit`);
}

const tokens = await readFile(path.join(root, "design-system", "tokens.css"), "utf8").catch(() => "");
for (const token of ["--geo-color-primary", "--geo-bg-surface", "--geo-text-primary", "--geo-radius-dialog", "--geo-font-family"]) {
  if (!tokens.includes(token)) errors.push(`tokens.css: missing ${token}`);
}
const base = await readFile(path.join(root, "design-system", "base.css"), "utf8").catch(() => "");
if (!base.includes("color-scheme: light")) errors.push("base.css: scoped light color-scheme missing");

if (errors.length) {
  console.error("GeoOmni Design System audit: FAIL");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("GeoOmni Design System audit: PASS");
