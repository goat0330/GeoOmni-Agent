import { readFile } from "node:fs/promises";

const source = await readFile("serve.mjs", "utf8");
const failures = [];

if (!source.includes("GEOOMNI_ENTERPRISE_HARDENING_V1")) failures.push("enterprise hardening marker missing");
if (/const\s+sourceOrigin\s*=\s*["']https?:\/\/172\.16\./.test(source)) failures.push("hard-coded RFC1918 sourceOrigin remains");
if (/https\.get\([^)]*rejectUnauthorized:\s*false/s.test(source)) failures.push("TLS verification is still unconditionally disabled");
if (!source.includes('url.pathname === "/healthz"')) failures.push("/healthz missing");
if (!source.includes('url.pathname === "/readyz"')) failures.push("/readyz missing");
if (!source.includes("shutdown_started")) failures.push("graceful shutdown missing");
if (!source.includes("http_request")) failures.push("structured request logging missing");

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("GeoOmni enterprise static audit: PASS");
