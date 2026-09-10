import fs from "node:fs/promises";
import path from "node:path";
import https from "node:https";

const BASE = new URL("https://172.16.41.60:8080");
const ROOT = path.resolve(process.argv[2] || path.join(process.cwd(), "mirror"));
const MAX_FILES = 420;
const MAX_BYTES = 24 * 1024 * 1024;
const agent = new https.Agent({ rejectUnauthorized: false });
const queue = [];
const queued = new Set();
const downloaded = [];
const skipped = [];

const initialPages = ["/chat-engine", "/risk-analysis", "/defense-response", "/task-track"];
const initialAssets = [
  "/logo.png",
  "/assets/super-high-CEhEdPX7.png",
  "/assets/high-BMJ-B2lT.png",
  "/assets/middle-cQLzm_Ne.png",
  "/assets/low-CaBxRaOO.png",
  "/assets/left-BAaHeqed.png",
  "/assets/circle-C4njiwuC.png",
  "/assets/right-CcZCBvqg.png",
  "/assets/mars3d-cesium/Assets/approximateTerrainHeights.json",
  "/assets/mars3d-cesium/Assets/IAU2006_XYS/IAU2006_XYS_1.json",
  "/assets/mars3d-cesium/Assets/Images/ion-credit.png",
  "/assets/mars3d-cesium/Assets/Textures/moonSmall.jpg",
  "/assets/mars3d-cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg",
  "/assets/mars3d-cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg",
  "/assets/mars3d-cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg",
  "/assets/mars3d-cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg",
  "/assets/mars3d-cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg",
  "/assets/mars3d-cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg",
  "/MapResource/enshi-dem-562/0/1/0.terrain",
  "/MapResource/enshi-dem-562/0/0/0.terrain",
  "/MapResource/enshi-dem-562/layer.json",
  "/MapResource/Tianditu/10/821/420.jpg",
  "/MapResource/Tianditu/10/821/421.jpg",
  "/MapResource/Tianditu/10/822/420.jpg",
  "/MapResource/Tianditu/10/822/421.jpg",
  "/MapResource/Tianditu/10/823/420.jpg",
  "/MapResource/Tianditu/10/823/421.jpg",
  "/MapResource/Tianditu/10/821/422.jpg",
  "/MapResource/Tianditu/10/822/422.jpg",
  "/MapResource/Tianditu/10/823/422.jpg",
  "/MapResource/Tianditu/10/824/420.jpg",
  "/MapResource/Tianditu/10/824/421.jpg",
  "/MapResource/Tianditu/10/824/422.jpg",
  "/MapResource/Tianditu/10/825/420.jpg",
  "/MapResource/Tianditu/10/825/421.jpg",
  "/MapResource/Tianditu/10/825/422.jpg"
];
for (let i = 1; i <= 36; i += 1) {
  initialAssets.push(`/assets/mars3d-cesium/Assets/IAU2006_XYS/IAU2006_XYS_${i}.json`);
}
const nativeSupplemental = new Set([
  "/assets/super-high-cehedpx7.png",
  "/assets/high-bmj-b2lt.png",
  "/assets/middle-cqlzm_ne.png",
  "/assets/low-cabxraoo.png",
  "/assets/mars3d-cesium/assets/iau2006_xys/iau2006_xys_1.json",
  "/assets/mars3d-cesium/assets/images/ion-credit.png",
  "/assets/mars3d-cesium/assets/textures/moonsmall.jpg",
  "/assets/mars3d-cesium/assets/textures/skybox/tycho2t3_80_px.jpg",
  "/assets/mars3d-cesium/assets/textures/skybox/tycho2t3_80_mx.jpg",
  "/assets/mars3d-cesium/assets/textures/skybox/tycho2t3_80_py.jpg",
  "/assets/mars3d-cesium/assets/textures/skybox/tycho2t3_80_my.jpg",
  "/assets/mars3d-cesium/assets/textures/skybox/tycho2t3_80_pz.jpg",
  "/assets/mars3d-cesium/assets/textures/skybox/tycho2t3_80_mz.jpg"
]);

function isLocal(url) {
  return url.origin === BASE.origin;
}

function isReferenceAsset(url) {
  const p = url.pathname.toLowerCase();
  if (p.length > 240 || /[\s,()=;'`"<>\\]/.test(p)) return false;
  if (p.startsWith("/api/") || p.startsWith("/t_map/")) return false;
  if (p.includes("/assets/assets/")) return false;
  if (/^\/assets\/mars3d-cesium\/assets\/iau2006_xys\/iau2006_xys_\d+\.json$/.test(p)) return true;
  if (p.startsWith("/mapresource/") && p.endsWith(".terrain")) return true;
  if (nativeSupplemental.has(p)) return true;
  if (p.startsWith("/assets/mars3d-cesium/") && !p.endsWith("/widgets/widgets.css") && !p.endsWith("/cesium.js") && !p.endsWith("/assets/approximateterrainheights.json")) return false;
  const hasFileExtension = /\.(html?|js|css|json|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|wav|webm|mp4)$/i.test(p);
  return (p.startsWith("/assets/") && hasFileExtension) || (p.startsWith("/mapresource/") && hasFileExtension) || (p.startsWith("/lib/") && hasFileExtension) || (p.startsWith("/video/") && hasFileExtension) || ["/logo.png", "/heatmap.min.js", "/kriging.js"].includes(p);
}

function resolveReference(ref, parent) {
  if (!ref || /^(data:|blob:|javascript:|#|mailto:)/i.test(ref)) return null;
  let clean = ref.replace(/\\u002F/g, "/").replace(/\\\//g, "/").trim();
  if (/[<>${},\s()=;]/.test(clean)) return null;
  if (clean.startsWith("assets/")) clean = `/${clean}`;
  if (clean.startsWith("./assets/")) clean = clean.slice(1);
  let url;
  try {
    url = new URL(clean, parent);
  } catch {
    return null;
  }
  if (!isLocal(url) || !isReferenceAsset(url)) return null;
  url.search = "";
  url.hash = "";
  return url;
}

function localFile(url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = path.resolve(ROOT, pathname.replace(/^[/\\]+/, ""));
  const root = path.resolve(ROOT) + path.sep;
  if (!file.startsWith(root)) throw new Error(`unsafe output path: ${pathname}`);
  return file;
}

function enqueue(url, parent = BASE) {
  const resolved = url instanceof URL ? url : resolveReference(url, parent);
  if (!resolved) return;
  const key = resolved.href;
  if (queued.has(key)) return;
  queued.add(key);
  queue.push(resolved);
}

function shouldParse(url, contentType) {
  const p = url.pathname.toLowerCase();
  if (p.includes("/mars3d-cesium/")) return false;
  return Boolean(contentType?.includes("javascript") || contentType?.includes("css") || /\.(js|css)$/i.test(p));
}

function discover(text, parent) {
  const refs = new Set();
  const quoted = /["'`]([^"'`\r\n]{2,500})["'`]/g;
  for (const match of text.matchAll(quoted)) refs.add(match[1]);
  const cssUrls = /url\(\s*["']?([^\)"']+)["']?\s*\)/g;
  for (const match of text.matchAll(cssUrls)) refs.add(match[1]);
  for (const ref of refs) enqueue(ref, parent);
}

function request(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent, headers: { "User-Agent": "GeoOmni-local-replica-asset-collector" } }, (res) => {
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size <= MAX_BYTES) chunks.push(chunk);
      });
      res.on("end", () => {
        if (size > MAX_BYTES) return reject(new Error(`resource exceeds ${MAX_BYTES} bytes`));
        const body = Buffer.concat(chunks);
        if ((res.statusCode || 500) < 200 || (res.statusCode || 500) >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        resolve({ body, contentType: String(res.headers["content-type"] || "") });
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
  });
}

async function download(url, label = "asset") {
  const file = localFile(url);
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    const result = await request(url);
    await fs.writeFile(file, result.body);
    downloaded.push({ url: url.href, file: path.relative(ROOT, file).replaceAll(path.sep, "/"), bytes: result.body.length, contentType: result.contentType, label });
    if (shouldParse(url, result.contentType)) {
      const text = result.body.toString("utf8");
      discover(text, url);
    }
  } catch (error) {
    skipped.push({ url: url.href, reason: String(error.message || error) });
  }
}

await fs.mkdir(ROOT, { recursive: true });
for (const page of initialPages) {
  const url = new URL(page, BASE);
  try {
    const result = await request(url);
    const file = path.join(ROOT, "pages", `${page.slice(1).replaceAll("/", "_") || "index"}.html`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, result.body);
    downloaded.push({ url: url.href, file: path.relative(ROOT, file).replaceAll(path.sep, "/"), bytes: result.body.length, contentType: result.contentType, label: "page" });
    discover(result.body.toString("utf8"), url);
  } catch (error) {
    skipped.push({ url: url.href, reason: String(error.message || error) });
  }
}
for (const asset of initialAssets) enqueue(asset, BASE);

while (queue.length && downloaded.length < MAX_FILES) {
  const url = queue.shift();
  await download(url);
}

const manifest = {
  collectedAt: new Date().toISOString(),
  source: BASE.origin,
  pages: initialPages,
  note: "Static resources collected from the authorized test environment without cookies, auth headers, API responses, or map tile query tokens.",
  downloaded,
  skipped
};
await fs.writeFile(path.join(ROOT, "asset-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ root: ROOT, downloaded: downloaded.length, skipped: skipped.length, manifest: path.join(ROOT, "asset-manifest.json") }, null, 2));
