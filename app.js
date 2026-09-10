const app = document.querySelector("#app");
const assetRoot = "./mirror-clean6";

const routes = {
  "/chat-engine": "问答模式",
  "/risk-analysis": "动态风险",
  "/defense-response": "防御响应",
  "/task-track": "事件闭环"
};

const state = {
  route: routes[location.pathname] ? location.pathname : "/chat-engine",
  navCollapsed: false,
  riskFilter: "全部",
  period: "今日",
  tab: "风险评价",
  chatMessages: [],
  consultationOpen: false,
  consultationPeopleOpen: false,
  consultationTownPickerOpen: false,
  consultationExpanded: false,
  consultationDocumentExpanded: false,
  consultationNotice: "",
  consultationSelectedPeople: ["gov-demo", "expert-demo"],
  consultationLevels: { "芭蕉侗族乡": "二级" }
};

const consultationParticipants = [
  { id: "gov-demo", role: "县级响应岗位", name: "演示账号", status: "在线" },
  { id: "town-demo", role: "乡镇响应岗位", name: "演示联络员", status: "离线" },
  { id: "resource-demo", role: "自然资源部门", name: "演示值守席", status: "离线" },
  { id: "expert-demo", role: "专家", name: "专家席位", status: "在线" },
  { id: "tech-demo", role: "技术支撑", name: "技术支撑席位", status: "离线" }
];

const consultationRows = [
  ["芭蕉侗族乡", "Ⅱ级", "Ⅱ级"], ["白杨坪镇", "暂无", "暂无"], ["崔家坝镇", "暂无", "暂无"],
  ["板桥镇", "暂无", "暂无"], ["新塘乡", "暂无", "暂无"], ["七里坪街道", "暂无", "暂无"],
  ["屯堡乡", "暂无", "暂无"], ["六角亭街道", "暂无", "暂无"], ["小渡船街道", "暂无", "暂无"],
  ["红土乡", "暂无", "暂无"], ["龙凤镇", "暂无", "暂无"], ["三岔镇", "暂无", "暂无"],
  ["金子坝街道", "暂无", "暂无"], ["白果乡", "暂无", "暂无"], ["盛家坝镇", "暂无", "暂无"],
  ["太阳河乡", "暂无", "暂无"], ["沐抚办事处", "暂无", "暂无"], ["舞阳坝街道", "暂无", "暂无"],
  ["沙地乡", "暂无", "暂无"]
];

const consultationLevelOptions = ["请选择", "一级", "二级", "三级", "四级"];

const prompts = [
  "地质灾害风险如何评估？",
  "滑坡发生前有哪些预警信号？",
  "如何判断自家房屋是否处于地质灾害危险区？",
  "地质灾害监测设备如何工作？",
  "泥石流来了怎么逃生？",
  "什么是地质灾害“易发区”和“危险区”？"
];

const local = (file) => `${assetRoot}/${file.startsWith("assets/") || file.startsWith("MapResource/") ? file : `assets/${file}`}`;

async function api(path, options = {}) {
  try {
    const response = await fetch(path, {
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function navigate(path) {
  if (!routes[path]) return;
  history.pushState({}, "", path);
  state.route = path;
  renderShell();
}

function navItem(path, icon, label) {
  const active = state.route === path ? "active" : "";
  return `<button class="nav-item ${active}" data-route="${path}"><span class="nav-icon">${icon}</span><span class="nav-label-text">${label}</span></button>`;
}

function renderShell() {
  const dispatchActive = ["/risk-analysis", "/defense-response", "/task-track"].includes(state.route);
  app.innerHTML = `
    <div class="app-shell ${state.navCollapsed ? "sidebar-is-collapsed" : ""}">
      <aside class="sidebar">
        <div class="brand">
          <img src="${local("logo-vU81OBLX.png")}" alt="地象" />
          <div><strong>GeoOmni</strong><small>地象大模型 · 本地复现</small></div>
        </div>
        <nav class="nav" aria-label="主导航">
          <div class="nav-label">工作台</div>
          ${navItem("/chat-engine", "⌂", "问答模式")}
          <button class="nav-parent ${dispatchActive ? "active" : ""}" data-dispatch-toggle aria-expanded="true"><span class="nav-icon">◈</span><span class="nav-label-text">调度模式</span><span class="nav-chevron">⌄</span></button>
          <div class="nav-children" data-dispatch-menu>
            ${navItem("/risk-analysis", "◉", "动态风险")}
            ${navItem("/defense-response", "◇", "防御响应")}
            ${navItem("/task-track", "▣", "事件闭环")}
          </div>
          ${navItem("/chat-engine", "♡", "关爱模式")}
          ${navItem("/chat-engine", "✉", "消息中心")}
          ${navItem("/chat-engine", "⚙", "系统设置")}
          ${navItem("/chat-engine", "♙", "超级管理员")}
        </nav>
        <div class="sidebar-footer"><img src="${local("avatar-WBl7-KoR.png")}" alt="管理员头像" /><div><strong>管理员</strong><small>本地测试环境</small></div></div>
        <button class="collapse-btn" data-collapse>${state.navCollapsed ? "展开侧栏" : "收起"}</button>
      </aside>
      <main class="main-shell">
        <header class="topbar">
          <div class="breadcrumb"><span>地象大模型</span><b>/</b><strong id="page-title">${routes[state.route]}</strong></div>
          <div class="connection"><i></i><span id="data-status">本地复现服务</span></div>
        </header>
        <section class="page-view" id="page-view"></section>
      </main>
    </div>`;

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });
  document.querySelector("[data-collapse]").addEventListener("click", () => {
    state.navCollapsed = !state.navCollapsed;
    renderShell();
  });
  document.querySelector("[data-dispatch-toggle]").addEventListener("click", () => {
    const menu = document.querySelector("[data-dispatch-menu]");
    const open = menu.hidden;
    menu.hidden = !open;
    document.querySelector("[data-dispatch-toggle]").setAttribute("aria-expanded", String(open));
  });

  const page = document.querySelector("#page-view");
  page.innerHTML = renderRoute();
  bindRoute();
  primeRoute();
}

function renderRoute() {
  if (state.route === "/risk-analysis") return renderRisk();
  if (state.route === "/defense-response") return renderDefense();
  if (state.route === "/task-track") return renderTaskTrack();
  return renderChat();
}

function heading(eyebrow, title, copy, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2><p>${copy}</p></div><div class="toolbar">${actions}</div></div>`;
}

function renderChat() {
  const messageMarkup = state.chatMessages.length ? `<div class="chat-stream" id="chat-stream"></div>` : "";
  return `
    ${heading("QUESTION MODE", "智能问答", "把地质灾害知识、监测信息和处置建议组织成可理解的回答。", `<button class="soft-btn">历史问答</button>`)}
    <div class="chat-layout">
      <section class="card chat-main">
        <div class="chat-hero"><img src="${local("ai_avator_chat-CR5PAeJ6.png")}" alt="地象助手" /><div><h2>我是地象</h2><p>感知地质表象 · 探寻灾害真象 · 把握规律本象</p></div></div>
        <div class="question-grid">${prompts.map((prompt) => `<button class="question-btn" data-prompt="${prompt}">⌁ ${prompt}</button>`).join("")}</div>
        ${messageMarkup}
        <form class="chat-form" id="chat-form"><textarea id="chat-input" rows="1" placeholder="请输入你想了解的地质灾害问题"></textarea><button type="submit">发送</button></form>
        <div class="chat-tools"><span>✦ AI识图</span><span>◌ 语音播报</span><span>本地 Mock API · 可替换为真实接口</span></div>
      </section>
      <aside class="card history-panel">
        <div class="panel-title"><h3>历史问答</h3><span>本地样例</span></div>
        <div class="history-list">
          <div class="history-item">地质灾害风险如何评估？<small>今天 10:08</small></div>
          <div class="history-item">恩施市风险区情况查询<small>昨天 16:22</small></div>
          <div class="history-item">滑坡发生前有哪些预警信号？<small>昨天 09:41</small></div>
        </div>
        <div class="recommend"><strong>为您推荐一下热门使用</strong><p>制度规范、地灾科普、解决方案，快速进入常用知识场景。</p></div>
      </aside>
    </div>`;
}

function mapMarkup() {
  const tiles = [
    "MapResource/Tianditu/10/821/420.jpg", "MapResource/Tianditu/10/822/420.jpg", "MapResource/Tianditu/10/823/420.jpg",
    "MapResource/Tianditu/10/821/421.jpg", "MapResource/Tianditu/10/822/421.jpg", "MapResource/Tianditu/10/823/421.jpg"
  ];
  return `<div class="map-stage"><div class="map-tiles">${tiles.map((tile) => `<img src="${local(tile)}" alt="地图瓦片" />`).join("")}</div><div class="map-grid-lines"></div><div class="map-boundary"></div><span class="map-point p1"></span><span class="map-point p2"></span><span class="map-point p3"></span><div class="map-legend"><span><i class="legend-dot"></i>高风险</span><span><i class="legend-dot orange"></i>中风险</span><span><i class="legend-dot cyan"></i>监测点</span></div><div class="map-label">湖北省 · 恩施市 · 试点区</div></div>`;
}

function renderRisk() {
  const riskIcon = local("risk-R0lM6nP-.png");
  return `
    ${heading("DISPATCH / RISK", "动态风险评价", "以风险等级、斜坡单元和承灾体统计为核心的一张图。", `<button class="soft-btn">实时</button><button class="primary-btn">预测</button>`)}
    <div class="stat-grid">
      <div class="card stat-card"><small>风险面积</small><strong>561.46</strong><span>km² · 今日更新</span><img class="stat-icon" src="${riskIcon}" alt="" /></div>
      <div class="card stat-card"><small>影响人口</small><strong>59.09</strong><span>万人 · 试点区</span><img class="stat-icon" src="${local("avatar-half-sm4hvUpw.png")}" alt="" /></div>
      <div class="card stat-card"><small>承灾建筑</small><strong>71,124</strong><span>栋 · 风险区域</span><img class="stat-icon" src="${local("report-BrZ6r7_T.png")}" alt="" /></div>
      <div class="card stat-card"><small>斜坡单元</small><strong>2,042</strong><span>个 · 动态评价</span><img class="stat-icon" src="${local("point-b76q5Qf4.png")}" alt="" /></div>
    </div>
    <div class="dashboard-grid">
      <section class="card map-card"><div class="map-head"><h3>动态风险评价“一张图”</h3><span>实时数据 · 恩施市</span></div>${mapMarkup()}</section>
      <div class="side-stack">
        <section class="card side-card"><div class="section-head"><h3>风险区统计</h3><span>更新于 2026-09-10</span></div><div class="risk-list"><div class="risk-row"><i></i><span>极高风险</span><strong>0</strong></div><div class="risk-row"><i class="orange"></i><span>高风险</span><strong>0</strong></div><div class="risk-row"><i class="yellow"></i><span>中风险</span><strong>1</strong></div><div class="risk-row"><i class="blue"></i><span>低风险</span><strong>2,041</strong></div></div></section>
        <section class="card side-card"><div class="section-head"><h3>筛选风险等级</h3><span>点击查看</span></div><div class="filters">${["全部", "极高风险", "高风险", "中风险", "低风险"].map((x) => `<button class="filter-btn ${state.riskFilter === x ? "active" : ""}" data-risk-filter="${x}">${x}</button>`).join("")}</div><p class="summary-copy" style="margin-top:14px">当前中风险区主要集中在 <em>沐抚办事处木贡村</em>，系统持续关注高风险区域变化。</p></section>
      </div>
    </div>`;
}

function renderDefense() {
  return `
    ${heading("DISPATCH / RESPONSE", "防御响应", "围绕预警、区域响应、单点处置和专家会商组织防御行动。", `<button class="soft-btn" data-history-toggle>历史记录</button><button class="soft-btn" data-open-consultation>AI会商室</button><button class="primary-btn">上传预警报告</button>`)}
    <div class="response-grid"><div class="card response-card"><h3>区域防御响应</h3><strong>18</strong><p>历史响应记录</p></div><div class="card response-card"><h3>单点防御响应</h3><strong>23</strong><p>当前处置与历史任务</p></div><div class="card response-card"><h3>当前响应中</h3><strong>21</strong><p>请关注现场反馈和闭环进展</p></div></div>
    <div class="response-layout">
      <section class="card side-card"><div class="section-head"><h3>区域防御响应</h3><span class="eyebrow">LIVE MONITOR</span></div><div class="empty-state"><div><strong>当前暂无启动中的区域防御响应</strong><span>系统持续关注高风险区域及待处置任务变化。</span></div></div><div class="response-list"><div class="response-item"><header><strong>恩施市地质灾害气象风险预警预报</strong><span>持续关注</span></header><p>共有 21 个单点防御响应处置中，请关注现场反馈和处置闭环进展。</p></div><div class="response-item"><header><strong>试点区防御预案</strong><span>已加载</span></header><p>区域关联 12 项，独立启动 9 项，历史响应 18 项。</p></div><div class="response-item consultation-entry"><header><strong>应急会商室</strong><span>角色权限已加载</span></header><p>协同编辑防御响应方案，汇总专家建议并由主持人确认乡镇响应等级。</p><button class="soft-btn" data-open-consultation>进入 AI 会商室</button></div></div></section>
      <section class="card side-card"><div class="section-head"><h3>沙盘图例</h3><span>地图联动</span></div>${mapMarkup()}<div class="filters" style="margin-top:13px"><button class="filter-btn active">红色风险</button><button class="filter-btn">橙色风险</button><button class="filter-btn">黄色风险</button><button class="filter-btn">蓝色风险</button></div></section>
    </div>${renderConsultationRoom()}`;
}

function renderConsultationRoom() {
  if (!state.consultationOpen) return "";
  const selectedPeople = consultationParticipants.filter((person) => state.consultationSelectedPeople.includes(person.id));
  const participantSummary = selectedPeople.length ? selectedPeople.map((person) => person.name).join("、") : "未选择参会人员";
  const rows = consultationRows.map(([town, current, suggestion]) => {
    const selectedLevel = state.consultationLevels[town] || "请选择";
    return `<tr><td><span class="town-name">${town}</span><button class="town-remove" type="button" title="从方案中移除" data-consultation-remove="${town}">−</button></td><td>${current}</td><td>${suggestion}</td><td><select data-town-level="${town}" aria-label="${town}最终确认等级">${consultationLevelOptions.map((option) => `<option ${selectedLevel === option ? "selected" : ""}>${option}</option>`).join("")}</select></td></tr>`;
  }).join("");
  const peoplePanel = state.consultationPeopleOpen ? `<div class="consultation-people-panel"><div class="consultation-panel-title"><strong>选择参会人员</strong><span>按角色和在线状态展示</span></div><div class="consultation-people-list">${consultationParticipants.map((person) => `<label class="consultation-person"><input type="checkbox" data-consultation-person="${person.id}" ${state.consultationSelectedPeople.includes(person.id) ? "checked" : ""} /><span><b>${person.role} · ${person.name}</b><small class="${person.status === "在线" ? "is-online" : ""}">${person.status}</small></span></label>`).join("")}</div><div class="consultation-panel-actions"><button class="soft-btn" type="button" data-consultation-people-cancel>取消</button><button class="primary-btn" type="button" data-consultation-people-confirm>确认</button></div></div>` : "";
  const townPicker = state.consultationTownPickerOpen ? `<div class="consultation-town-picker"><span>已加载区域乡镇清单，可在本地演示中追加会商对象：</span><div>${["白果乡", "盛家坝镇", "沙地乡"].map((town) => `<button type="button" data-consultation-town="${town}">${town}</button>`).join("")}</div></div>` : "";
  return `<div class="consultation-backdrop" data-consultation-dismiss><section class="consultation-room ${state.consultationExpanded ? "is-expanded" : ""} ${state.consultationDocumentExpanded ? "document-expanded" : ""}" role="dialog" aria-modal="true" aria-label="应急会商室">
    <header class="consultation-header"><div class="consultation-title"><i></i><strong>应急会商室</strong><time>${new Date().toLocaleTimeString("zh-CN", { hour12: false })}</time><span class="consultation-signal"><b></b><b></b><b></b><b></b></span></div><div class="consultation-header-actions"><span>会议人员：${participantSummary}</span><button class="consultation-icon-btn" type="button" title="选择参会人员" data-consultation-people>＋</button><button class="consultation-phone" type="button" title="语音通道" data-consultation-call>☎</button><button class="consultation-icon-btn" type="button" title="切换大小" data-consultation-maximize>↗</button></div>${peoplePanel}</header>
    <div class="consultation-notice"><span>!</span>专家意见通过语音实时表达。主持人修改风险等级，专家核实后由主持人确认。</div>
    ${state.consultationNotice ? `<div class="consultation-inline-status">${state.consultationNotice}</div>` : ""}
    <div class="consultation-body"><section class="consultation-document"><div class="consultation-pane-title"><strong>▤ 防御响应方案（协同编辑中）</strong><button type="button" title="刷新方案" data-consultation-refresh>⟳</button><button type="button" title="放大文档" data-consultation-document-expand>↗</button></div><div class="consultation-doc-scroll"><h3>气象预警类区域防御响应方案</h3><h4>一、基本信息</h4><ul><li><b>恩施市整体：</b>处于Ⅱ级</li><li><b>局部区域：</b>芭蕉侗族乡处于Ⅱ级</li><li><b>启动条件：</b>经过专家组会商确认</li></ul><h4>二、总则</h4><h5>（一）编制目的</h5><p>建立“县级统筹联动、乡镇快速响应、村级精准落实、网格实时巡查”四级防御体系，明确各级职责与操作流程，高效应对气象灾害引发的次生风险。</p><h5>（二）适用范围</h5><p>覆盖县、乡、村、网格四级响应主体的预警传达、风险防范、应急响应和处置善后工作。</p><h5>（三）响应分级依据</h5><ul><li><b>红色级：</b>区域发生地质灾害风险极高。</li><li><b>橙色级：</b>区域发生地质灾害风险高。</li><li><b>黄色级：</b>区域发生地质灾害风险较高。</li><li><b>蓝色级：</b>区域发生地质灾害风险一般。</li></ul><h4>三、各级响应人员构成及核心职责</h4><p>县级、乡镇级、村级和网格级响应人员按职责协同处置，实时上报风险变化并完成闭环。</p><h4>四、保障措施</h4><p>落实信息报送、物资与队伍、培训演练和责任追究保障。</p><div class="consultation-doc-meta"><span>编制单位：自然资源与气象部门联合编制</span><span>本地演示版 · 未提交测试环境</span></div></div></section><section class="consultation-conclusion"><div class="consultation-pane-title"><strong>⌁ 会商结论与响应等级确认</strong></div><div class="consultation-table-wrap"><table class="consultation-table"><thead><tr><th>乡镇</th><th>当前等级</th><th>地象建议</th><th>最终确认</th></tr></thead><tbody>${rows}</tbody></table></div><div class="consultation-town-actions"><button type="button" data-consultation-town-picker>＋ 选择乡镇</button>${townPicker}</div><button class="consultation-preview" type="button" data-consultation-preview>▣ 预览方案</button></section></div>
    <footer class="consultation-footer"><button class="consultation-close" type="button" data-consultation-close>关闭会议</button><button class="consultation-confirm" type="button" data-consultation-confirm>确认</button></footer>
  </section></div>`;
}

function renderTaskTrack() {
  const stats = [["待派发", 0], ["待核查", 0], ["已关闭", 0], ["已反馈", 0], ["技术协查中", 0], ["每日评价", 0], ["群众报灾", 0], ["防御响应", 0], ["手动新增", 0], ["监测预警", 0]];
  return `
    ${heading("DISPATCH / CLOSURE", "事件闭环", "用事件编号、风险等级、处置环节和责任人追踪任务闭环。", `<div class="periods">${["今日", "近7天", "近30天", "全部"].map((x) => `<button class="period-btn ${state.period === x ? "active" : ""}" data-period="${x}">${x}</button>`).join("")}</div><button class="primary-btn">＋ 新增</button>`)}
    <div class="task-stats">${stats.map(([label, value]) => `<div class="mini-stat"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>
    <section class="card table-card"><div class="section-head"><h3>事件列表</h3><span>统计说明：按任务状态更新时间统计</span></div><div class="filters" style="margin-bottom:15px"><button class="filter-btn">事件编号</button><button class="filter-btn">所在斜坡</button><button class="filter-btn">区域：试点区</button><button class="filter-btn">事件来源：请选择</button><button class="filter-btn">事件状态：请选择</button><button class="filter-btn">查询</button><button class="filter-btn">重置</button></div><div class="table-wrap"><table><thead><tr><th>事件编号</th><th>事件来源</th><th>地理位置</th><th>所在斜坡</th><th>当前环节</th><th>风险等级</th><th>事件状态</th><th>当前处置人</th><th>创建时间</th><th>操作</th></tr></thead><tbody><tr><td colspan="10" class="table-empty">暂无数据</td></tr></tbody></table></div><div class="section-head" style="margin:16px 0 0"><span>第 1 页 / 共 1 页 · 共 0 条数据</span><span>10 条 / 页</span></div></section>
    <div class="dashboard-grid" style="margin-top:17px"><section class="card map-card"><div class="map-head"><h3>动态风险评价“一张图”</h3><span>事件地图联动</span></div>${mapMarkup()}</section><section class="card side-card"><div class="section-head"><h3>今日风险概览</h3><span>2026-09-10</span></div><p class="summary-copy">全域 <em>2,042</em> 个斜坡单元；当前有 <em>2</em> 个会商邀请、<em>65</em> 个事件处理中、<em>18</em> 项报灾未处理。</p><div class="risk-list" style="margin-top:16px"><div class="risk-row"><i class="yellow"></i><span>中风险区</span><strong>1</strong></div><div class="risk-row"><i class="blue"></i><span>低风险区</span><strong>2,041</strong></div></div></section></div>`;
}

function bindRoute() {
  document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => sendChat(button.dataset.prompt)));
  document.querySelector("#chat-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChat(document.querySelector("#chat-input").value);
  });
  document.querySelectorAll("[data-risk-filter]").forEach((button) => button.addEventListener("click", () => {
    state.riskFilter = button.dataset.riskFilter;
    renderShell();
  }));
  document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => {
    state.period = button.dataset.period;
    renderShell();
  }));
  document.querySelector("[data-history-toggle]")?.addEventListener("click", () => alert("本地复现：历史响应面板已预留，数据来自 Mock API。"));
  document.querySelectorAll("[data-open-consultation]").forEach((button) => button.addEventListener("click", () => {
    state.consultationOpen = true;
    state.consultationPeopleOpen = false;
    state.consultationTownPickerOpen = false;
    state.consultationExpanded = false;
    state.consultationDocumentExpanded = false;
    state.consultationNotice = "";
    renderShell();
  }));
  document.querySelector("[data-consultation-dismiss]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      state.consultationOpen = false;
      renderShell();
    }
  });
  document.querySelector("[data-consultation-close]")?.addEventListener("click", () => {
    state.consultationOpen = false;
    renderShell();
  });
  document.querySelector("[data-consultation-confirm]")?.addEventListener("click", () => {
    state.consultationOpen = false;
    renderShell();
  });
  document.querySelector("[data-consultation-people]")?.addEventListener("click", () => {
    state.consultationPeopleOpen = !state.consultationPeopleOpen;
    state.consultationTownPickerOpen = false;
    renderShell();
  });
  document.querySelector("[data-consultation-people-cancel]")?.addEventListener("click", () => {
    state.consultationPeopleOpen = false;
    renderShell();
  });
  document.querySelector("[data-consultation-people-confirm]")?.addEventListener("click", () => {
    state.consultationPeopleOpen = false;
    state.consultationNotice = "参会角色已更新，主持人可继续确认响应等级。";
    renderShell();
  });
  document.querySelectorAll("[data-consultation-person]").forEach((input) => input.addEventListener("change", () => {
    const id = input.dataset.consultationPerson;
    if (input.checked && !state.consultationSelectedPeople.includes(id)) state.consultationSelectedPeople.push(id);
    if (!input.checked) state.consultationSelectedPeople = state.consultationSelectedPeople.filter((item) => item !== id);
  }));
  document.querySelectorAll("[data-town-level]").forEach((select) => select.addEventListener("change", () => {
    state.consultationLevels[select.dataset.townLevel] = select.value;
  }));
  document.querySelector("[data-consultation-preview]")?.addEventListener("click", () => {
    state.consultationNotice = "已生成本地预览方案，未向测试环境提交数据。";
    renderShell();
  });
  document.querySelector("[data-consultation-refresh]")?.addEventListener("click", () => {
    state.consultationNotice = "方案内容已刷新（本地演示数据）。";
    renderShell();
  });
  document.querySelector("[data-consultation-call]")?.addEventListener("click", () => {
    state.consultationNotice = "语音通道已连接（本地演示）。";
    renderShell();
  });
  document.querySelector("[data-consultation-maximize]")?.addEventListener("click", () => {
    state.consultationExpanded = !state.consultationExpanded;
    renderShell();
  });
  document.querySelector("[data-consultation-document-expand]")?.addEventListener("click", () => {
    state.consultationDocumentExpanded = !state.consultationDocumentExpanded;
    renderShell();
  });
  document.querySelector("[data-consultation-town-picker]")?.addEventListener("click", () => {
    state.consultationTownPickerOpen = !state.consultationTownPickerOpen;
    state.consultationPeopleOpen = false;
    renderShell();
  });
  document.querySelectorAll("[data-consultation-town]").forEach((button) => button.addEventListener("click", () => {
    state.consultationTownPickerOpen = false;
    state.consultationNotice = `${button.dataset.consultationTown} 已加入本次会商对象。`;
    renderShell();
  }));
  document.querySelectorAll("[data-consultation-remove]").forEach((button) => button.addEventListener("click", () => {
    state.consultationNotice = `${button.dataset.consultationRemove} 已从本地演示方案中标记移除。`;
    renderShell();
  }));
}

async function primeRoute() {
  const status = document.querySelector("#data-status");
  const calls = {
    "/chat-engine": ["/api/system/user/getInfo", "/api/dizai/ai/agent/chatHistory/list?pageNum=1&pageSize=20"],
    "/risk-analysis": ["/api/dizai/riskAssessment/stat", "/api/dizai/riskAssessment/list?orderByColumn=dynamicRiskValue&isAsc=desc"],
    "/defense-response": ["/api/dizai/defRespPlan/tree", "/api/dizai/taskHandle/riskOverview?type=2"],
    "/task-track": ["/api/dizai/taskDistList/stat-status", "/api/dizai/taskProcessChainNode/list/latest-process-node?pageNum=1&pageSize=10"]
  }[state.route];
  const responses = await Promise.all((calls || []).map((path) => api(path)));
  if (status) status.textContent = responses.some(Boolean) ? "本地 Mock API 在线" : "本地可视化模式";
}

function appendBubble(role, text) {
  const stream = document.querySelector("#chat-stream");
  if (!stream) return null;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
  return bubble;
}

async function sendChat(text) {
  const query = String(text || "").trim();
  if (!query || state.route !== "/chat-engine") return;
  state.chatMessages.push({ role: "user", text: query });
  renderShell();
  const input = document.querySelector("#chat-input");
  if (input) input.value = "";
  appendBubble("user", query);
  const pending = appendBubble("assistant", "正在查询本地接口……");
  const response = await api("/api/dizai/ai/agent/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: query }) });
  const answer = response?.data?.answer || "这是本地复现环境的示例回答。接入真实 `/api/dizai/ai/agent/chat` 后，可替换为实际模型输出。";
  if (pending) pending.textContent = answer;
  state.chatMessages.push({ role: "assistant", text: answer });
}

window.addEventListener("popstate", () => {
  state.route = routes[location.pathname] ? location.pathname : "/chat-engine";
  renderShell();
});

renderShell();
