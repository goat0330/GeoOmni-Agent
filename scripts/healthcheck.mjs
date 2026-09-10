const baseUrl = process.env.HEALTHCHECK_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4173}`;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 4000);
try {
  const response = await fetch(`${baseUrl}/healthz`, { signal: controller.signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.status !== "ok") throw new Error(`unexpected status: ${body.status}`);
  process.exitCode = 0;
} catch (error) {
  console.error(`healthcheck failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
}
