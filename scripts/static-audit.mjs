import { readFile } from "node:fs/promises";

const source = await readFile("serve.mjs", "utf8");
const publicBundle = await readFile("mirror-clean6/assets/index-B9pFv1aG.js", "utf8");
const failures = [];

if (!source.includes("GEOOMNI_ENTERPRISE_HARDENING_V1")) failures.push("enterprise hardening marker missing");
if (/const\s+sourceOrigin\s*=\s*["']https?:\/\/172\.16\./.test(source)) failures.push("hard-coded RFC1918 sourceOrigin remains");
if (/https\.get\([^)]*rejectUnauthorized:\s*false/s.test(source)) failures.push("TLS verification is still unconditionally disabled");
if (/https?:\/\/172\.16\./.test(publicBundle)) failures.push("public bundle contains an internal RFC1918 URL");
if (/Bearer\s+dataset-(?!REDACTED_)[A-Za-z0-9_-]+/.test(publicBundle)) failures.push("public bundle contains a dataset bearer token");
if (!source.includes('url.pathname === "/healthz"')) failures.push("/healthz missing");
if (!source.includes('url.pathname === "/readyz"')) failures.push("/readyz missing");
if (!source.includes("shutdown_started")) failures.push("graceful shutdown missing");
if (!source.includes("http_request")) failures.push("structured request logging missing");

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("GeoOmni enterprise static audit: PASS");
