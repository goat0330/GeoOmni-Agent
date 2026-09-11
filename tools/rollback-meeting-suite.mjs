import { access, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupRoot = path.join(root, ".meeting-suite-backup", "v2");
const targets = ["index.html", "native.html", "serve.mjs", "package.json", ".gitignore", "AGENTS.md"];
async function exists(file) { try { await access(file); return true; } catch { return false; } }
if (!(await exists(backupRoot))) throw new Error(`No Meeting Suite backup found at ${backupRoot}`);
for (const name of targets) {
  const source = path.join(backupRoot, name);
  const absent = path.join(backupRoot, `${name.replaceAll("/", "__")}.absent`);
  const target = path.join(root, name);
  if (await exists(source)) { await copyFile(source, target); console.log(`[GeoOmni Meeting Suite v2] restored ${name}`); }
  else if (await exists(absent) && await exists(target)) { await rm(target, { force: true }); console.log(`[GeoOmni Meeting Suite v2] removed generated ${name}`); }
}
console.log("[GeoOmni Meeting Suite v2] integration rolled back; meeting-feature payload files were left in place.");
