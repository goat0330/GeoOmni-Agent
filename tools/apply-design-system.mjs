import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const marker = "GEOOMNI_DESIGN_SYSTEM_CONTRACT_V1";
const cssHref = "/design-system/index.css";
const backupRoot = path.join(root, ".design-system-backup", "v1");

async function exists(file) { try { await access(file); return true; } catch { return false; } }

async function backup(name) {
  const source = path.join(root, name);
  await mkdir(backupRoot, { recursive: true });
  const destination = path.join(backupRoot, name);
  const markerFile = path.join(backupRoot, `${name.replaceAll("/", "__")}.absent`);
  // Once the pre-install state is recorded, never replace it on later idempotent runs.
  if (await exists(destination) || await exists(markerFile)) return;
  if (await exists(source)) {
    await copyFile(source, destination);
  } else {
    await writeFile(markerFile, "absent before GeoOmni Design System v1\n", "utf8");
  }
}

function injectStylesheet(html, filename) {
  if (html.includes(cssHref)) return html;
  const link = `    <link rel="stylesheet" href="${cssHref}" />`;
  const compiledCss = /^(\s*)<link\s+rel="stylesheet"\s+crossorigin\s+href="\/assets\/index-[^"]+\.css"\s*\/>/m;
  if (compiledCss.test(html)) return html.replace(compiledCss, match => `${match}\n${link}`);
  if (html.includes("</head>")) return html.replace("</head>", `${link}\n  </head>`);
  throw new Error(`${filename}: unable to locate </head> or compiled stylesheet anchor`);
}

async function patchHtml(name) {
  const file = path.join(root, name);
  const text = await readFile(file, "utf8");
  if (checkOnly) {
    if (!text.includes(cssHref)) throw new Error(`${name}: Design System stylesheet is not installed`);
    return;
  }
  await backup(name);
  const next = injectStylesheet(text, name);
  if (next !== text) await writeFile(file, next, "utf8");
}

async function patchPackage() {
  const name = "package.json";
  const file = path.join(root, name);
  const text = await readFile(file, "utf8");
  const pkg = JSON.parse(text);
  const required = {
    "design:apply": "node tools/apply-design-system.mjs",
    "design:check": "node tools/apply-design-system.mjs --check",
    "design:audit": "node scripts/design-system-audit.mjs",
    "design:test": "node --test tests/design-system.test.mjs"
  };
  if (checkOnly) {
    for (const [key, value] of Object.entries(required)) if (pkg.scripts?.[key] !== value) throw new Error(`package.json: missing ${key}`);
    return;
  }
  await backup(name);
  pkg.scripts ||= {};
  let changed = false;
  for (const [key, value] of Object.entries(required)) {
    if (pkg.scripts[key] !== value) { pkg.scripts[key] = value; changed = true; }
  }
  if (changed) await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

async function patchAgents() {
  const name = "AGENTS.md";
  const file = path.join(root, name);
  const snippet = await readFile(path.join(root, "templates", "AGENTS.design-system.snippet.md"), "utf8");
  const present = await exists(file);
  const current = present ? await readFile(file, "utf8") : "# Repository Agent Instructions\n";
  if (checkOnly) {
    if (!current.includes(marker)) throw new Error("AGENTS.md: GeoOmni Design System contract is not installed");
    return;
  }
  await backup(name);
  if (!current.includes(marker)) await writeFile(file, `${current.trimEnd()}\n\n${snippet.trim()}\n`, "utf8");
}

async function patchGitignore() {
  const name = ".gitignore";
  const file = path.join(root, name);
  const line = ".design-system-backup/";
  const present = await exists(file);
  const current = present ? await readFile(file, "utf8") : "";
  if (checkOnly) {
    if (!current.split(/\r?\n/).includes(line)) throw new Error(".gitignore: missing .design-system-backup/");
    return;
  }
  await backup(name);
  if (!current.split(/\r?\n/).includes(line)) {
    const prefix = current.trimEnd();
    await writeFile(file, `${prefix}${prefix ? "\n\n" : ""}# GeoOmni Design System local backup\n${line}\n`, "utf8");
  }
}

async function validatePayload() {
  const required = [
    "design-system/DESIGN.md", "design-system/COMPONENTS.md", "design-system/tokens.css", "design-system/base.css",
    "design-system/primitives.css", "design-system/patterns.css", "design-system/theme-bridge.css",
    "design-system/index.css", "design-system/examples.html", "scripts/design-system-audit.mjs",
    "tests/design-system.test.mjs", "templates/AGENTS.design-system.snippet.md"
  ];
  for (const relative of required) if (!(await exists(path.join(root, relative)))) throw new Error(`missing payload: ${relative}`);
}

await validatePayload();
await patchHtml("index.html");
await patchHtml("native.html");
await patchPackage();
await patchAgents();
await patchGitignore();
console.log(`[GeoOmni Design System] ${checkOnly ? "check passed" : "installed"}: ${root}`);
