import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { applyHardening } from "../tools/apply-enterprise-hardening.mjs";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const runtimeFixture = `
import { createServer } from "node:http";
import https from "node:https";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const sourceOrigin = "https://10.1.2.3:9999";
let knowledgeChunksPromise;

function sendJson(res, value, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}
async function loadKnowledgeChunks() { return [{ title: "fixture" }]; }
async function handleApi(req, res, url) {
  if (url.pathname === "/api/boom") throw new Error("internal-sensitive-detail");
  sendJson(res, { code: 200 });
}
async function serveStatic(req, res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end('<div id="app"></div>');
}
function isSourceMapAsset() { return false; }

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function proxySourceMapAsset(res, url) {
  if (!isSourceMapAsset(url)) return false;
  const upstreamUrl = \`${'${sourceOrigin}'}${'${url.pathname}'}${'${url.search}'}\`;
  const request = https.get(upstreamUrl, { rejectUnauthorized: false }, upstream => {
    upstream.pipe(res);
  });
  return true;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", \`http://${'${req.headers.host || `${host}:${port}`}'}\`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, { code: 500, message: String(error.message || error) }, 500);
  }
});

server.listen(port, host, () => {
  console.log(\`GeoOmni local replica: http://${'${host}'}:${'${port}'}/chat-engine\`);
});
if (process.send) process.on("message", message => {
  if (message === "shutdown") {
    shutdown("test-ipc");
    process.disconnect?.();
  }
});
`;

async function waitFor(url, child) {
  for (let i = 0; i < 50; i += 1) {
    if (child.exitCode !== null) throw new Error(`server exited early: ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("server did not become ready");
}

test("runtime hardening provides health, request IDs, rate limit, error redaction, and graceful shutdown", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "geo-enterprise-runtime-"));
  await writeFile(path.join(rootDir, "serve.mjs"), runtimeFixture, "utf8");
  await applyHardening({ rootDir, backup: false });
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(rootDir, "serve.mjs")], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      CHAT_RATE_LIMIT_PER_MINUTE: "1",
      ALLOW_SOURCE_PROXY: "false"
    },
    stdio: ["ignore", "pipe", "pipe", ...(process.platform === "win32" ? ["ipc"] : [])]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });

  try {
    const base = `http://127.0.0.1:${port}`;
    await waitFor(`${base}/healthz`, child);

    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    assert.ok(health.headers.get("x-request-id"));
    assert.equal((await health.json()).status, "ok");

    const ready = await fetch(`${base}/readyz`);
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).status, "ready");

    const firstChat = await fetch(`${base}/api/dizai/ai/agent/chat`, { method: "POST", body: "{}" });
    assert.equal(firstChat.status, 200);
    const secondChat = await fetch(`${base}/api/dizai/ai/agent/chat`, { method: "POST", body: "{}" });
    assert.equal(secondChat.status, 429);
    assert.equal(secondChat.headers.get("retry-after"), "60");

    const boom = await fetch(`${base}/api/boom`);
    assert.equal(boom.status, 500);
    const boomBody = await boom.json();
    assert.equal(boomBody.message, "Internal Server Error");
    assert.ok(boomBody.requestId);
    assert.ok(!JSON.stringify(boomBody).includes("internal-sensitive-detail"));
  } finally {
    if (process.platform === "win32") child.send("shutdown");
    else child.kill("SIGTERM");
    await new Promise(resolve => child.once("exit", resolve));
  }

  assert.match(stdout, /"event":"http_request"/);
  assert.match(stdout, /"event":"shutdown_complete"/);
  assert.match(stderr, /"event":"request_failed"/);
});
