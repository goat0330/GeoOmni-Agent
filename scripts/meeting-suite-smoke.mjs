const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const checks = [
  ["GET", "/meeting-feature/meeting-suite.js", text => text.includes("确认邀请") && text.includes("renderJoinDialog") && text.includes("renderMeetingRoom")],
  ["GET", "/meeting-feature/meeting-suite.css", text => text.includes("@geo-design-enforce") && text.includes("geo-meeting-minutes-sidebar")],
  ["GET", "/meeting-history", text => text.includes("历史会议记录")],
  ["GET", "/api/dizai/meeting/currentContext", text => JSON.parse(text).code === 200],
  ["GET", "/api/dizai/meeting/history", text => JSON.parse(text).code === 200]
];
const failures = [];
for (const [method, pathname, validate] of checks) {
  try {
    const response = await fetch(`${baseUrl}${pathname}`, { method });
    const text = await response.text();
    if (!response.ok || !validate(text)) throw new Error(`HTTP ${response.status} / unexpected body`);
    console.log(`PASS ${method} ${pathname}`);
  } catch (error) {
    failures.push(`${method} ${pathname}: ${error.message}`);
    console.error(`FAIL ${method} ${pathname}: ${error.message}`);
  }
}
if (failures.length) process.exit(1);
console.log("GeoOmni Meeting Suite v2 smoke: PASS");
