import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MARKER = "GEOOMNI_ENTERPRISE_HARDENING_V1";

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`无法应用 ${label}：没有找到预期代码片段。请确认本地 serve.mjs 基于当前 GeoOmni-Agent master，或先恢复该文件后再运行。`);
  }
  return source.replace(before, after);
}

export async function applyHardening({
  rootDir = process.cwd(),
  backup = true,
  checkOnly = false,
  preserveLocalSource = true
} = {}) {
  const target = path.join(rootDir, "serve.mjs");
  let source = await readFile(target, "utf8");
  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  source = source.replace(/\r\n/g, "\n");

  if (source.includes(MARKER)) {
    return { changed: false, status: "already-hardened", target };
  }

  if (checkOnly) {
    throw new Error("serve.mjs 尚未应用 Enterprise Hardening。运行 npm run enterprise:apply。");
  }

  const sourceOriginPattern = /^const sourceOrigin = "(https?:\/\/[^"\r\n]+)";$/m;
  const sourceOriginMatch = source.match(sourceOriginPattern);
  if (!sourceOriginMatch) {
    throw new Error("无法应用生产配置外置：没有找到原始 const sourceOrigin = ... 配置行。");
  }
  const originalSourceOrigin = sourceOriginMatch[1];

  const sourceOriginAfter = `// ${MARKER}
const runtimeEnvironment = process.env.NODE_ENV || "development";
const isProduction = runtimeEnvironment === "production";
function envNumber(name, fallback, minimum) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}
let localRuntimeConfig = {};
if (!isProduction) {
  try {
    localRuntimeConfig = JSON.parse(await readFile(path.join(root, ".enterprise-local.json"), "utf8"));
  } catch {
    localRuntimeConfig = {};
  }
}
const sourceOrigin = (process.env.SOURCE_ORIGIN || localRuntimeConfig.sourceOrigin || "").replace(/\\/$/, "");
const allowSourceProxy = process.env.ALLOW_SOURCE_PROXY == null
  ? (!isProduction && localRuntimeConfig.allowSourceProxy === true && Boolean(sourceOrigin))
  : /^(1|true|yes)$/i.test(process.env.ALLOW_SOURCE_PROXY || "");
const sourceTlsVerify = process.env.SOURCE_TLS_VERIFY == null
  ? (localRuntimeConfig.sourceTlsVerify !== false)
  : !/^(0|false|no)$/i.test(process.env.SOURCE_TLS_VERIFY || "");
const trustProxy = /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || "");
const requestBodyLimitBytes = envNumber("REQUEST_BODY_LIMIT_BYTES", 1024 * 1024, 1024);
const chatRateLimitPerMinute = envNumber("CHAT_RATE_LIMIT_PER_MINUTE", 60, 1);
const requestTimeoutMs = envNumber("REQUEST_TIMEOUT_MS", 120000, 1000);
const headersTimeoutMs = envNumber("HEADERS_TIMEOUT_MS", 65000, 1000);
const keepAliveTimeoutMs = envNumber("KEEP_ALIVE_TIMEOUT_MS", 5000, 1000);
const shutdownTimeoutMs = envNumber("SHUTDOWN_TIMEOUT_MS", 10000, 1000);`;
  source = source.replace(sourceOriginPattern, sourceOriginAfter);

  source = replaceExact(
    source,
    'if (size > 1024 * 1024) throw new Error("request body too large");',
    'if (size > requestBodyLimitBytes) throw new Error("request body too large");',
    "请求体限制配置化"
  );

  source = replaceExact(
    source,
    'function proxySourceMapAsset(res, url) {\n  if (!isSourceMapAsset(url)) return false;\n  const upstreamUrl = `${sourceOrigin}${url.pathname}${url.search}`;\n  const request = https.get(upstreamUrl, { rejectUnauthorized: false }, upstream => {',
    'function proxySourceMapAsset(res, url) {\n  if (!isSourceMapAsset(url)) return false;\n  if (!allowSourceProxy || !sourceOrigin) {\n    sendJson(res, { code: 404, message: "map asset unavailable locally; source proxy disabled" }, 404);\n    return true;\n  }\n  const upstreamUrl = `${sourceOrigin}${url.pathname}${url.search}`;\n  const request = https.get(upstreamUrl, { rejectUnauthorized: sourceTlsVerify }, upstream => {',
    "源环境代理保护"
  );

  const oldTail = `const server = createServer(async (req, res) => {\n  try {\n    const url = new URL(req.url || "/", \`http://\${req.headers.host || \`\${host}:\${port}\`}\`);\n    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);\n    return await serveStatic(req, res, url);\n  } catch (error) {\n    sendJson(res, { code: 500, message: String(error.message || error) }, 500);\n  }\n});\n\nserver.listen(port, host, () => {\n  console.log(\`GeoOmni local replica: http://\${host}:\${port}/chat-engine\`);\n});`;

  const newTail = `let requestSequence = 0;\nconst chatRateBuckets = new Map();\nconst startedAt = Date.now();\n\nfunction logEvent(level, event, fields = {}) {\n  const record = { timestamp: new Date().toISOString(), level, event, ...fields };\n  const line = JSON.stringify(record);\n  if (level === "error") console.error(line);\n  else if (level === "warn") console.warn(line);\n  else console.log(line);\n}\n\nfunction requestIdFor(req) {\n  const supplied = req.headers["x-request-id"];\n  if (typeof supplied === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)) return supplied;\n  requestSequence = (requestSequence + 1) % 1000000000;\n  return \`geo-\${Date.now().toString(36)}-\${process.pid}-\${requestSequence.toString(36)}\`;\n}\n\nfunction clientIp(req) {\n  if (trustProxy) {\n    const forwarded = req.headers["x-forwarded-for"];\n    if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();\n  }\n  return req.socket.remoteAddress || "unknown";\n}\n\nfunction chatRateLimited(req) {\n  const minute = Math.floor(Date.now() / 60000);\n  const key = \`\${clientIp(req)}:\${minute}\`;\n  const count = (chatRateBuckets.get(key) || 0) + 1;\n  chatRateBuckets.set(key, count);\n  if (chatRateBuckets.size > 10000) chatRateBuckets.clear();\n  return count > chatRateLimitPerMinute;\n}\n\nasync function handleHealth(res, ready = false) {\n  if (!ready) {\n    sendJson(res, { status: "ok", uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) });\n    return;\n  }\n  try {\n    knowledgeChunksPromise ||= loadKnowledgeChunks();\n    const chunks = await knowledgeChunksPromise;\n    if (!chunks.length) {\n      sendJson(res, { status: "not-ready", reason: "knowledge-base-empty" }, 503);\n      return;\n    }\n    sendJson(res, { status: "ready", knowledgeChunks: chunks.length });\n  } catch {\n    sendJson(res, { status: "not-ready" }, 503);\n  }\n}\n\nconst server = createServer(async (req, res) => {\n  const requestId = requestIdFor(req);\n  const requestStarted = Date.now();\n  res.setHeader("X-Request-Id", requestId);\n  res.on("finish", () => {\n    let pathname = "/";\n    try { pathname = new URL(req.url || "/", "http://local").pathname; } catch {}\n    logEvent("info", "http_request", {\n      requestId,\n      method: req.method || "GET",\n      path: pathname,\n      status: res.statusCode,\n      durationMs: Date.now() - requestStarted\n    });\n  });\n\n  try {\n    const url = new URL(req.url || "/", \`http://\${req.headers.host || \`\${host}:\${port}\`}\`);\n    if (url.pathname === "/healthz") return await handleHealth(res, false);\n    if (url.pathname === "/readyz") return await handleHealth(res, true);\n    if (req.method === "POST" && url.pathname === "/api/dizai/ai/agent/chat" && chatRateLimited(req)) {\n      res.setHeader("Retry-After", "60");\n      return sendJson(res, { code: 429, message: "Too Many Requests", requestId }, 429);\n    }\n    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);\n    return await serveStatic(req, res, url);\n  } catch (error) {\n    logEvent("error", "request_failed", { requestId, message: String(error?.message || error) });\n    if (res.headersSent) {\n      if (!res.destroyed) res.end();\n      return;\n    }\n    sendJson(res, {\n      code: 500,\n      message: isProduction ? "Internal Server Error" : String(error?.message || error),\n      requestId\n    }, 500);\n  }\n});\n\nserver.requestTimeout = requestTimeoutMs;\nserver.headersTimeout = headersTimeoutMs;\nserver.keepAliveTimeout = keepAliveTimeoutMs;\n\nserver.listen(port, host, () => {\n  logEvent("info", "server_started", {\n    host,\n    port,\n    environment: runtimeEnvironment,\n    sourceProxyEnabled: allowSourceProxy && Boolean(sourceOrigin),\n    sourceTlsVerify,\n    chatRateLimitPerMinute\n  });\n  console.log(\`GeoOmni local replica: http://\${host}:\${port}/chat-engine/chatting\`);\n});\n\nlet shuttingDown = false;\nfunction shutdown(signal) {\n  if (shuttingDown) return;\n  shuttingDown = true;\n  logEvent("info", "shutdown_started", { signal });\n  const timer = setTimeout(() => {\n    logEvent("error", "shutdown_timeout", { timeoutMs: shutdownTimeoutMs });\n    process.exit(1);\n  }, shutdownTimeoutMs);\n  timer.unref();\n\n  server.close(error => {\n    clearTimeout(timer);\n    if (error) {\n      logEvent("error", "shutdown_failed", { message: String(error.message || error) });\n      process.exitCode = 1;\n    } else {\n      logEvent("info", "shutdown_complete");\n    }\n  });\n  server.closeIdleConnections?.();\n}\n\nprocess.on("SIGTERM", () => shutdown("SIGTERM"));\nprocess.on("SIGINT", () => shutdown("SIGINT"));`;

  source = replaceExact(source, oldTail, newTail, "健康检查、日志、限流和优雅停机");

  if (backup) {
    const backupPath = path.join(rootDir, "serve.mjs.pre-enterprise.bak");
    try {
      await readFile(backupPath);
    } catch {
      await copyFile(target, backupPath);
    }
  }

  if (preserveLocalSource) {
    const localConfigPath = path.join(rootDir, ".enterprise-local.json");
    try {
      await readFile(localConfigPath);
    } catch {
      await writeFile(localConfigPath, `${JSON.stringify({
        sourceOrigin: originalSourceOrigin,
        allowSourceProxy: true,
        sourceTlsVerify: false
      }, null, 2)}\n`, "utf8");
    }
  }

  const output = lineEnding === "\r\n" ? source.replace(/\n/g, "\r\n") : source;
  await writeFile(target, output, "utf8");
  return { changed: true, status: "patched", target };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const result = await applyHardening({
    rootDir: process.cwd(),
    backup: !args.has("--no-backup"),
    checkOnly: args.has("--check"),
    preserveLocalSource: !args.has("--no-local-fallback")
  });
  console.log(`[GeoOmni Enterprise] ${result.status}: ${result.target}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch(error => {
    console.error(`[GeoOmni Enterprise] ${error.message}`);
    process.exit(1);
  });
}
