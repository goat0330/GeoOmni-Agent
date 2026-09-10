const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const failures = [];

async function request(path, options = {}, validator = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
    if (validator) await validator(response, text);
    console.log(`PASS ${options.method || "GET"} ${path}`);
  } catch (error) {
    failures.push(`${options.method || "GET"} ${path}: ${error.message}`);
    console.error(`FAIL ${options.method || "GET"} ${path}: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

await request("/healthz", {}, async (_res, text) => {
  const body = JSON.parse(text);
  if (body.status !== "ok") throw new Error("health status is not ok");
});
await request("/readyz", {}, async (_res, text) => {
  const body = JSON.parse(text);
  if (body.status !== "ready") throw new Error("ready status is not ready");
});

for (const route of ["/chat-engine/chatting", "/risk-analysis", "/defense-response", "/task-track"]) {
  await request(route, {}, async (res, text) => {
    if (!String(res.headers.get("content-type") || "").includes("text/html")) throw new Error("not HTML");
    if (!text.includes('id="app"')) throw new Error("Vue app mount node missing");
  });
}

await request("/api/system/user/getInfo", {}, async (_res, text) => {
  const body = JSON.parse(text);
  if (body.code !== 200) throw new Error("unexpected API contract");
});

await request("/api/dizai/online/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, async (_res, text) => {
  const body = JSON.parse(text);
  if (body.code !== 200) throw new Error("heartbeat contract mismatch");
});

await request("/api/dizai/ai/agent/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "请介绍当前页面" })
}, async (res, text) => {
  if (!String(res.headers.get("content-type") || "").includes("text/event-stream")) throw new Error("chat is not SSE");
  if (!text.includes("data: [DONE]")) throw new Error("SSE did not finish correctly");
});

if (failures.length) {
  console.error(`\nSmoke test failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("\nGeoOmni smoke test: PASS");
