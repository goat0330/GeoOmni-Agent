(function () {
  "use strict";

  var rootId = "geo-smart-prototype";
  var roles = ["专家", "分管乡长", "分管县长", "县自规局领导", "乡自规所所长"];
  var people = [
    { id: "expert-1", role: "专家", group: "专家", name: "专家席位 A", org: "省地质灾害防治中心", title: "地质灾害高级工程师", phone: "已授权", count: 12, online: true },
    { id: "expert-2", role: "专家", group: "专家", name: "专家席位 B", org: "市地质环境监测站", title: "地质灾害防治专家", phone: "已授权", count: 8, online: true },
    { id: "town-1", role: "分管乡长", group: "政府人员", name: "乡镇联络员 A", org: "芭蕉侗族乡人民政府", title: "分管乡长", phone: "已授权", count: 6, online: true },
    { id: "town-2", role: "分管乡长", group: "政府人员", name: "乡镇联络员 B", org: "盛家坝镇人民政府", title: "分管乡长", phone: "已授权", count: 3, online: false },
    { id: "county-1", role: "分管县长", group: "政府人员", name: "县级联络员 A", org: "恩施市人民政府", title: "分管县长", phone: "已授权", count: 14, online: true },
    { id: "county-2", role: "分管县长", group: "政府人员", name: "县级联络员 B", org: "恩施市人民政府", title: "分管县长", phone: "已授权", count: 9, online: false },
    { id: "planning-1", role: "县自规局领导", group: "政府人员", name: "县自规局领导 A", org: "县自然资源和规划局", title: "局领导", phone: "已授权", count: 11, online: true },
    { id: "station-1", role: "乡自规所所长", group: "政府人员", name: "乡自规所所长 A", org: "芭蕉侗族乡自然资源所", title: "所长", phone: "已授权", count: 5, online: true }
  ];
  var towns = [
    { name: "芭蕉侗族乡", current: "Ⅱ级", suggestion: "Ⅱ级", final: "Ⅱ级" },
    { name: "白杨坪镇", current: "暂无", suggestion: "暂无", final: "请选择" },
    { name: "崔家坝镇", current: "暂无", suggestion: "暂无", final: "请选择" },
    { name: "板桥镇", current: "暂无", suggestion: "暂无", final: "请选择" },
    { name: "新塘乡", current: "暂无", suggestion: "暂无", final: "请选择" },
    { name: "七里坪街道", current: "暂无", suggestion: "暂无", final: "请选择" },
    { name: "屯堡乡", current: "暂无", suggestion: "暂无", final: "请选择" }
  ];
  var levelOptions = ["请选择", "Ⅰ级", "Ⅱ级", "Ⅲ级", "Ⅳ级"];
  var initialSummary = "本次会商围绕恩施市地质灾害气象风险预警展开。综合区域风险评价、气象预警信息和当前防御响应情况，芭蕉侗族乡建议维持Ⅱ级响应，其他乡镇继续保持监测并根据现场核查结果动态调整。";
  var state = {
    open: false,
    view: "directory",
    returnToMeeting: false,
    role: "专家",
    query: "",
    selected: ["expert-1", "county-1", "planning-1"],
    topic: "恩施市地质灾害气象风险预警研判",
    joinOpen: false,
    meetingJoined: false,
    minutesOpen: false,
    minutesEditing: false,
    sendOpen: false,
    recipientGroup: "政府人员",
    selectedRecipients: ["county-1", "planning-1"],
    draft: initialSummary,
    sendMessage: "请查收本次风险研判智能纪要，并按责任事项组织现场核查和防御响应。",
    planExpanded: false,
    notice: "",
    sent: false
  };
  var root;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function timeText() {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }

  function selectedPeople() {
    return people.filter(function (person) { return state.selected.includes(person.id); });
  }

  function selectedRecipients() {
    return people.filter(function (person) { return state.selectedRecipients.includes(person.id); });
  }

  function visiblePeople() {
    var query = state.query.trim().toLowerCase();
    return people.filter(function (person) {
      var matchesRole = person.role === state.role;
      var matchesQuery = !query || [person.name, person.org, person.title].join(" ").toLowerCase().includes(query);
      return matchesRole && matchesQuery;
    });
  }

  function visibleRecipients() {
    return people.filter(function (person) { return person.group === state.recipientGroup; });
  }

  function icon(name) {
    return '<i class="iconfont ' + name + '"></i>';
  }

  function renderSignal() {
    return '<span class="geo-prototype-signal"><b></b><b></b><b></b><b></b></span>';
  }

  function renderNotice() {
    return state.notice ? '<div class="geo-prototype-inline-status">' + escapeHtml(state.notice) + "</div>" : "";
  }

  function renderDirectory() {
    var list = visiblePeople();
    var chosen = selectedPeople();
    var rows = list.length ? list.map(function (person) {
      var isSelected = state.selected.includes(person.id);
      return '<tr class="' + (isSelected ? "is-selected" : "") + '">' +
        '<td><div class="geo-prototype-person-name"><span class="geo-prototype-status-dot ' + (person.online ? "is-online" : "") + '"></span><strong>' + escapeHtml(person.name) + '</strong></div><small>' + (person.online ? "在线" : "离线") + "</small></td>" +
        "<td>" + escapeHtml(person.org) + "</td>" +
        "<td>" + escapeHtml(person.title) + "</td>" +
        "<td>" + escapeHtml(person.phone) + "</td>" +
        "<td>" + escapeHtml(person.count) + "</td>" +
        '<td><button class="geo-prototype-row-action ' + (isSelected ? "is-selected" : "") + '" type="button" data-gp-action="toggle-person" data-id="' + person.id + '">' + (isSelected ? "已选择" : "选择") + "</button></td>" +
        "</tr>";
    }).join("") : '<tr><td colspan="6" class="geo-prototype-empty">当前角色暂无匹配人员</td></tr>';
    var selectedMarkup = chosen.length ? chosen.map(function (person) {
      return '<div class="geo-prototype-selected-person"><div><span class="geo-prototype-status-dot ' + (person.online ? "is-online" : "") + '"></span><strong>' + escapeHtml(person.name) + '</strong><small>' + escapeHtml(person.role) + " · " + escapeHtml(person.org) + '</small></div><button type="button" title="移除人员" data-gp-action="remove-person" data-id="' + person.id + '">×</button></div>';
    }).join("") : '<div class="geo-prototype-empty-box">尚未选择会商人员<br><small>请从左侧人员库添加专家或政府人员</small></div>';
    return '<section class="geo-prototype-modal geo-prototype-directory-modal" role="dialog" aria-modal="true" aria-label="智能会商人员库">' +
      '<header class="geo-prototype-header"><div class="geo-prototype-title"><i></i><strong>智能会商</strong><time>' + timeText() + "</time>" + renderSignal() + '</div><div class="geo-prototype-header-actions"><span>测试环境 · 权限已加载</span><button type="button" class="geo-prototype-icon-button" data-gp-action="close" title="关闭">×</button></div></header>' +
      '<div class="geo-prototype-notice"><span>!</span>选择专家或政府侧人员后发起会商，在线人员将优先进入呼叫队列；本地原型不会拨打真实电话。</div>' +
      renderNotice() +
      '<div class="geo-prototype-directory-body">' +
        '<section class="geo-prototype-directory-main"><div class="geo-prototype-pane-title"><strong>' + icon("icon-expert", "♙") + " 人员库</strong><span>已复用现有角色库结构</span></div>" +
          '<div class="geo-prototype-role-tabs">' + roles.map(function (role) { return '<button type="button" class="' + (state.role === role ? "is-active" : "") + '" data-gp-action="role" data-role="' + role + '">' + escapeHtml(role) + "库</button>"; }).join("") + "</div>" +
          '<div class="geo-prototype-search-row"><label class="geo-prototype-search"><span>⌕</span><input type="search" data-gp-search placeholder="' + escapeHtml(state.role) + '姓名/单位" value="' + escapeHtml(state.query) + '"></label><button type="button" class="geo-prototype-search-button" data-gp-action="search">搜索</button><span class="geo-prototype-count">' + escapeHtml(state.role) + "总数： " + people.filter(function (person) { return person.role === state.role; }).length + "名</span></div>" +
          '<div class="geo-prototype-table-wrap"><table class="geo-prototype-table"><thead><tr><th>姓名</th><th>单位</th><th>职务职称</th><th>电话</th><th>历史会商次数</th><th>操作</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        "</section>" +
        '<aside class="geo-prototype-selection-pane"><div class="geo-prototype-pane-title"><strong>选择会商人员</strong><span>' + chosen.length + " 人</span></div>" +
          '<div class="geo-prototype-selected-list">' + selectedMarkup + "</div>" +
          '<div class="geo-prototype-field"><label>会商主题</label><input type="text" data-gp-topic value="' + escapeHtml(state.topic) + '"></div>' +
          '<div class="geo-prototype-selection-tip"><span>●</span><div><strong>在线优先</strong><p>在线人员可直接进入本地会商演示；离线人员保留在邀请名单中。</p></div></div>' +
        "</aside>" +
      "</div>" +
      '<footer class="geo-prototype-footer"><button type="button" class="geo-prototype-text-button" data-gp-action="reset">重置名单</button><div><button type="button" class="geo-prototype-cancel-button" data-gp-action="close">取消</button><button type="button" class="geo-prototype-primary-button" data-gp-action="enter-meeting">' + (state.returnToMeeting ? "返回会商室" : "进入会商室") + "</button></div></footer>" +
      "</section>";
  }

  function renderPlan() {
    return '<section class="geo-prototype-plan-pane ' + (state.planExpanded ? "is-expanded" : "") + '"><div class="geo-prototype-pane-title"><strong>' + icon("icon-wendang", "▤") + ' 防御响应方案（协同编辑中）</strong><div><button type=\"button\" title=\"刷新方案\" data-gp-action=\"refresh-plan\">⟳</button><button type=\"button\" title=\"展开方案\" data-gp-action=\"toggle-plan\">↗</button></div></div><div class="geo-prototype-plan-scroll"><h2>气象预警类区域防御响应方案</h2><h3>一、基本信息</h3><ul><li><b>恩施市整体：</b>处于Ⅱ级</li><li><b>局部区域：</b>芭蕉侗族乡处于Ⅱ级</li><li><b>启动时间：</b>2026-09-10 11:51:16</li><li><b>启动条件：</b>经过专家组会商确认</li></ul><h3>二、总则</h3><h4>（一）编制目的</h4><p>为规范恩施市芭蕉侗族乡气象预警类防御响应工作，建立“县级统筹联动、乡镇快速响应、村级精准落实、网格实时巡查”四级防御体系，明确各级职责与操作流程。</p><h4>（二）适用范围</h4><p>本方案适用于预警传达、风险防范、应急响应、处置善后和会商意见留痕等工作，覆盖县、乡、村、网格四级响应主体。</p><h3>三、响应分级依据</h3><ul><li><b>Ⅰ级：</b>区域风险极高，立即组织转移避险。</li><li><b>Ⅱ级：</b>区域风险较高，强化巡查并落实重点人员防护。</li><li><b>Ⅲ级：</b>持续监测风险变化，做好预警传达。</li></ul><div class="geo-prototype-plan-meta"><span>编制单位：自然资源与气象部门联合编制</span><span>本地原型 · 未提交测试环境</span></div></div></section>';
  }

  function renderTownRows() {
    return towns.map(function (town) {
      return '<tr><td><span class="geo-prototype-town-name">' + escapeHtml(town.name) + '</span><button type="button" class="geo-prototype-town-remove" title="从方案中移除">−</button></td><td>' + town.current + "</td><td>" + town.suggestion + '</td><td><select data-gp-level="' + town.name + '" aria-label="' + town.name + '最终确认等级">' + levelOptions.map(function (option) { return '<option ' + (town.final === option ? "selected" : "") + ">" + option + "</option>"; }).join("") + "</select></td></tr>";
    }).join("");
  }

  function renderConclusion() {
    return '<section class="geo-prototype-conclusion-pane"><div class="geo-prototype-pane-title"><strong>⌁ 会商结论与响应等级确认</strong><span>主持人确认</span></div><div class="geo-prototype-table-wrap geo-prototype-town-table-wrap"><table class="geo-prototype-table geo-prototype-town-table"><thead><tr><th>乡镇</th><th>当前等级</th><th>地象建议</th><th>最终确认</th></tr></thead><tbody>' + renderTownRows() + "</tbody></table></div><button type=\"button\" class=\"geo-prototype-preview-button\" data-gp-action=\"preview-plan\">▣ 预览方案</button></section>";
  }

  function renderMinutesPanel() {
    var sendStatus = state.sent ? '<span class="geo-prototype-sent-badge">已发送</span>' : "";
    var editor = state.minutesEditing ? '<div class="geo-prototype-minutes-editor"><label>修订事件总结</label><textarea data-gp-minutes-draft rows="7">' + escapeHtml(state.draft) + '</textarea><div><button type="button" class="geo-prototype-cancel-button" data-gp-action="cancel-edit-minutes">取消</button><button type="button" class="geo-prototype-primary-button" data-gp-action="save-minutes">保存修订</button></div></div>' : '<p>' + escapeHtml(state.draft) + "</p>";
    return '<aside class="geo-prototype-minutes-panel" role="dialog" aria-label="智能纪要"><header><div><strong>' + icon("icon-wendang", "▤") + ' 智能纪要</strong><span>会商内容沉淀</span></div><button type="button" class="geo-prototype-icon-button" data-gp-action="close-minutes" title="关闭智能纪要">×</button></header>' +
      '<div class="geo-prototype-minutes-scroll"><div class="geo-prototype-minutes-hero"><div><span>风险研判事件总结</span><strong>已生成分析摘要</strong></div><b>✓</b></div><div class="geo-prototype-minutes-meta">11:53 内容由 AI 生成 · 仅供审核确认</div>' +
      '<section class="geo-prototype-minutes-card"><h4>会议概览</h4><p>会议主题：' + escapeHtml(state.topic) + '<br>参会人员：' + selectedPeople().length + ' 人<br>响应区域：恩施市 · 芭蕉侗族乡</p></section>' +
      '<section class="geo-prototype-minutes-card geo-prototype-minutes-summary"><h4>风险研判总结</h4>' + editor + '</section>' +
      '<section class="geo-prototype-minutes-card"><h4>处置建议</h4><ul><li>维持芭蕉侗族乡Ⅱ级响应，持续关注降雨和斜坡变形。</li><li>由乡镇侧完成重点点位巡查，并在现场核查后回传结果。</li><li>如监测数据出现连续升高，由主持人组织再次会商。</li></ul></section>' +
      '<section class="geo-prototype-minutes-card"><h4>责任事项</h4><div class="geo-prototype-responsibility-row"><span>现场核查</span><b>乡镇联络员 A</b><em>待确认</em></div><div class="geo-prototype-responsibility-row"><span>技术复核</span><b>专家席位 A</b><em>待确认</em></div></section></div>' +
      '<footer><button type="button" class="geo-prototype-text-button" data-gp-action="edit-minutes">编辑纪要</button><button type="button" class="geo-prototype-primary-button" data-gp-action="open-send">发送给责任人</button>' + sendStatus + "</footer></aside>";
  }

  function renderJoinDialog() {
    return '<div class="geo-prototype-secondary-backdrop"><section class="geo-prototype-join-dialog" role="dialog" aria-modal="true" aria-label="加入会议"><header><strong>加入会议</strong><button type="button" class="geo-prototype-icon-button" data-gp-action="close-join">×</button></header><div class="geo-prototype-device-preview"><div class="geo-prototype-camera-placeholder"><span>本地视频预览</span><small>原型模式 · 不调用摄像头</small></div><div class="geo-prototype-preview-label"><span class="geo-prototype-status-dot is-online"></span>演示账号 · 等待加入</div></div><label class="geo-prototype-device-field"><span>麦克风：</span><select><option>默认值 - 麦克风阵列（原型）</option></select></label><label class="geo-prototype-device-field"><span>摄像头：</span><select><option>默认摄像头（原型）</option></select></label><p class="geo-prototype-device-note">设备选择仅用于展示会议入会流程，原型不会申请浏览器设备权限。</p><button type="button" class="geo-prototype-primary-button geo-prototype-join-button" data-gp-action="join">加入会议</button></section></div>';
  }

  function renderSendDialog() {
    var recipients = visibleRecipients();
    var count = state.selectedRecipients.length;
    return '<div class="geo-prototype-secondary-backdrop"><section class="geo-prototype-send-dialog" role="dialog" aria-modal="true" aria-label="发送给责任人"><header><div><strong>发送给责任人</strong><span>选择对应专家或政府侧人员</span></div><button type="button" class="geo-prototype-icon-button" data-gp-action="close-send">×</button></header><div class="geo-prototype-send-body"><div class="geo-prototype-send-context"><span>发送内容</span><strong>风险研判事件总结 · ' + (state.sent ? "已发送" : "待发送") + "</strong><p>发送前可编辑消息，接收人将看到当前已确认的智能纪要。</p></div><div class=\"geo-prototype-recipient-tabs\"><button type=\"button\" class=\"" + (state.recipientGroup === "政府人员" ? "is-active" : "") + "\" data-gp-action=\"recipient-group\" data-group=\"政府人员\">政府人员</button><button type=\"button\" class=\"" + (state.recipientGroup === "专家" ? "is-active" : "") + "\" data-gp-action=\"recipient-group\" data-group=\"专家\">专家</button><span>已选 " + count + " 人</span></div><div class=\"geo-prototype-recipient-list\">" + recipients.map(function (person) { var checked = state.selectedRecipients.includes(person.id); return '<label><input type="checkbox" data-gp-recipient="' + person.id + '" ' + (checked ? "checked" : "") + '><span><b>' + escapeHtml(person.name) + '</b><small>' + escapeHtml(person.role) + " · " + escapeHtml(person.org) + '</small></span><em class="' + (person.online ? "is-online" : "") + '">' + (person.online ? "在线" : "离线") + "</em></label>"; }).join("") + "</div><label class=\"geo-prototype-message-field\"><span>发送说明</span><textarea data-gp-send-message rows=\"3\">" + escapeHtml(state.sendMessage) + "</textarea></label>" + (state.notice && state.notice.indexOf("请选择") === 0 ? '<div class="geo-prototype-form-error">' + escapeHtml(state.notice) + "</div>" : "") + "</div><footer><button type=\"button\" class=\"geo-prototype-cancel-button\" data-gp-action=\"close-send\">取消</button><button type=\"button\" class=\"geo-prototype-primary-button\" data-gp-action=\"send-confirm\" " + (count ? "" : "disabled") + ">确认发送</button></footer></section></div>";
  }

  function renderMeeting() {
    var participants = selectedPeople();
    return '<section class="geo-prototype-modal geo-prototype-meeting-modal ' + (state.minutesOpen ? "has-minutes" : "") + '" role="dialog" aria-modal="true" aria-label="应急会商室">' +
      '<header class="geo-prototype-header"><div class="geo-prototype-title"><i></i><strong>应急会商室</strong><time>' + timeText() + '</time>' + renderSignal() + '</div>' +
      '<div class="geo-prototype-header-actions"><span>会议人员：' + participants.length + ' 人</span><button type="button" class="geo-prototype-icon-button" data-gp-action="open-directory" title="选择参会人员">♙</button><button type="button" class="geo-prototype-phone-button" data-gp-action="open-join" title="加入会议">☎</button><button type="button" class="geo-prototype-icon-button" data-gp-action="toggle-meeting-size" title="切换大小">↗</button><button type="button" class="geo-prototype-icon-button" data-gp-action="close" title="关闭">×</button></div></header>' +
      '<div class="geo-prototype-notice"><span>!</span>专家意见通过语音实时表达。主持人修改风险等级，专家核实后由主持人确认。</div>' + renderNotice() +
      '<div class="geo-prototype-meeting-body">' + renderPlan() + renderConclusion() + "</div>" +
      '<div class="geo-prototype-meeting-tools"><button type="button" class="geo-prototype-minutes-trigger ' + (state.minutesOpen ? "is-active" : "") + '" data-gp-action="open-minutes">' + icon("icon-wendang", "▤") + '<span>智能纪要</span><small>' + (state.sent ? "已发送" : "查看风险研判总结") + '</small></button><span class="geo-prototype-meeting-status"><i></i>' + (state.meetingJoined ? "演示账号已入会" : "等待入会") + '</span></div>' +
      '<footer class="geo-prototype-footer"><button type="button" class="geo-prototype-cancel-button" data-gp-action="close">关闭会议</button><button type="button" class="geo-prototype-primary-button" data-gp-action="confirm-meeting">确认</button></footer>' +
      (state.minutesOpen ? renderMinutesPanel() : "") + (state.joinOpen ? renderJoinDialog() : "") + (state.sendOpen ? renderSendDialog() : "") + "</section>";
  }

  function renderRoot() {
    if (!root) return;
    root.hidden = !state.open;
    root.innerHTML = state.open ? '<div class="geo-prototype-backdrop" data-gp-backdrop>' + (state.view === "directory" ? renderDirectory() : renderMeeting()) + "</div>" : "";
  }

  function ensureRoot() {
    root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement("div");
      root.id = rootId;
      root.hidden = true;
      document.body.appendChild(root);
    }
  }

  function openDirectory(fromMeeting) {
    state.open = true;
    state.view = "directory";
    state.returnToMeeting = Boolean(fromMeeting);
    state.joinOpen = false;
    state.minutesOpen = false;
    state.sendOpen = false;
    state.minutesEditing = false;
    state.notice = "";
    renderRoot();
  }

  function openMeeting() {
    if (!state.selected.length) {
      state.notice = "请选择至少 1 位专家或政府侧人员后再进入会商室。";
      renderRoot();
      return;
    }
    state.open = true;
    state.view = "meeting";
    state.returnToMeeting = false;
    state.notice = "";
    renderRoot();
  }

  function closeAll() {
    state.open = false;
    state.joinOpen = false;
    state.minutesOpen = false;
    state.sendOpen = false;
    state.minutesEditing = false;
    renderRoot();
  }

  function syncEntry() {
    var host = document.querySelector("#chat-left-btn");
    var onDefense = location.pathname === "/defense-response";
    if (!onDefense) {
      document.querySelectorAll("[data-geo-smart-consultation]").forEach(function (button) { button.remove(); });
      document.querySelectorAll("[data-geo-original-display]").forEach(function (element) {
        element.style.display = element.dataset.geoOriginalDisplay;
        delete element.dataset.geoOriginalDisplay;
      });
      if (state.open) closeAll();
      return;
    }
    if (!host) return;
    var direct = host.querySelector(".direct-start-btn");
    if (direct && !direct.dataset.geoOriginalDisplay) {
      direct.dataset.geoOriginalDisplay = direct.style.display || "";
      direct.style.display = "none";
    }
    host.querySelectorAll(".text-btn").forEach(function (element) {
      if (!element.hasAttribute("data-geo-smart-consultation") && element.textContent.includes("AI会商室") && !element.dataset.geoOriginalDisplay) {
        element.dataset.geoOriginalDisplay = element.style.display || "";
        element.style.display = "none";
      }
    });
    if (host.querySelector("[data-geo-smart-consultation]")) return;
    var button = document.createElement("div");
    button.className = "text-btn smart-consultation-btn";
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    button.setAttribute("data-geo-smart-consultation", "true");
    button.title = "打开智能会商";
    button.innerHTML = icon("icon-expert", "♙") + "<span>智能会商</span>";
    host.appendChild(button);
  }

  function closestElement(event) {
    var target = event.target;
    return target && target.nodeType === 1 ? target : target && target.parentElement;
  }

  function handleClick(event) {
    var element = closestElement(event);
    if (!element) return;
    var trigger = element.closest("[data-geo-smart-consultation]");
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      openDirectory(false);
      return;
    }
    if (!root || !state.open) return;
    if (element.matches("[data-gp-backdrop]") && event.target === element) {
      closeAll();
      return;
    }
    var actionElement = element.closest("[data-gp-action]");
    if (!actionElement || !root.contains(actionElement)) return;
    event.preventDefault();
    event.stopPropagation();
    var action = actionElement.dataset.gpAction;
    var id = actionElement.dataset.id;
    if (action === "close") closeAll();
    if (action === "role") { state.role = actionElement.dataset.role; state.query = ""; renderRoot(); }
    if (action === "search") { state.query = root.querySelector("[data-gp-search]")?.value || ""; renderRoot(); }
    if (action === "toggle-person") {
      state.selected = state.selected.includes(id) ? state.selected.filter(function (item) { return item !== id; }) : state.selected.concat(id);
      renderRoot();
    }
    if (action === "remove-person") { state.selected = state.selected.filter(function (item) { return item !== id; }); renderRoot(); }
    if (action === "reset") { state.selected = ["expert-1", "county-1", "planning-1"]; state.notice = "已恢复本地原型推荐名单。"; renderRoot(); }
    if (action === "enter-meeting") openMeeting();
    if (action === "open-directory") openDirectory(true);
    if (action === "open-join") { state.joinOpen = true; renderRoot(); }
    if (action === "close-join") { state.joinOpen = false; renderRoot(); }
    if (action === "join") { state.meetingJoined = true; state.joinOpen = false; state.notice = "已以演示账号加入本地会商原型，未调用摄像头或麦克风。"; renderRoot(); }
    if (action === "open-minutes") { state.minutesOpen = true; state.sendOpen = false; renderRoot(); }
    if (action === "close-minutes") { state.minutesOpen = false; state.minutesEditing = false; renderRoot(); }
    if (action === "edit-minutes") { state.minutesEditing = true; renderRoot(); }
    if (action === "cancel-edit-minutes") { state.minutesEditing = false; renderRoot(); }
    if (action === "save-minutes") { state.minutesEditing = false; state.notice = "智能纪要修订已保存，等待主持人确认。"; renderRoot(); }
    if (action === "open-send") { state.sendOpen = true; state.notice = ""; renderRoot(); }
    if (action === "close-send") { state.sendOpen = false; renderRoot(); }
    if (action === "recipient-group") { state.recipientGroup = actionElement.dataset.group; renderRoot(); }
    if (action === "recipient") {
      state.selectedRecipients = state.selectedRecipients.includes(id) ? state.selectedRecipients.filter(function (item) { return item !== id; }) : state.selectedRecipients.concat(id);
      renderRoot();
    }
    if (action === "send-confirm") {
      if (!state.selectedRecipients.length) { state.notice = "请选择至少 1 位接收人。"; renderRoot(); return; }
      state.sendOpen = false;
      state.sent = true;
      state.notice = "已发送给 " + state.selectedRecipients.length + " 位责任人/专家，等待确认。";
      renderRoot();
    }
    if (action === "preview-plan") { state.notice = "已生成本地预览方案，未向测试环境提交数据。"; renderRoot(); }
    if (action === "refresh-plan") { state.notice = "防御响应方案已刷新（本地原型数据）。"; renderRoot(); }
    if (action === "toggle-plan") { state.planExpanded = !state.planExpanded; renderRoot(); }
    if (action === "confirm-meeting") { state.notice = "会商结论已在本地原型中确认，智能纪要可继续发送。"; renderRoot(); }
    if (action === "toggle-meeting-size") { actionElement.closest(".geo-prototype-meeting-modal").classList.toggle("is-expanded"); }
  }

  function handleInput(event) {
    var element = closestElement(event);
    if (!element) return;
    if (element.matches("[data-gp-search]")) state.query = element.value;
    if (element.matches("[data-gp-topic]")) state.topic = element.value;
    if (element.matches("[data-gp-minutes-draft]")) state.draft = element.value;
    if (element.matches("[data-gp-send-message]")) state.sendMessage = element.value;
  }

  function handleChange(event) {
    var element = closestElement(event);
    if (!element) return;
    if (element.matches("[data-gp-level]")) {
      var town = towns.find(function (item) { return item.name === element.dataset.gpLevel; });
      if (town) { town.final = element.value; state.notice = town.name + "最终确认等级已更新。"; renderRoot(); }
    }
    if (element.matches("[data-gp-recipient]")) {
      var id = element.dataset.gpRecipient;
      state.selectedRecipients = element.checked ? state.selectedRecipients.concat(state.selectedRecipients.includes(id) ? [] : [id]) : state.selectedRecipients.filter(function (item) { return item !== id; });
      renderRoot();
    }
  }

  function handleKeydown(event) {
    var element = closestElement(event);
    if (element && element.matches("[data-geo-smart-consultation]") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openDirectory(false);
    }
    if (event.key === "Escape" && state.open) closeAll();
  }

  function boot() {
    ensureRoot();
    syncEntry();
    renderRoot();
    document.addEventListener("click", handleClick, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleChange, true);
    document.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("popstate", syncEntry);
    var observer = new MutationObserver(function () { syncEntry(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}());
