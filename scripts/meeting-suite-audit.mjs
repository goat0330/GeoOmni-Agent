import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
async function read(relative) { try { return await readFile(path.join(root, relative), "utf8"); } catch { errors.push(`missing ${relative}`); return ""; } }
const serve = await read("serve.mjs");
const index = await read("index.html");
const native = await read("native.html");
const js = await read("meeting-feature/meeting-suite.js");
const css = await read("meeting-feature/meeting-suite.css");
const agents = await read("AGENTS.md");
for (const [name, html] of [["index.html", index], ["native.html", native]]) {
  if (!html.includes('/meeting-feature/meeting-suite.css')) errors.push(`${name} missing Meeting Suite CSS`);
  if (!html.includes('/meeting-feature/meeting-suite.js')) errors.push(`${name} missing Meeting Suite JS`);
  if (!html.includes('"/meeting-history"')) errors.push(`${name} missing history route allow-list`);
  if (html.indexOf('/meeting-feature/meeting-suite.css') < html.indexOf('/design-system/index.css')) errors.push(`${name} Meeting Suite CSS must load after Design System`);
}
for (const needle of [
  "GEOOMNI_MEETING_SUITE_V2", '"/meeting-history"',
  '["/meeting-feature/", path.join(root, "meeting-feature")]',
  'url.pathname === "/api/dizai/meeting/history"', "localMeetingContext", "localMeetingRecords"
]) if (!serve.includes(needle)) errors.push(`serve.mjs missing ${needle}`);
for (const needle of [
  "geo-meeting-subject-input", "确认邀请", "renderJoinDialog", "加入会议", "renderMeetingRoom",
  "ensureServerMeeting", "closeExpertDialog", "智能纪要", "toggle-pre-minutes", "toggle-room-minutes", "历史会议记录"
]) if (!js.includes(needle)) errors.push(`meeting-suite.js missing ${needle}`);
for (const forbidden of ["会商结论与响应等级确认", "协同编辑中"]) if (js.includes(forbidden)) errors.push(`meeting-suite.js still contains removed intermediate flow: ${forbidden}`);
if (!css.includes("@geo-design-enforce")) errors.push("meeting-suite.css missing design enforce marker");
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
if (/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/.test(noComments)) errors.push("meeting-suite.css contains raw color; use --geo-* token");
if (/border-radius\s*:\s*\d+(?:\.\d+)?px\b/.test(noComments)) errors.push("meeting-suite.css contains raw radius");
const rawFont = [...noComments.matchAll(/font-family\s*:\s*([^;]+)/g)].some(match => !match[1].trim().startsWith("var("));
if (rawFont) errors.push("meeting-suite.css contains raw font-family");
if (!agents.includes("GEOOMNI_MEETING_SUITE_CONTRACT_V2")) errors.push("AGENTS.md v2 meeting contract missing");
if (/1[3-9]\d{9}/.test(js)) errors.push("meeting-suite.js appears to contain a raw mobile phone number");
if (errors.length) {
  console.error("GeoOmni Meeting Suite v2 audit: FAIL");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("GeoOmni Meeting Suite v2 audit: PASS");
