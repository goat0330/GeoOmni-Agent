import { access, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupRoot = path.join(root, ".design-system-backup", "v1");
const targets = ["index.html", "native.html", "package.json", ".gitignore", "AGENTS.md"];

async function exists(file) { try { await access(file); return true; } catch { return false; } }
if (!(await exists(backupRoot))) throw new Error(`No Design System backup found at ${backupRoot}`);

for (const name of targets) {
  const source = path.join(backupRoot, name);
  const absentMarker = path.join(backupRoot, `${name.replaceAll("/", "__")}.absent`);
  const target = path.join(root, name);
  if (await exists(source)) {
    await copyFile(source, target);
    console.log(`[GeoOmni Design System] restored ${name}`);
  } else if (await exists(absentMarker) && await exists(target)) {
    await rm(target, { force: true });
    console.log(`[GeoOmni Design System] removed generated ${name}`);
  }
}
console.log("[GeoOmni Design System] integration rolled back; payload files were left in place.");
