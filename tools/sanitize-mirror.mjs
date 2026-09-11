import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || path.join(process.cwd(), "mirror-clean3"));
const textExtensions = new Set([".js", ".json", ".css", ".html", ".map"]);
let changed = 0;
let replacements = 0;

async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      const before = await fs.readFile(file, "utf8");
      const after = before
        .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, () => { replacements += 1; return "REDACTED_JWT"; })
        .replace(/([?&]tk=)[A-Za-z0-9_-]{12,}/g, (_, prefix) => { replacements += 1; return `${prefix}REDACTED_MAP_TOKEN`; })
        .replace(/https:\/\/172\.16\.41\.60(?::\d+)?/g, () => { replacements += 1; return "/api/local-source"; })
        .replace(/Bearer\s+dataset-[A-Za-z0-9_-]+/g, () => { replacements += 1; return "Bearer REDACTED_DATASET_TOKEN"; });
      if (after !== before) {
        await fs.writeFile(file, after, "utf8");
        changed += 1;
      }
    }
  }
}

await walk(root);
console.log(JSON.stringify({ root, changed, replacements }, null, 2));
