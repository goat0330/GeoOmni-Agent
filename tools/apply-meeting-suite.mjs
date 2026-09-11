import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "GEOOMNI_MEETING_SUITE_V2";
const LEGACY_MARKER = "GEOOMNI_MEETING_SUITE_V1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const backupRoot = path.join(root, ".meeting-suite-backup", "v2");

async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function backup(name) {
  const source = path.join(root, name);
  const destination = path.join(backupRoot, name);
  const absent = path.join(backupRoot, `${name.replaceAll("/", "__")}.absent`);
  await mkdir(path.dirname(destination), { recursive: true });
  if (await exists(destination) || await exists(absent)) return;
  if (await exists(source)) await copyFile(source, destination);
  else await writeFile(absent, "absent before GeoOmni Meeting Suite v2\n", "utf8");
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label}: expected anchor not found; current repository may have changed`);
  return source.replace(before, after);
}

function normalizeLineEndings(source) {
  return { text: source.replace(/\r\n/g, "\n"), lineEnding: source.includes("\r\n") ? "\r\n" : "\n" };
}
function restoreLineEndings(source, lineEnding) {
  return lineEnding === "\r\n" ? source.replace(/\n/g, "\r\n") : source;
}

function patchHtmlText(source, filename) {
  if (!source.includes('"/meeting-history"')) {
    source = replaceRequired(source, '"/task-track"].includes(location.pathname)', '"/task-track", "/meeting-history"].includes(location.pathname)', `${filename} route allow-list`);
  }
  if (!source.includes('/meeting-feature/meeting-suite.css')) {
    const anchor = '<link rel="stylesheet" href="/design-system/index.css" />';
    source = replaceRequired(source, anchor, `${anchor}\n    <link rel="stylesheet" href="/meeting-feature/meeting-suite.css" />`, `${filename} stylesheet`);
  }
  if (!source.includes('/meeting-feature/meeting-suite.js')) {
    source = replaceRequired(source, '</body>', '    <script src="/meeting-feature/meeting-suite.js"></script>\n  </body>', `${filename} script`);
  }
  return source;
}

async function patchHtml(name) {
  const file = path.join(root, name);
  const raw = await readFile(file, "utf8");
  const { text: source, lineEnding } = normalizeLineEndings(raw);
  if (checkOnly) {
    if (!source.includes('/meeting-feature/meeting-suite.css') || !source.includes('/meeting-feature/meeting-suite.js') || !source.includes('"/meeting-history"')) throw new Error(`${name}: Meeting Suite integration missing`);
    return;
  }
  await backup(name);
  const next = patchHtmlText(source, name);
  if (next !== source) await writeFile(file, restoreLineEndings(next, lineEnding), "utf8");
}

const stateAnchor = 'let localActiveMeetingId = "";\nlet localMeetingParticipants = [];';
const statePatch = `let localActiveMeetingId = "";\nlet localMeetingParticipants = [];\n// ${MARKER}\nlet localMeetingDraftContext = null;\nlet localMeetingContext = null;\nconst localMeetingRecords = [];`;

const participantsHelper = `function localParticipantsMap() {\n  return Object.fromEntries(localMeetingParticipants.map(userId => [String(userId), { userId }]));\n}`;
const meetingHelpers = `${participantsHelper}\n\nfunction normalizeMeetingSubject(value) {\n  return String(value || "").replace(/\\s+/g, " ").trim().slice(0, 80) || "未命名会商";\n}\n\nfunction defaultMinutesForMeeting(context = {}) {\n  const subject = normalizeMeetingSubject(context.subject);\n  return {\n    summary: \`本次会商围绕“\${subject}”展开。综合当前防御响应方案、区域风险评价和参会人员研判意见，重点关注高风险区域变化，并根据现场核查结果动态调整响应措施。\`,\n    recommendations: [\n      "维持重点区域现有响应措施，持续关注高风险区域变化。",\n      "组织责任人开展现场核查，及时补充设备状态和现场反馈记录。",\n      "根据现场核查与风险变化动态调整响应等级，形成闭环处置记录。"\n    ],\n    responsibilities: ["请责任人反馈现场核查、设备状态和风险变化，并记录处置进展。"]\n  };\n}\n\nfunction sanitizeMeetingRecord(input = {}) {\n  const startedAt = input.startedAt || localMeetingContext?.startedAt || new Date().toISOString();\n  const meetingId = String(input.meetingId || input.id || localMeetingContext?.meetingId || localActiveMeetingId || \`local-meeting-\${Date.now()}\`);\n  const participants = Array.isArray(input.participants) ? input.participants.map(String).slice(0, 100) : [...localMeetingParticipants];\n  const participantNames = Array.isArray(input.participantNames) ? input.participantNames.map(value => String(value).slice(0, 80)).slice(0, 100) : [];\n  const minutes = input.minutes && typeof input.minutes === "object" ? input.minutes : defaultMinutesForMeeting(input);\n  return {\n    id: String(input.id || meetingId),\n    meetingId,\n    subject: normalizeMeetingSubject(input.subject || localMeetingContext?.subject),\n    handleId: String(input.handleId || localMeetingContext?.handleId || "local-region-response"),\n    region: String(input.region || localMeetingContext?.region || "恩施市 · 芭蕉侗族乡").slice(0, 120),\n    responseLevel: String(input.responseLevel || localMeetingContext?.responseLevel || "Ⅱ级响应").slice(0, 40),\n    host: String(input.host || localMeetingContext?.host || "演示账号").slice(0, 80),\n    participants,\n    participantNames,\n    startedAt,\n    endedAt: input.endedAt || new Date().toISOString(),\n    durationMinutes: Math.max(0, Number(input.durationMinutes) || Math.round((Date.now() - Date.parse(startedAt)) / 60000) || 0),\n    status: String(input.status || "completed").slice(0, 32),\n    minutes: {\n      summary: String(minutes.summary || "").slice(0, 20000),\n      recommendations: Array.isArray(minutes.recommendations) ? minutes.recommendations.map(value => String(value).slice(0, 1000)).slice(0, 50) : [],\n      responsibilities: Array.isArray(minutes.responsibilities) ? minutes.responsibilities.map(value => String(value).slice(0, 1000)).slice(0, 50) : []\n    }\n  };\n}\n\nfunction upsertLocalMeetingRecord(input) {\n  const record = sanitizeMeetingRecord(input);\n  const index = localMeetingRecords.findIndex(item => item.id === record.id);\n  if (index >= 0) localMeetingRecords[index] = { ...localMeetingRecords[index], ...record };\n  else localMeetingRecords.unshift(record);\n  if (localMeetingRecords.length > 100) localMeetingRecords.length = 100;\n  return record;\n}`;

const startBefore = `  if (req.method === "POST" && url.pathname === "/api/dizai/meeting/startMeeting") {\n    const body = parseChatBody(await readBody(req));\n    localActiveMeetingId = "local-meeting";\n    localMeetingParticipants = Array.isArray(body.participants)\n      ? body.participants.filter(value => value !== null && value !== undefined).map(String)\n      : [];\n    sendJson(res, { code: 200, data: { meetingId: localActiveMeetingId } });\n    return;\n  }`;
const startAfter = `  if (req.method === "POST" && url.pathname === "/api/dizai/meeting/startMeeting") {\n    const body = parseChatBody(await readBody(req));\n    localActiveMeetingId = \`local-meeting-\${Date.now()}\`;\n    localMeetingParticipants = Array.isArray(body.participants)\n      ? body.participants.filter(value => value !== null && value !== undefined).map(String)\n      : [];\n    localMeetingContext = {\n      meetingId: localActiveMeetingId,\n      subject: normalizeMeetingSubject(body.subject || localMeetingDraftContext?.subject),\n      handleId: String(body.handleId || localMeetingDraftContext?.handleId || "local-region-response"),\n      region: String(body.region || localMeetingDraftContext?.region || "恩施市 · 芭蕉侗族乡"),\n      responseLevel: String(body.responseLevel || localMeetingDraftContext?.responseLevel || "Ⅱ级响应"),\n      host: String(body.host || localMeetingDraftContext?.host || "演示账号"),\n      participants: [...localMeetingParticipants],\n      participantNames: typeof localExpertRows !== "undefined" ? localMeetingParticipants.map(userId => localExpertRows.find(row => String(row.userId) === String(userId))?.nickName).filter(Boolean) : [],\n      startedAt: new Date().toISOString()\n    };\n    localMeetingDraftContext = null;\n    sendJson(res, { code: 200, data: { meetingId: localActiveMeetingId, context: localMeetingContext } });\n    return;\n  }`;

const closeBefore = `  if (req.method === "POST" && /^\\/api\\/dizai\\/meeting\\/(closeMeeting|exitMeeting)\\//.test(url.pathname)) {\n    localActiveMeetingId = "";\n    localMeetingParticipants = [];\n    sendJson(res, { code: 200, data: true });\n    return;\n  }`;
const closeAfterV1 = `  if (req.method === "POST" && /^\\/api\\/dizai\\/meeting\\/(closeMeeting|exitMeeting)\\//.test(url.pathname)) {\n    if (localMeetingContext) {\n      const existing = localMeetingRecords.find(item => item.meetingId === localMeetingContext.meetingId);\n      if (!existing) upsertLocalMeetingRecord({ ...localMeetingContext, status: "completed", minutes: defaultMinutesForMeeting(localMeetingContext) });\n    }\n    localActiveMeetingId = "";\n    localMeetingParticipants = [];\n    localMeetingDraftContext = null;\n    localMeetingContext = null;\n    sendJson(res, { code: 200, data: true });\n    return;\n  }`;
const closeAfter = `  if (req.method === "POST" && /^\\/api\\/dizai\\/meeting\\/(closeMeeting|exitMeeting)\\//.test(url.pathname)) {\n    const isCloseMeeting = url.pathname.includes("/closeMeeting/");\n    if (isCloseMeeting && localMeetingContext) {\n      const existing = localMeetingRecords.find(item => item.meetingId === localMeetingContext.meetingId);\n      if (!existing) upsertLocalMeetingRecord({ ...localMeetingContext, status: "completed", minutes: defaultMinutesForMeeting(localMeetingContext) });\n    }\n    localActiveMeetingId = "";\n    localMeetingParticipants = [];\n    localMeetingDraftContext = null;\n    localMeetingContext = null;\n    sendJson(res, { code: 200, data: true });\n    return;\n  }`;

const infoBefore = `  if (url.pathname.startsWith("/api/dizai/meeting/getMeetingInfo/")) {\n    sendJson(res, {\n      code: 200,\n      data: { initiator: 1, handleId: "local-region-response", participantsMap: localParticipantsMap() }\n    });\n    return;\n  }`;
const infoAfter = `  if (url.pathname.startsWith("/api/dizai/meeting/getMeetingInfo/")) {\n    sendJson(res, {\n      code: 200,\n      data: {\n        initiator: 1,\n        handleId: localMeetingContext?.handleId || "local-region-response",\n        participantsMap: localParticipantsMap(),\n        participantNames: localMeetingContext?.participantNames || [],\n        subject: localMeetingContext?.subject || "",\n        region: localMeetingContext?.region || "恩施市 · 芭蕉侗族乡",\n        responseLevel: localMeetingContext?.responseLevel || "Ⅱ级响应",\n        startedAt: localMeetingContext?.startedAt || null\n      }\n    });\n    return;\n  }`;

const contextPostV1 = `  if (url.pathname === "/api/dizai/meeting/context" && req.method === "POST") {
    const body = parseChatBody(await readBody(req));
    localMeetingDraftContext = {
      subject: normalizeMeetingSubject(body.subject),
      handleId: String(body.handleId || "local-region-response"),
      region: String(body.region || "恩施市 · 芭蕉侗族乡"),
      responseLevel: String(body.responseLevel || "Ⅱ级响应"),
      host: String(body.host || "演示账号")
    };
    sendJson(res, { code: 200, data: localMeetingDraftContext });
    return;
  }`;
const contextPostV2 = `  if (url.pathname === "/api/dizai/meeting/context" && req.method === "POST") {
    const body = parseChatBody(await readBody(req));
    const nextContext = {
      subject: normalizeMeetingSubject(body.subject),
      handleId: String(body.handleId || localMeetingContext?.handleId || "local-region-response"),
      region: String(body.region || localMeetingContext?.region || "恩施市 · 芭蕉侗族乡"),
      responseLevel: String(body.responseLevel || localMeetingContext?.responseLevel || "Ⅱ级响应"),
      host: String(body.host || localMeetingContext?.host || "演示账号"),
      participants: [...localMeetingParticipants],
      participantNames: typeof localExpertRows !== "undefined" ? localMeetingParticipants.map(userId => localExpertRows.find(row => String(row.userId) === String(userId))?.nickName).filter(Boolean) : []
    };
    if (localMeetingContext) localMeetingContext = { ...localMeetingContext, ...nextContext };
    else localMeetingDraftContext = nextContext;
    sendJson(res, { code: 200, data: localMeetingContext || localMeetingDraftContext });
    return;
  }`;

const historyHandlers = `${contextPostV2}
  if (url.pathname === "/api/dizai/meeting/context" && req.method === "GET") {
    sendJson(res, { code: 200, data: localMeetingContext || localMeetingDraftContext });
    return;
  }
  if (url.pathname === "/api/dizai/meeting/currentContext") {
    sendJson(res, { code: 200, data: localMeetingContext || localMeetingDraftContext });
    return;
  }
  if (url.pathname === "/api/dizai/meeting/history" && req.method === "GET") {
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const rows = query
      ? localMeetingRecords.filter(item => \`\${item.subject} \${item.region} \${item.host}\`.toLowerCase().includes(query))
      : localMeetingRecords;
    sendJson(res, { code: 200, data: rows, total: rows.length });
    return;
  }
  if (url.pathname === "/api/dizai/meeting/history" && req.method === "POST") {
    const body = parseChatBody(await readBody(req));
    const record = upsertLocalMeetingRecord(body);
    sendJson(res, { code: 200, data: record });
    return;
  }
  if (url.pathname.startsWith("/api/dizai/meeting/history/") && req.method === "GET") {
    const id = decodeURIComponent(url.pathname.slice("/api/dizai/meeting/history/".length));
    const record = localMeetingRecords.find(item => item.id === id || item.meetingId === id) || null;
    sendJson(res, record ? { code: 200, data: record } : { code: 404, message: "meeting record not found" }, record ? 200 : 404);
    return;
  }`;

function patchServeText(source) {
  if (source.includes(MARKER)) return source;
  // Upgrade path: v1 already contains the required meeting context/history API surface.
  // v2 changes the browser flow and Design-System component layer, so keep that
  // validated server patch and only mark this repository as v2-compatible.
  if (source.includes(LEGACY_MARKER)) {
    let upgraded = source.replace(`// ${LEGACY_MARKER}`, `// ${LEGACY_MARKER}
// ${MARKER}`);
    if (upgraded.includes(contextPostV1)) upgraded = upgraded.replace(contextPostV1, contextPostV2);
    if (upgraded.includes(closeAfterV1)) upgraded = upgraded.replace(closeAfterV1, closeAfter);
    return upgraded;
  }
  source = replaceRequired(source, '  "/task-track"\n]);', '  "/task-track",\n  "/meeting-history"\n]);', "serve nativeRoutes");
  source = replaceRequired(source, stateAnchor, statePatch, "serve meeting state");
  source = replaceRequired(source, participantsHelper, meetingHelpers, "serve meeting helpers");
  source = replaceRequired(source, startBefore, `${historyHandlers}\n${startAfter}`, "serve startMeeting");
  source = replaceRequired(source, closeBefore, closeAfter, "serve closeMeeting");
  source = replaceRequired(source, infoBefore, infoAfter, "serve getMeetingInfo");
  source = replaceRequired(source, '    ["/design-system/", path.join(root, "design-system")],', '    ["/design-system/", path.join(root, "design-system")],\n    ["/meeting-feature/", path.join(root, "meeting-feature")],', "serve meeting-feature alias");
  source = replaceRequired(source, '  let file = nativeRoutes.has(url.pathname) || url.pathname === "/native.html" ? path.join(root, "native.html") : (aliasedFile(url.pathname) || safeFile(url.pathname));', '  let file = url.pathname === "/meeting-history"\n    ? path.join(root, "meeting-feature", "history.html")\n    : (nativeRoutes.has(url.pathname) || url.pathname === "/native.html" ? path.join(root, "native.html") : (aliasedFile(url.pathname) || safeFile(url.pathname)));', "serve history page");
  source = replaceRequired(source, '["/assets/", "/design-system/", "/MapResource/", "/lib/", "/video/"]', '["/assets/", "/design-system/", "/meeting-feature/", "/MapResource/", "/lib/", "/video/"]', "serve feature asset classification");
  return source;
}

async function patchServe() {
  const name = "serve.mjs";
  const file = path.join(root, name);
  const raw = await readFile(file, "utf8");
  const { text: source, lineEnding } = normalizeLineEndings(raw);
  if (checkOnly) {
    for (const needle of [MARKER, '"/meeting-history"', '["/meeting-feature/", path.join(root, "meeting-feature")]', 'url.pathname === "/api/dizai/meeting/history"']) if (!source.includes(needle)) throw new Error(`serve.mjs: missing ${needle}`);
    return;
  }
  await backup(name);
  const next = patchServeText(source);
  if (next !== source) await writeFile(file, restoreLineEndings(next, lineEnding), "utf8");
}

async function patchPackage() {
  const name = "package.json";
  const file = path.join(root, name);
  const pkg = JSON.parse(await readFile(file, "utf8"));
  const required = {
    "meeting:apply": "node tools/apply-meeting-suite.mjs",
    "meeting:check": "node tools/apply-meeting-suite.mjs --check",
    "meeting:test": "node --test tests/meeting-suite.test.mjs",
    "meeting:audit": "node scripts/meeting-suite-audit.mjs",
    "meeting:smoke": "node scripts/meeting-suite-smoke.mjs"
  };
  if (checkOnly) {
    for (const [key, value] of Object.entries(required)) if (pkg.scripts?.[key] !== value) throw new Error(`package.json: missing ${key}`);
    return;
  }
  await backup(name);
  pkg.scripts ||= {};
  let changed = false;
  for (const [key, value] of Object.entries(required)) if (pkg.scripts[key] !== value) { pkg.scripts[key] = value; changed = true; }
  if (changed) await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

async function patchGitignore() {
  const name = ".gitignore";
  const file = path.join(root, name);
  const line = ".meeting-suite-backup/";
  const source = await readFile(file, "utf8").catch(() => "");
  if (checkOnly) { if (!source.split(/\r?\n/).includes(line)) throw new Error(".gitignore: meeting backup ignore missing"); return; }
  await backup(name);
  if (!source.split(/\r?\n/).includes(line)) await writeFile(file, `${source.trimEnd()}\n\n# GeoOmni Meeting Suite local backup\n${line}\n`, "utf8");
}

async function patchAgents() {
  const name = "AGENTS.md";
  const file = path.join(root, name);
  const snippet = await readFile(path.join(root, "templates", "AGENTS.meeting-suite.snippet.md"), "utf8");
  const source = await readFile(file, "utf8").catch(() => "# Repository Agent Instructions\n");
  if (checkOnly) { if (!source.includes("GEOOMNI_MEETING_SUITE_CONTRACT_V2")) throw new Error("AGENTS.md: meeting contract missing"); return; }
  await backup(name);
  if (!source.includes("GEOOMNI_MEETING_SUITE_CONTRACT_V2")) {
    const withoutV1 = source.replace(/<!-- GEOOMNI_MEETING_SUITE_CONTRACT_V1 -->[\s\S]*?<!-- \/GEOOMNI_MEETING_SUITE_CONTRACT_V1 -->\s*/g, "").trimEnd();
    await writeFile(file, `${withoutV1}\n\n${snippet.trim()}\n`, "utf8");
  }
}

async function validatePayload() {
  for (const relative of ["meeting-feature/meeting-suite.js", "meeting-feature/meeting-suite.css", "meeting-feature/history.html", "scripts/meeting-suite-audit.mjs", "scripts/meeting-suite-smoke.mjs", "tests/meeting-suite.test.mjs"]) if (!(await exists(path.join(root, relative)))) throw new Error(`missing payload: ${relative}`);
}

await validatePayload();
await patchHtml("index.html");
await patchHtml("native.html");
await patchServe();
await patchPackage();
await patchGitignore();
await patchAgents();
console.log(`[GeoOmni Meeting Suite] ${checkOnly ? "check passed" : "installed"}: ${root}`);
