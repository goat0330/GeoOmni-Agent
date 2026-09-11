const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");
if (!baseUrl) throw new Error("BASE_URL is required");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchOnce(path, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function request(path, options = {}, attempts = 12) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchOnce(path, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(5000);
    }
  }
  throw new Error(`${path}: ${lastError?.message || lastError}`);
}

const passed = [];
const check = async (label, path, options = {}, validate = async () => {}) => {
  const response = await request(path, options);
  await validate(response, await response.text());
  passed.push(label);
};

await check("health", "/healthz", {}, async (_response, text) => {
  if (JSON.parse(text).status !== "ok") throw new Error("health status is not ok");
});
await check("ready", "/readyz", {}, async (_response, text) => {
  if (JSON.parse(text).status !== "ready") throw new Error("ready status is not ready");
});

for (const route of ["/chat-engine/chatting", "/risk-analysis", "/defense-response", "/task-track"]) {
  await check(route, route, {}, async (response, text) => {
    if (!String(response.headers.get("content-type") || "").includes("text/html")) throw new Error("not HTML");
    if (!text.includes('id="app"')) throw new Error("Vue mount node missing");
  });
}

await check("user API", "/api/system/user/getInfo", {}, async (_response, text) => {
  if (JSON.parse(text).code !== 200) throw new Error("user API contract mismatch");
});
await check("heartbeat", "/api/dizai/online/heartbeat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}"
}, async (_response, text) => {
  if (JSON.parse(text).code !== 200) throw new Error("heartbeat contract mismatch");
});
await check("chat SSE", "/api/dizai/ai/agent/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "请用中文简要说明地质灾害风险评估" })
}, async (response, text) => {
  if (!String(response.headers.get("content-type") || "").includes("text/event-stream")) throw new Error("chat is not SSE");
  if (!text.includes("WORKFLOW_FINISHED") || !text.includes("data: [DONE]")) throw new Error("SSE did not finish");
});

console.log(`Public smoke PASS: ${passed.join(", ")}`);
