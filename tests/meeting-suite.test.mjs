import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFile(path.join(root, relative), "utf8");

test("expert library owns the only pre-meeting step", async () => {
  const js = await read("meeting-feature/meeting-suite.js");
  assert.match(js, /会商主题/);
  assert.match(js, /确认邀请/);
  assert.match(js, /智能纪要/);
  assert.match(js, /历史会议/);
  assert.match(js, /beginJoinFlow/);
  assert.doesNotMatch(js, /会商结论与响应等级确认/);
  assert.doesNotMatch(js, /协同编辑中/);
});

test("confirm invitation goes directly to device join and meeting room", async () => {
  const js = await read("meeting-feature/meeting-suite.js");
  assert.match(js, /renderJoinDialog/);
  assert.match(js, /加入会议/);
  assert.match(js, /getUserMedia/);
  assert.match(js, /renderMeetingRoom/);
  assert.match(js, /应急会商室/);
  assert.match(js, /state\.phase = "join"/);
  assert.match(js, /state\.phase = "room"/);
  assert.match(js, /ensureServerMeeting/);
  assert.match(js, /await ensureServerMeeting\(\)/);
});

test("one smart-minutes component serves pre-meeting and live meeting", async () => {
  const js = await read("meeting-feature/meeting-suite.js");
  assert.match(js, /renderMinutesSidebar\(mode = "pre"\)/);
  assert.match(js, /renderMinutesContent\(mode\)/);
  assert.match(js, /toggle-pre-minutes/);
  assert.match(js, /toggle-room-minutes/);
  assert.match(js, /会议开始后自动沉淀/);
  assert.match(js, /编辑纪要/);
  assert.match(js, /发送给责任人/);
});

test("expert topic and pre-meeting minutes use the reference alignment", async () => {
  const js = await read("meeting-feature/meeting-suite.js");
  const css = await read("meeting-feature/meeting-suite.css");
  assert.match(js, /geo-meeting-expert-layout/);
    assert.match(js, /alignPreMeetingMinutes/);
    assert.match(js, /findExpertModalFrame/);
    assert.match(js, /closest\("\.person-list"\)/);
  assert.match(css, /\.geo-meeting-expert-layout\.foot-box/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)\s+20rem/);
  assert.match(css, /\.geo-meeting-minutes-sidebar--pre/);
  assert.match(css, /gap:\s*var\(--geo-space-1\)/);
});

test("meeting information can be edited before inviting experts", async () => {
  const js = await read("meeting-feature/meeting-suite.js");
  const css = await read("meeting-feature/meeting-suite.css");
  for (const label of ["研判主题", "响应区域", "响应等级", "参会人员"]) assert.ok(js.includes(label), `missing ${label}`);
  assert.match(js, /renderContextEditor/);
  assert.match(js, /save-context/);
  assert.match(js, /currentRiskTopic/);
  assert.match(css, /\.geo-meeting-context-dialog/);
});

test("history stores base information, final minutes and distribution", async () => {
  const js = await read("meeting-feature/meeting-suite.js");
  for (const label of ["历史会议记录", "基础信息", "风险研判总结", "处置建议", "责任事项", "发送记录"]) {
    assert.ok(js.includes(label), `missing ${label}`);
  }
  assert.match(js, /distribution/);
  assert.match(js, /\/api\/dizai\/meeting\/history/);
});

test("server integration stores meetingContext and meeting records", async () => {
  const serve = await read("serve.mjs");
  assert.match(serve, /GEOOMNI_MEETING_SUITE_V2/);
  assert.match(serve, /localMeetingContext/);
  assert.match(serve, /localMeetingRecords/);
  assert.match(serve, /normalizeMeetingSubject/);
  assert.match(serve, /riskTopic/);
  assert.match(serve, /\/api\/dizai\/meeting\/history/);
});

test("meeting styling is Design-System tokenized", async () => {
  const css = await read("meeting-feature/meeting-suite.css");
  assert.match(css, /@geo-design-enforce/);
  assert.match(css, /var\(--geo-color-primary\)/);
  assert.match(css, /var\(--geo-radius-dialog\)/);
  assert.match(css, /var\(--geo-font/);
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(noComments, /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/);
  assert.doesNotMatch(noComments, /border-radius\s*:\s*\d+(?:\.\d+)?px\b/);
});

test("cancel, leave and end meeting have distinct semantics", async () => {
  const js = await read("meeting-feature/meeting-suite.js");
  const installer = await read("tools/apply-meeting-suite.mjs");
  assert.match(js, /closeExpertDialog/);
  assert.match(js, /button\.dataset\.geoMeetingCancel === "1"/);
  assert.match(js, /if \(status === "ended"\) await saveCurrentRecord\("completed"\)/);
  assert.match(installer, /const isCloseMeeting = url\.pathname\.includes\("\/closeMeeting\/"\)/);
});

test("compiled front-end assets remain untouched by integration", async () => {
  const manifest = await read("OVERWRITE-MEETING-SUITE-MANIFEST.txt");
  assert.ok(manifest.includes("UNCHANGED"));
  assert.ok(manifest.includes("mirror-clean6/**"));
  assert.doesNotMatch(await read("tools/apply-meeting-suite.mjs"), /writeFile\([^\n]*mirror-clean6/);
});
