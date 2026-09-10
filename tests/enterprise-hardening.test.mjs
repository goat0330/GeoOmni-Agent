import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { applyHardening } from "../tools/apply-enterprise-hardening.mjs";

const originalFixture = `
const sourceOrigin = "https://10.1.2.3:9999";

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
`;

test("applies hardening exactly once and preserves a backup", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "geo-enterprise-test-"));
  const target = path.join(rootDir, "serve.mjs");
  await writeFile(target, originalFixture, "utf8");

  const first = await applyHardening({ rootDir, backup: true });
  assert.equal(first.changed, true);

  const patched = await readFile(target, "utf8");
  assert.match(patched, /GEOOMNI_ENTERPRISE_HARDENING_V1/);
  assert.match(patched, /process\.env\.SOURCE_ORIGIN/);
  assert.match(patched, /rejectUnauthorized: sourceTlsVerify/);
  assert.match(patched, /url\.pathname === "\/healthz"/);
  assert.match(patched, /url\.pathname === "\/readyz"/);
  assert.match(patched, /shutdown_started/);
  assert.doesNotMatch(patched, /const sourceOrigin = "https:\/\/10\.1\.2\.3:9999"/);
  assert.doesNotMatch(patched, /rejectUnauthorized: false/);

  const backup = await readFile(path.join(rootDir, "serve.mjs.pre-enterprise.bak"), "utf8");
  assert.equal(backup, originalFixture);
  const localConfig = JSON.parse(await readFile(path.join(rootDir, ".enterprise-local.json"), "utf8"));
  assert.equal(localConfig.sourceOrigin, "https://10.1.2.3:9999");
  assert.equal(localConfig.allowSourceProxy, true);
  assert.equal(localConfig.sourceTlsVerify, false);

  const second = await applyHardening({ rootDir, backup: true });
  assert.equal(second.changed, false);

  const syntax = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
});

test("check mode fails before patch and passes by marker after patch", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "geo-enterprise-check-"));
  await writeFile(path.join(rootDir, "serve.mjs"), originalFixture, "utf8");
  await assert.rejects(() => applyHardening({ rootDir, backup: false, checkOnly: true }));
  await applyHardening({ rootDir, backup: false });
  const result = await applyHardening({ rootDir, backup: false, checkOnly: true });
  assert.equal(result.status, "already-hardened");
});


test("supports Windows CRLF checkouts", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "geo-enterprise-crlf-"));
  const target = path.join(rootDir, "serve.mjs");
  await writeFile(target, originalFixture.replace(/\n/g, "\r\n"), "utf8");
  const result = await applyHardening({ rootDir, backup: false });
  assert.equal(result.changed, true);
  const patched = await readFile(target, "utf8");
  assert.ok(patched.includes("\r\n"));
  assert.match(patched, /GEOOMNI_ENTERPRISE_HARDENING_V1/);
  const syntax = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
});
