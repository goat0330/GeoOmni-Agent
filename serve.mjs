import { createServer } from "node:http";
import https from "node:https";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const debugAssets = process.env.DEBUG_ASSETS === "1";
const nativeRoutes = new Set([
  "/chat-engine",
  "/chat-engine/chatting",
  "/chat-engine/history",
  "/risk-analysis",
  "/defense-response",
  "/task-track"
]);
// GEOOMNI_ENTERPRISE_HARDENING_V1
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
const sourceOrigin = (process.env.SOURCE_ORIGIN || localRuntimeConfig.sourceOrigin || "").replace(/\/$/, "");
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
const shutdownTimeoutMs = envNumber("SHUTDOWN_TIMEOUT_MS", 10000, 1000);
const deepSeekApiKey = process.env.DEEPSEEK_API_KEY || "";
const deepSeekBaseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const deepSeekModel = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const deepSeekThinking = process.env.DEEPSEEK_THINKING || "disabled";
const knowledgePaths = ["knowledge-base.md", "api-contracts.md", "README.md"];
let knowledgeChunksPromise;
const chatConversations = new Map();

const localTownRows = [
  "白杨坪镇", "崔家坝镇", "板桥镇", "新塘乡", "七里坪街道", "屯堡乡",
  "六角亭街道", "小渡船街道", "红土乡", "龙凤镇", "三岔镇", "金子坝街道",
  "白果乡", "盛家坝镇", "芭蕉侗族乡", "太阳河乡", "沐抚办事处", "舞阳坝街道", "沙地乡"
].map(streets => ({ streets, level: null, geoAdviceLevel: null }));

const localPlanContent = String.raw`<h2>气象预警类区域防御响应方案</h2>
<h3>一、基本信息</h3>
<ul>
<li><strong>恩施市整体</strong>：处于Ⅱ级</li>
<li><strong>局部区域</strong>：芭蕉侗族乡处于Ⅱ级</li>
<li><strong>启动时间</strong>：2026-09-10 11:51:16</li>
<li><strong>启动条件</strong>：经过专家组已会商确认</li>
</ul>
<h3>二、总则</h3>
<h4>（一）编制目的</h4>
<p>为规范恩施市芭蕉侗族乡气象预警类防御响应工作，建立“县级统筹联动、乡镇快速响应、村级精准落实、网格实时巡查”四级防御体系，明确各级职责与操作流程，高效应对暴雨、台风、暴雪等气象灾害引发的次生风险，保障群众生命财产安全，减少灾害损失，结合区域气象灾害特点制定本方案。</p>
<h4>（二）适用范围</h4>
<p>本方案适用于恩施市芭蕉侗族乡内各类气象预警发布后的预警传达、风险防范、应急响应、处置善后等工作，覆盖县、乡、村、网格四级响应主体的职责落实与协同联动。</p>
<h4>（三）响应分级依据</h4>
<p>根据气象预警等级、预计影响时长、强度，结合恩施市芭蕉侗族乡地形地质条件、承灾能力及历史灾害情况，划分为四级响应，具体标准如下：</p>
<ul>
<li><strong>红色级</strong>：接收到地质灾害气象风险预警红色预警信息，区域发生地质灾害风险极高。</li>
<li><strong>橙色级</strong>：接收到地质灾害气象风险预警橙色预警信息，区域发生地质灾害风险高。</li>
<li><strong>黄色级</strong>：接收到地质灾害气象风险预警黄色预警信息，区域发生地质灾害风险较高。</li>
<li><strong>蓝色级（一般）</strong>：接收到地质灾害气象风险预警蓝色预警信息，区域发生地质灾害风险一般。</li>
</ul>
<h3>三、各级响应人员构成及核心职责</h3>
<h4>（一）橙色响应：人员职责</h4>
<ol>
<li><p><strong>县级响应人员</strong></p><ul>
<li><strong>分管县长</strong>：统筹应急处置工作，传达气象预警信息，部署核心防御任务；对接上级争取支持，协调各部门高效调配应急资源。</li>
<li><strong>自然资源部门分管负责人</strong>：跟踪气象预警更新，联合技术团队研判次生灾害风险，指导基层防御。</li>
<li><strong>行业部门分管负责人</strong>：依据气象预警类型，落实本行业专项处置措施，做好应急支撑与风险防范。</li>
<li><strong>技术支撑单位分区负责人</strong>：现场开展次生灾害隐患排查与监测，提供技术指导，协助开展灾害损失预判。</li>
</ul></li>
<li><p><strong>乡镇级响应人员</strong></p><ul>
<li><strong>乡分管责任人</strong>：统筹本乡镇防御工作，快速传达预警信息，组织高风险区域群众转移，实时上报信息，规范管理临时安置点及应急物资。</li>
<li><strong>地质灾害管理员</strong>：实时接收并传递气象预警更新，汇总上报辖区气象影响情况与隐患信息。</li>
<li><strong>技术单位协管员</strong>：对接县级技术部门，反馈辖区实况，指导网格级人员开展科学防御。</li>
</ul></li>
<li><p><strong>村级响应人员</strong></p><ul>
<li><strong>专管员</strong>：及时传达气象预警信息，组织群众排查转移，上报信息，开展隐患巡查与物资分发。</li>
<li><strong>风险区行业部门联防员</strong>：针对气象预警可能引发的行业风险，排查隐患，监测风险变化，及时上报并协同处置。</li>
</ul></li>
<li><p><strong>网格级响应人员</strong></p><ul>
<li><strong>监测员</strong>：按频次（每8小时1次，如：每8小时1次）监测风险点，异常情况及时上报并协助转移。</li>
<li><strong>风险区巡查员</strong>：每日至少开展 3 次（如：3次）巡查，重点排查易受气象灾害影响区域，排查隐患并协助避险。</li>
</ul></li>
</ol>
<h3>四、保障措施</h3>
<h4>（一）信息报送保障</h4>
<p>建立四级信息报送机制，按时限（Ⅰ级、Ⅱ级响应每30分钟上报1次气象预警更新、灾害影响及处置进展，Ⅲ级响应每1小时上报1次，Ⅳ级响应每2小时上报1次）上报信息，确保气象数据、隐患情况、处置措施等信息及时准确完整，严禁迟报、漏报、瞒报。由县政府统筹、气象部门牵头落实。</p>
<h4>（二）物资与队伍保障</h4>
<p>县政府统筹应急队伍与物资，针对不同等级气象预警可能引发的灾害类型，储备专项应急物资（如防汛沙袋、救生衣、除雪设备等），明确储备地点与调配流程；气象部门协助提供预警信息支撑，乡、村、网格级做好物资储备管理与分发，确保应急调用高效。</p>
<h4>（三）培训与演练保障</h4>
<p>县级每年组织至少2次针对性培训演练，聚焦气象预警识别、次生灾害防范、应急处置流程等内容，由县政府统筹、气象部门组织；乡、村级每半年开展专项培训演练，提升快速响应与协同处置能力。</p>
<h4>（四）责任追究保障</h4>
<p>对严格落实气象预警响应要求、履职尽责成效显著者予以表彰；对因预警传达不及时、防御措施不到位、处置不当导致灾害损失扩大的，依法依规追究责任。</p>
<h3>五、附则</h3>
<ul>
<li>本方案由 湖北省自然资源厅,湖北省气象局负责解释。</li>
<li>本方案根据 恩施市芭蕉侗族乡气象灾害特点及预警技术发展，由县政府牵头、气象部门负责修订完善。</li>
<li>本方案自发布之日起施行。</li>
</ul>
<p><strong>编制单位</strong>：湖北省自然资源厅,湖北省气象局联合编制<br><strong>编制日期</strong>：2026年09月10日</p>`;

const localPlanContentJson = JSON.stringify(localTownRows.map(row => ({
  streets: [row.streets],
  newLevel: row.streets === "芭蕉侗族乡" ? 3 : null
})));

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
  ".webm": "video/webm"
};

const jsonData = {
  "/api/system/user/getInfo": { code: 200, data: { user: { userId: 1, userName: "admin", nickName: "演示账号", roles: ["admin"] }, permissions: ["*"] } },
  "/api/system/menu/getRouters": {
    code: 200,
    data: [{ path: "/dizai", children: [
      { path: "/chat-engine", name: "问答模式", meta: { title: "问答模式" } },
      { path: "/risk-analysis", name: "动态风险", meta: { title: "动态风险" } },
      { path: "/defense-response", name: "防御响应", meta: { title: "防御响应" } },
      { path: "/task-track", name: "事件闭环", meta: { title: "事件闭环" } }
    ] }]
  },
  "/api/dizai/ai/agent/chatHistory/list": { code: 200, data: [], total: 0 },
  "/api/dizai/riskAssessment/stat": { code: 200, data: { area: 561.46, population: 59.09, buildings: 71124, slopeUnits: 2042 } },
  "/api/dizai/riskAssessment/statChatBanner": { code: 200, data: { superHigh: 0, high: 0, middle: 1, low: 2041 } },
  "/api/dizai/riskAssessment/list": { code: 200, data: [], total: 0 },
  "/api/dizai/dataAlarm/list": { code: 200, data: { rows: [], total: 0 } },
  "/api/dizai/defRespPlan/tree": {
    code: 200,
    data: [
      { id: "type-1", count: 23, children: [
        { id: "current", children: [{ id: "independent", count: 9 }, { id: "related", count: 12 }] },
        { id: "archived", count: 2 }
      ] },
      { id: "type-2", count: 18, children: [{ id: "running", count: 0 }, { id: "history", count: 18 }] }
    ]
  },
  "/api/dizai/defRespPlan/list": {
    code: 200,
    data: [{ id: "local-region-response", type: 2, approvalStatus: 0, status: 1 }],
    total: 1
  },
  "/api/dizai/defRespPlan/local-region-response": {
    code: 200,
    data: { id: "local-region-response", type: 2, planContent: localPlanContent, planContentJson: localPlanContentJson }
  },
  "/api/dizai/defRespPlan/getStatus": { code: 200, data: true },
  "/api/dizai/defRespPlan/childGeoAdvice": { code: 200, data: localTownRows },
  "/api/dizai/defRespPlan/streetGeoAdvice": { code: 200, data: localTownRows },
  "/api/dizai/common/dzCache/query": { code: 200, data: false },
  "/api/dizai/taskHandle/riskOverview": { code: 200, data: { active: 21, region: 18, single: 23 } },
  "/api/dizai/taskDistList/stat-status": { code: 200, data: [] },
  "/api/dizai/taskDistList/stat-source-type": { code: 200, data: [] },
  "/api/dizai/taskDistList/stat-day": { code: 200, data: [] },
  "/api/dizai/taskProcessChainNode/list/latest-process-node": { code: 200, data: { rows: [], total: 0 } },
  "/api/dizai/person/stat": { code: 200, data: { slopUnitCount: 0, veryHighRiskCount: 0, highRiskCount: 0, keypointArea: [] } },
  "/api/dizai/operLog/latest": { code: 200, data: { createDate: "" } },
  "/api/dizai/riskAssessment/todayTemDynamicRiskList": { code: 200, data: [] },
  "/api/dizai/userAdRegion/1": { code: 200, data: {} },
  "/api/dizai/online/heartbeat": { code: 200, data: { online: true } },
  "/api/dizai/msgNotice/countStat": { code: 200, data: { total: 0 } },
  "/api/dizai/autoMode/status": { code: 200, data: { enabled: false } }
  ,"/api/dizai/taskHandle/status": { code: 200, data: { approvalStatus: 0, status: 1 } },
  "/api/dizai/sse/notifyByUserIds": { code: 200, data: true },
  "/api/dizai/taskHandleDetail/latest": {
    code: 200,
    data: { id: "local-region-response-detail", planContent: localPlanContent, planContentJson: localPlanContentJson }
  }
};

function sendJson(res, body, status = 200) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > requestBodyLimitBytes) throw new Error("request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function knowledgeTerms(value) {
  return [...new Set((String(value || "").match(/[\u4e00-\u9fff]{2,}|[A-Za-z0-9][A-Za-z0-9_-]{1,}/g) || [])
    .map(term => term.toLowerCase()))];
}

function splitKnowledgeDocument(source, text) {
  return text
    .split(/(?=^#{1,3}\s)/m)
    .map(section => section.trim())
    .filter(section => section.length > 20)
    .map(section => {
      const heading = section.match(/^#{1,3}\s+(.+)$/m);
      return {
        source,
        title: heading ? heading[1].trim() : source,
        text: section.slice(0, 2400)
      };
    });
}

async function loadKnowledgeChunks() {
  const chunks = [];
  for (const relativePath of knowledgePaths) {
    try {
      const text = await readFile(path.join(root, relativePath), "utf8");
      chunks.push(...splitKnowledgeDocument(relativePath, text));
    } catch {
      // A missing optional knowledge file does not prevent the local UI from running.
    }
  }
  return chunks;
}

async function searchKnowledge(query) {
  knowledgeChunksPromise ||= loadKnowledgeChunks();
  const chunks = await knowledgeChunksPromise;
  const terms = knowledgeTerms(query);
  const ranked = chunks.map((chunk, index) => {
    const haystack = `${chunk.title}\n${chunk.text}`.toLowerCase();
    const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    return { chunk, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = ranked.filter(item => item.score > 0).slice(0, 4);
  const fallback = selected.length ? selected : ranked.slice(0, 3);
  return fallback.map(({ chunk }) => ({
    source: `本地资料库 · ${chunk.source}`,
    title: chunk.title,
    content: chunk.text
  }));
}

function parseChatBody(rawBody) {
  try {
    const parsed = JSON.parse(rawBody || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function extractChatQuery(body) {
  const message = Array.isArray(body.messages)
    ? [...body.messages].reverse().find(item => item && item.role !== "system")?.content
    : "";
  const candidates = [body.query, body.question, body.message, body.content, message];
  const value = candidates.find(candidate => typeof candidate === "string" && candidate.trim());
  return String(value || "请介绍当前页面").trim().slice(0, 8000);
}

function normalizeChatContent(value) {
  if (typeof value === "string") return value.trim().slice(0, 4000);
  if (Array.isArray(value)) {
    return value.map(part => typeof part === "string" ? part : part?.text || "").join("").trim().slice(0, 4000);
  }
  return "";
}

function extractConversationHistory(body) {
  if (!Array.isArray(body.messages)) return [];
  return body.messages
    .filter(item => item && (item.role === "user" || item.role === "assistant"))
    .map(item => ({ role: item.role, content: normalizeChatContent(item.content) }))
    .filter(item => item.content)
    .slice(-8);
}

function getConversationId(body) {
  const supplied = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  return (supplied || `local-conversation-${Date.now().toString(36)}`).slice(0, 120);
}

function writeSseHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
}

function writeSse(res, payload) {
  if (!res.destroyed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function finishSse(res) {
  if (!res.destroyed) {
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

function streamPieces(text, size = 28) {
  const chars = Array.from(String(text || ""));
  const pieces = [];
  for (let index = 0; index < chars.length; index += size) pieces.push(chars.slice(index, index + size).join(""));
  return pieces;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildLocalAnswer(query, refs) {
  const first = refs[0]?.title || "本地资料库";
  return `我先检索了本地资料库，命中 ${refs.length} 条相关资料。\n\n关于“${query}”，当前可依据《${first}》进行判断。涉及响应等级、人员调度或现场处置时，请以正式制度和专业人员最终确认结果为准。`;
}

function deepSeekContent(choice) {
  const value = choice?.delta?.content ?? choice?.message?.content ?? "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(part => typeof part === "string" ? part : part?.text || "").join("");
  return "";
}

function buildDeepSeekSystemPrompt(refs) {
  const context = refs.map((ref, index) => `资料 ${index + 1}｜${ref.title}\n${ref.content}`).join("\n\n");
  return [
    "你是地象大模型的智能助手。请用简洁、清晰的中文回答用户问题。",
    "回答前必须优先使用本地资料库中的资料；资料没有覆盖的内容要明确说资料不足，不要编造事实。",
    "涉及地质灾害防御、响应等级、人员转移或现场处置时，只能给辅助参考，并提醒以专业人员和正式制度为准。",
    `本地资料库检索结果：\n${context || "本次没有命中资料。"}`
  ].join("\n\n");
}

function sendWorkflowFinished(res, messageId, status = "succeeded", conversationId = "") {
  writeSse(res, {
    eventType: "WORKFLOW_FINISHED",
    message_id: messageId,
    conversation_id: conversationId,
    answer: "",
    data: { status }
  });
  finishSse(res);
}

async function streamDeepSeekAnswer(req, res, query, refs, history, messageId, conversationId) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.on("close", abort);

  try {
    const thinking = deepSeekThinking.toLowerCase();
    const requestBody = {
      model: deepSeekModel,
      messages: [
        { role: "system", content: buildDeepSeekSystemPrompt(refs) },
        ...history,
        { role: "user", content: query }
      ],
      stream: true
    };
    if (thinking === "enabled" || thinking === "disabled") requestBody.thinking = { type: thinking };

    const upstream = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepSeekApiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!upstream.ok || !upstream.body) {
      writeSse(res, { eventType: "MESSAGE", message_id: messageId, answer: "</think>" });
      sendWorkflowFinished(res, messageId, "failed", conversationId);
      return;
    }

    let pending = "";
    let emittedContent = false;
    let generatedAnswer = "";
    let thinkingClosed = false;
    const closeThinking = () => {
      if (thinkingClosed || res.destroyed) return;
      writeSse(res, { eventType: "MESSAGE", message_id: messageId, answer: "</think>" });
      thinkingClosed = true;
    };
    const decoder = new TextDecoder();
    const handleFrame = frame => {
      const data = frame.split(/\r?\n/)
        .filter(line => line.startsWith("data:"))
        .map(line => line.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") return data === "[DONE]";
      let payload;
      try { payload = JSON.parse(data); } catch { return false; }
      const content = deepSeekContent(payload.choices?.[0]);
      if (content) {
        closeThinking();
        emittedContent = true;
        generatedAnswer += content;
        writeSse(res, { eventType: "MESSAGE", message_id: messageId, answer: content });
      }
      return false;
    };

    for await (const chunk of upstream.body) {
      pending += decoder.decode(chunk, { stream: true });
      const frames = pending.split(/\r?\n\r?\n/);
      pending = frames.pop() || "";
      for (const frame of frames) if (handleFrame(frame)) break;
      if (res.destroyed) return;
    }
    pending += decoder.decode();
    if (pending) handleFrame(pending);
    if (!emittedContent) {
      closeThinking();
      writeSse(res, { eventType: "MESSAGE", message_id: messageId, answer: "模型未返回可显示内容。" });
    }
    sendWorkflowFinished(res, messageId, "succeeded", conversationId);
    return generatedAnswer;
  } catch (error) {
    if (!res.destroyed && error?.name !== "AbortError") {
      writeSse(res, { eventType: "MESSAGE", message_id: messageId, answer: "</think>" });
      sendWorkflowFinished(res, messageId, "failed", conversationId);
    }
    return "";
  } finally {
    req.off("close", abort);
  }
}

async function handleChat(req, res) {
  const body = parseChatBody(await readBody(req));
  const query = extractChatQuery(body);
  const conversationId = getConversationId(body);
  const stored = chatConversations.get(conversationId);
  const history = stored?.messages?.length ? stored.messages.slice(-8) : extractConversationHistory(body);
  const refs = await searchKnowledge(query);
  const messageId = `local-${Date.now().toString(36)}`;
  writeSseHeaders(res);

  // Keep the original five-step loading progress visible while the local index is searched.
  await wait(1900);
  writeSse(res, {
    eventType: "NODE_FINISHED",
    message_id: messageId,
    answer: "",
    data: { title: "Knowledge Showcase", outputs: { result: refs } }
  });
  writeSse(res, {
    eventType: "MESSAGE",
    message_id: messageId,
    answer: "<think>正在检索本地资料库…"
  });
  writeSse(res, {
    eventType: "MESSAGE",
    message_id: messageId,
    answer: "\n本地资料检索完成，正在整理回答…"
  });
  await wait(450);

  if (!deepSeekApiKey) {
    writeSse(res, { eventType: "MESSAGE", message_id: messageId, answer: "</think>" });
    for (const piece of streamPieces(buildLocalAnswer(query, refs))) {
      writeSse(res, { eventType: "MESSAGE", message_id: messageId, answer: piece });
      await new Promise(resolve => setTimeout(resolve, 24));
    }
    const answer = buildLocalAnswer(query, refs);
    chatConversations.set(conversationId, { messages: [...history, { role: "user", content: query }, { role: "assistant", content: answer }].slice(-8) });
    sendWorkflowFinished(res, messageId, "succeeded", conversationId);
    return;
  }

  const answer = await streamDeepSeekAnswer(req, res, query, refs, history, messageId, conversationId);
  if (answer) {
    chatConversations.set(conversationId, { messages: [...history, { role: "user", content: query }, { role: "assistant", content: answer }].slice(-8) });
  }
}

async function handleApi(req, res, url) {
  if (debugAssets) console.log(`api request: ${req.method} ${url.pathname}`);
  if (url.pathname === "/api/dizai/sse/connect") {
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ online: true, source: "local-mock" })}\n\n`);
    setTimeout(() => res.end(), 1200);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/dizai/ai/agent/chat") {
    await handleChat(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/dizai/online/heartbeat") {
    sendJson(res, jsonData["/api/dizai/online/heartbeat"]);
    return;
  }
  const exact = jsonData[url.pathname];
  if (exact) {
    sendJson(res, exact);
    return;
  }
  if (url.pathname.startsWith("/api/dizai/adRegion/")) {
    sendJson(res, { code: 200, data: [] });
    return;
  }
  if (url.pathname.startsWith("/api/dizai/slopeUnit/")) {
    sendJson(res, { code: 200, data: [] });
    return;
  }
  if (url.pathname.startsWith("/api/dizai/hazardPoint/")) {
    sendJson(res, { code: 200, data: [] });
    return;
  }
  if (url.pathname === "/api/dizai/dataAlarm/matchList") {
    sendJson(res, { code: 200, data: [] });
    return;
  }
  if (url.pathname === "/api/dizai/role/expert") {
    sendJson(res, { code: 200, data: [] });
    return;
  }
  if (url.pathname.startsWith("/api/dizai/meeting/getMeetingId/")) {
    sendJson(res, { code: 200, data: "local-meeting" });
    return;
  }
  if (url.pathname.startsWith("/api/dizai/meeting/getMeetingInfo/")) {
    sendJson(res, { code: 200, data: { initiator: 1, handleId: "local-region-response", participantsMap: {} } });
    return;
  }
  if (url.pathname.startsWith("/api/dizai/meeting/")) {
    sendJson(res, { code: 200, data: true });
    return;
  }
  if (url.pathname.startsWith("/api/dizai/defRespPlan/")) {
    sendJson(res, { code: 200, data: {} });
    return;
  }
  if (debugAssets) console.log(`api 404: ${req.method} ${url.pathname}`);
  sendJson(res, { code: 404, message: "local mock endpoint not implemented" }, 404);
}

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  if (decoded.includes("\0")) return null;
  const candidate = path.resolve(root, `.${decoded || "/index.html"}`);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  if (candidate !== path.resolve(root) && !candidate.startsWith(rootPrefix)) return null;
  return candidate;
}

function aliasedFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const aliases = [
    ["/assets/", path.join(root, "mirror-clean6", "assets")],
    ["/MapResource/", path.join(root, "mirror-clean6", "MapResource")],
    ["/logo.png", path.join(root, "mirror-clean6", "logo.png")],
    ["/heatmap.min.js", path.join(root, "mirror-clean6", "heatmap.min.js")],
    ["/kriging.js", path.join(root, "mirror-clean6", "kriging.js")],
    ["/lib/", path.join(root, "mirror-clean6", "lib")],
    ["/video/", path.join(root, "mirror-clean6", "video")]
  ];
  for (const [prefix, base] of aliases) {
    if (decoded !== prefix.slice(0, -1) && !decoded.startsWith(prefix)) continue;
    const suffix = decoded === prefix.slice(0, -1) ? "" : decoded.slice(prefix.length);
    const candidate = path.resolve(base, suffix);
    const basePrefix = `${path.resolve(base)}${path.sep}`;
    if (candidate === path.resolve(base) || candidate.startsWith(basePrefix)) return candidate;
  }
  return null;
}

async function serveLocalMapTile(res, url) {
  const tilePaths = new Set(["/t_map/img_w/wmts", "/t_map/cia_w/wmts", "/t_map/vec_w/wmts"]);
  if (!tilePaths.has(url.pathname)) return false;
  const z = Number(url.searchParams.get("TileMatrix"));
  const x = Number(url.searchParams.get("TileCol"));
  const y = Number(url.searchParams.get("TileRow"));
  if (![z, x, y].every(Number.isInteger) || z < 0 || x < 0 || y < 0) {
    sendJson(res, { code: 400, message: "bad map tile" }, 400);
    return true;
  }
  const sourceLevel = 10;
  const scale = 2 ** Math.abs(z - sourceLevel);
  const sourceX = z > sourceLevel ? Math.floor(x / scale) : x * scale;
  const sourceY = z > sourceLevel ? Math.floor(y / scale) : y * scale;
  const mapRoot = path.join(root, "mirror-clean6", "MapResource", "Tianditu");
  const candidates = [
    path.join(mapRoot, String(z), String(x), `${y}.jpg`),
    path.join(mapRoot, String(sourceLevel), String(sourceX), `${sourceY}.jpg`)
  ];
  for (const file of candidates) {
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store" });
      res.end(body);
      return true;
    } catch {
      // Try the next local level before falling back to the source service.
    }
  }
  return false;
}

function isSourceMapAsset(url) {
  return url.pathname === "/t_map/img_w/wmts" || url.pathname === "/t_map/cia_w/wmts" || url.pathname === "/t_map/vec_w/wmts" ||
    (url.pathname.startsWith("/MapResource/enshi-dem-562/") && url.pathname.endsWith(".terrain"));
}

function proxySourceMapAsset(res, url) {
  if (!isSourceMapAsset(url)) return false;
  if (!allowSourceProxy || !sourceOrigin) {
    sendJson(res, { code: 404, message: "map asset unavailable locally; source proxy disabled" }, 404);
    return true;
  }
  const upstreamUrl = `${sourceOrigin}${url.pathname}${url.search}`;
  const request = https.get(upstreamUrl, { rejectUnauthorized: sourceTlsVerify }, upstream => {
    if (debugAssets) console.log(`map proxy: ${url.pathname} -> ${upstream.statusCode || 0}`);
    const headers = { "Cache-Control": "no-store" };
    if (upstream.headers["content-type"]) headers["Content-Type"] = upstream.headers["content-type"];
    if (upstream.headers["content-encoding"]) headers["Content-Encoding"] = upstream.headers["content-encoding"];
    res.writeHead(upstream.statusCode || 502, headers);
    upstream.pipe(res);
  });
  request.on("error", error => {
    if (debugAssets) console.log(`map proxy error: ${url.pathname} -> ${error.code || error.message}`);
    if (!res.headersSent) sendJson(res, { code: 502, message: `map asset unavailable: ${error.message}` }, 502);
    else res.end();
  });
  return true;
}

async function serveStatic(req, res, url) {
  if (await serveLocalMapTile(res, url)) return;
  if (proxySourceMapAsset(res, url)) return;
  let file = nativeRoutes.has(url.pathname) || url.pathname === "/native.html" ? path.join(root, "native.html") : (aliasedFile(url.pathname) || safeFile(url.pathname));
  if (!file) return sendJson(res, { code: 400, message: "bad path" }, 400);
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, "index.html");
  } catch {
    const isAssetPath = ["/assets/", "/MapResource/", "/lib/", "/video/"].some((prefix) => url.pathname.startsWith(prefix)) || ["/logo.png", "/heatmap.min.js", "/kriging.js"].includes(url.pathname);
    if (isAssetPath) {
      if (debugAssets) console.log(`static 404: ${url.pathname}`);
      return sendJson(res, { code: 404, message: "asset not found" }, 404);
    }
    if (debugAssets) console.log(`static fallback to index: ${url.pathname}`);
    file = path.join(root, "index.html");
  }
  try {
    const body = await readFile(file);
    const headers = { "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" };
    if (path.extname(file).toLowerCase() === ".terrain") headers["Content-Encoding"] = "gzip";
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    sendJson(res, { code: 404, message: "not found" }, 404);
  }
}

let requestSequence = 0;
const chatRateBuckets = new Map();
const startedAt = Date.now();

function logEvent(level, event, fields = {}) {
  const record = { timestamp: new Date().toISOString(), level, event, ...fields };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function requestIdFor(req) {
  const supplied = req.headers["x-request-id"];
  if (typeof supplied === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)) return supplied;
  requestSequence = (requestSequence + 1) % 1000000000;
  return `geo-${Date.now().toString(36)}-${process.pid}-${requestSequence.toString(36)}`;
}

function clientIp(req) {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function chatRateLimited(req) {
  const minute = Math.floor(Date.now() / 60000);
  const key = `${clientIp(req)}:${minute}`;
  const count = (chatRateBuckets.get(key) || 0) + 1;
  chatRateBuckets.set(key, count);
  if (chatRateBuckets.size > 10000) chatRateBuckets.clear();
  return count > chatRateLimitPerMinute;
}

async function handleHealth(res, ready = false) {
  if (!ready) {
    sendJson(res, { status: "ok", uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) });
    return;
  }
  try {
    knowledgeChunksPromise ||= loadKnowledgeChunks();
    const chunks = await knowledgeChunksPromise;
    if (!chunks.length) {
      sendJson(res, { status: "not-ready", reason: "knowledge-base-empty" }, 503);
      return;
    }
    sendJson(res, { status: "ready", knowledgeChunks: chunks.length });
  } catch {
    sendJson(res, { status: "not-ready" }, 503);
  }
}

const server = createServer(async (req, res) => {
  const requestId = requestIdFor(req);
  const requestStarted = Date.now();
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    let pathname = "/";
    try { pathname = new URL(req.url || "/", "http://local").pathname; } catch {}
    logEvent("info", "http_request", {
      requestId,
      method: req.method || "GET",
      path: pathname,
      status: res.statusCode,
      durationMs: Date.now() - requestStarted
    });
  });

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
    if (url.pathname === "/healthz") return await handleHealth(res, false);
    if (url.pathname === "/readyz") return await handleHealth(res, true);
    if (req.method === "POST" && url.pathname === "/api/dizai/ai/agent/chat" && chatRateLimited(req)) {
      res.setHeader("Retry-After", "60");
      return sendJson(res, { code: 429, message: "Too Many Requests", requestId }, 429);
    }
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    logEvent("error", "request_failed", { requestId, message: String(error?.message || error) });
    if (res.headersSent) {
      if (!res.destroyed) res.end();
      return;
    }
    sendJson(res, {
      code: 500,
      message: isProduction ? "Internal Server Error" : String(error?.message || error),
      requestId
    }, 500);
  }
});

server.requestTimeout = requestTimeoutMs;
server.headersTimeout = headersTimeoutMs;
server.keepAliveTimeout = keepAliveTimeoutMs;

server.listen(port, host, () => {
  logEvent("info", "server_started", {
    host,
    port,
    environment: runtimeEnvironment,
    sourceProxyEnabled: allowSourceProxy && Boolean(sourceOrigin),
    sourceTlsVerify,
    chatRateLimitPerMinute
  });
  console.log(`GeoOmni local replica: http://${host}:${port}/chat-engine/chatting`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logEvent("info", "shutdown_started", { signal });
  const timer = setTimeout(() => {
    logEvent("error", "shutdown_timeout", { timeoutMs: shutdownTimeoutMs });
    process.exit(1);
  }, shutdownTimeoutMs);
  timer.unref();

  server.close(error => {
    clearTimeout(timer);
    if (error) {
      logEvent("error", "shutdown_failed", { message: String(error.message || error) });
      process.exitCode = 1;
    } else {
      logEvent("info", "shutdown_complete");
    }
  });
  server.closeIdleConnections?.();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
