import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

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

async function waitFor(url, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`server exited early: ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("server did not become ready");
}

test("production serves bundled terrain before considering source proxy", async () => {
  const port = await freePort();
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const child = spawn(process.execPath, [path.join(rootDir, "serve.mjs")], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port), ALLOW_SOURCE_PROXY: "false" },
    stdio: ["ignore", "pipe", "pipe", ...(process.platform === "win32" ? ["ipc"] : [])]
  });

  try {
    const base = `http://127.0.0.1:${port}`;
    await waitFor(`${base}/healthz`, child);
    const terrain = await fetch(`${base}/MapResource/enshi-dem-562/0/0/0.terrain`);
    assert.equal(terrain.status, 200);
    assert.equal(terrain.headers.get("content-encoding"), "gzip");
    assert.ok((await terrain.arrayBuffer()).byteLength > 0);
  } finally {
    child.kill("SIGTERM");
    await new Promise(resolve => child.once("exit", resolve));
  }
});
