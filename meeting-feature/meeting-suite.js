(() => {
  "use strict";

  const FEATURE_VERSION = "meeting-suite-v2";
  const ROOT_ID = "geo-meeting-suite-root";
  const HISTORY_ROOT_ID = "geo-meeting-history-root";
  const TOPIC_CLASS = "geo-meeting-topic-extension";
  const EXPERT_LAYOUT_CLASS = "geo-meeting-expert-layout";
  const MEETING_HOME_CLASS = "geo-meeting-home";
  const PANEL_GAP_PX = 4;
  const SUBJECT_KEY = "geo.meeting.subject.v2";
  const LEGACY_SUBJECT_KEY = "geo.meeting.subject.v1";
  const RISK_TOPIC_KEY = "geo.meeting.riskTopic.v2";
  const CONTEXT_KEY = "geo.meeting.context.v2";
  const LEGACY_CONTEXT_KEY = "geo.meeting.context.v1";
  const HISTORY_KEY = "geo.meeting.history.v2";
  const LEGACY_HISTORY_KEY = "geo.meeting.history.v1";

  const recommendations = [
    "维持芭蕉侗族乡现有响应措施，持续关注高风险区域变化。",
    "组织责任人开展现场核查，及时补充设备状态和现场反馈记录。",
    "其他乡镇保持监测，根据现场核查结果动态调整响应等级。"
  ];
  const responsibilities = [
    "请责任人反馈现场核查、设备状态和风险变化，形成闭环记录。"
  ];

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
    catch { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* best effort */ }
  }
  function readMigratedString(primary, legacy) {
    const value = localStorage.getItem(primary) || localStorage.getItem(legacy) || "";
    return value === "未命名会商" ? "" : value;
  }
  function readMigratedJson(primary, legacy, fallback) {
    return readJson(primary, readJson(legacy, fallback));
  }
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function textOf(node) { return node?.textContent?.replace(/\s+/g, " ").trim() || ""; }
  function visible(node) {
    if (!node || !node.isConnected) return false;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }
  function formatTime(value) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  const state = {
    subject: readMigratedString(SUBJECT_KEY, LEGACY_SUBJECT_KEY),
    riskTopic: readMigratedString(RISK_TOPIC_KEY, ""),
    context: readMigratedJson(CONTEXT_KEY, LEGACY_CONTEXT_KEY, null),
    minutes: null,
    phase: "idle", // idle | join | room
    sidebarOpen: false,
    sidebarMode: "pre", // pre | live
    editing: false,
    notice: "",
    sentInfo: null,
    sendOpen: false,
    sendRecipients: [],
    sendSelected: new Set(),
    sourceSurface: null,
    sourceDialog: null,
    mediaStream: null,
    mediaError: "",
    devices: { microphones: [], cameras: [] },
    selectedMicId: "",
    selectedCameraId: "",
    micEnabled: true,
    videoEnabled: true,
    startedAtMs: 0,
    timerId: 0,
    historyRecords: [],
    historySelectedId: "",
    historyQuery: "",
    contextEditorOpen: false,
    contextDraft: null,
    meetingHomeOpen: false,
    meetingHomeHistoryOpen: false,
    meetingHomeLoading: false,
    currentMeeting: null,
    allowNativeDirectLaunch: false
  };

  function deriveDefaultSubject() {
    const bodyText = document.body?.innerText || "";
    const candidates = ["气象预警类区域防御响应方案", "区域防御响应方案"];
    const plan = candidates.find(item => bodyText.includes(item));
    return plan ? plan.replace(/方案$/, "会商") : "地质灾害风险研判会商";
  }
  function currentSubject() {
    const value = (state.subject || localStorage.getItem(SUBJECT_KEY) || deriveDefaultSubject()).trim();
    return value === "未命名会商" ? deriveDefaultSubject() : value;
  }
  function currentRiskTopic() {
    const value = (state.riskTopic || state.context?.riskTopic || "").trim();
    return value || currentSubject();
  }
  function persistSubject(value) {
    state.subject = value.trim();
    try { localStorage.setItem(SUBJECT_KEY, state.subject); } catch { /* best effort */ }
  }
  function persistRiskTopic(value) {
    state.riskTopic = value.trim();
    try { localStorage.setItem(RISK_TOPIC_KEY, state.riskTopic); } catch { /* best effort */ }
  }
  function contextDefaults() {
    const context = state.context || {};
    return {
      subject: currentSubject(),
      riskTopic: currentRiskTopic(),
      region: context.region || "恩施市 · 芭蕉侗族乡",
      responseLevel: context.responseLevel || "Ⅱ级响应"
    };
  }
  function ensureMinutes() {
    const subject = currentSubject();
    if (!state.minutes || state.minutes.subject !== subject) {
      state.minutes = {
        subject,
        summary: `本次会商围绕“${subject}”展开。综合区域风险评价、气象预警信息和当前防御响应情况，重点研判芭蕉侗族乡风险变化及响应措施。`,
        recommendations: [...recommendations],
        responsibilities: [...responsibilities]
      };
    }
    return state.minutes;
  }

  function root() {
    let node = document.getElementById(ROOT_ID);
    if (!node) {
      node = document.createElement("div");
      node.id = ROOT_ID;
      node.className = "geo-ui";
      document.body.appendChild(node);
    }
    return node;
  }

  function findExpertDialog() {
    const candidateButtons = [...document.querySelectorAll("button")].filter(button => {
      const label = textOf(button);
      return visible(button) && (label === "进入会商室" || label === "确认邀请");
    });
    for (const button of candidateButtons) {
      let node = button.closest(".el-dialog, [role='dialog'], .el-overlay-dialog") || button.parentElement;
      for (let depth = 0; node && node !== document.body && depth < 12; depth += 1, node = node.parentElement) {
        const text = textOf(node);
        if (text.includes("专家库") && text.includes("选择专家列表")) return node;
      }
    }
    return null;
  }

  function findExpertModalFrame(dialog) {
    const outerModal = dialog?.closest(".person-list");
    if (visible(outerModal) && textOf(outerModal).includes("专家库") && textOf(outerModal).includes("选择专家列表")) return outerModal;
    let node = dialog;
    for (let depth = 0; node && node !== document.body && depth < 10; depth += 1, node = node.parentElement) {
      if (!visible(node)) continue;
      const rect = node.getBoundingClientRect();
      const fillsViewport = rect.width >= window.innerWidth * 0.96 && rect.height >= window.innerHeight * 0.96;
      if (!fillsViewport && textOf(node).includes("专家库") && textOf(node).includes("选择专家列表")) return node;
    }
    return dialog;
  }

  function findTabsAnchor(dialog) {
    const selectors = "button,[role='tab'],.el-tabs__item,.el-radio-button,.el-button,.tab-item";
    const expertTab = [...(dialog?.querySelectorAll(selectors) || [])].find(node => textOf(node) === "专家库");
    if (expertTab) return expertTab.parentElement || expertTab;
    const globalExpertTab = [...document.querySelectorAll(selectors)].find(node => visible(node) && textOf(node) === "专家库");
    return globalExpertTab?.parentElement || dialog?.firstElementChild || null;
  }

  function alignPreMeetingMinutes() {
    if (state.phase !== "idle" || !state.sidebarOpen) return;
    const sidebar = document.querySelector(".geo-meeting-minutes-sidebar--pre");
    const dialog = findExpertDialog();
    if (!sidebar || !dialog) return;
    const rect = findExpertModalFrame(dialog).getBoundingClientRect();
    const viewportPadding = PANEL_GAP_PX;
    const preferredWidth = Math.min(380, Math.max(260, window.innerWidth - viewportPadding * 2));
    const rightSpace = window.innerWidth - rect.right - PANEL_GAP_PX - viewportPadding;
    const leftSpace = rect.left - PANEL_GAP_PX - viewportPadding;
    let width = Math.min(380, Math.max(0, rightSpace));
    let left = rect.right + PANEL_GAP_PX;
    if (width < 260 && leftSpace >= 260) {
      width = Math.min(380, leftSpace);
      left = rect.left - PANEL_GAP_PX - width;
    } else if (width < 260) {
      width = preferredWidth;
      left = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    }
    const top = Math.max(viewportPadding, rect.top);
    const height = Math.max(0, Math.min(rect.height, window.innerHeight - top - viewportPadding));
    sidebar.style.top = `${top}px`;
    sidebar.style.left = `${left}px`;
    sidebar.style.right = "auto";
    sidebar.style.bottom = "auto";
    sidebar.style.width = `${width}px`;
    sidebar.style.height = `${height}px`;
  }

  function nativeConfirmButton(dialog) {
    return [...(dialog?.querySelectorAll("button") || [])].find(button => {
      const label = textOf(button);
      return label === "进入会商室" || label === "确认邀请";
    }) || null;
  }

  function topicMarkup(subject) {
    return `
      <section class="${TOPIC_CLASS}" data-geo-meeting-topic="${FEATURE_VERSION}">
        <label class="geo-meeting-topic-label" for="geo-meeting-subject-input"><span aria-hidden="true">*</span> 会商主题</label>
        <div class="geo-meeting-topic-control">
          <input id="geo-meeting-subject-input" class="geo-meeting-topic-input geo-ui-input" maxlength="80" value="${escapeHtml(subject)}" placeholder="请输入本次会商主题" autocomplete="off" />
          <div class="geo-meeting-topic-error" role="alert">请输入会商主题后再确认邀请</div>
        </div>
        <button type="button" class="geo-ui-button geo-ui-button--sm geo-meeting-minutes-link" data-meeting-action="toggle-pre-minutes">智能纪要</button>
        <button type="button" class="geo-ui-button geo-ui-button--sm geo-meeting-context-link" data-meeting-action="edit-context">编辑信息</button>
      </section>`;
  }

  function normalizeExpertDialog(dialog) {
    const confirm = nativeConfirmButton(dialog);
    if (confirm && textOf(confirm) !== "确认邀请") {
      confirm.textContent = "确认邀请";
      confirm.dataset.geoMeetingConfirm = "1";
    } else if (confirm) {
      confirm.dataset.geoMeetingConfirm = "1";
    }
    [...dialog.querySelectorAll("button")].forEach(button => {
      if (textOf(button) === "结束会话") {
        button.textContent = "取消";
        button.dataset.geoMeetingCancel = "1";
      }
    });
  }

  function injectMeetingTopic() {
    const dialog = findExpertDialog();
    if (!dialog) return;
    normalizeExpertDialog(dialog);
    const cardList = dialog.querySelector(".foot-box > .card-list") || dialog.querySelector(".card-list");
    const footBox = cardList?.parentElement?.matches(".foot-box") ? cardList.parentElement : null;
    const existingTopic = dialog.querySelector(`[data-geo-meeting-topic="${FEATURE_VERSION}"]`);
    if (existingTopic) {
      if (footBox) {
        footBox.classList.add(EXPERT_LAYOUT_CLASS);
        if (existingTopic.parentElement !== footBox) footBox.insertBefore(existingTopic, cardList);
      }
      return;
    }
    dialog.querySelector('[data-geo-meeting-topic="meeting-suite-v1"]')?.remove();
    const anchor = findTabsAnchor(dialog);
    if (!anchor) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = topicMarkup(currentSubject());
    const topic = wrapper.firstElementChild;
    if (footBox) {
      footBox.classList.add(EXPERT_LAYOUT_CLASS);
      footBox.insertBefore(topic, cardList);
    } else {
      anchor.parentElement?.insertBefore(topic, anchor);
    }
    const input = topic.querySelector("#geo-meeting-subject-input");
    input?.addEventListener("input", () => {
      persistSubject(input.value);
      input.classList.remove("is-invalid");
      topic.querySelector(".geo-meeting-topic-error")?.classList.remove("is-visible");
      if (state.sidebarOpen && state.phase === "idle") render();
    });
  }

  function resolveSourceSurface(dialog) {
    return dialog?.closest(".el-overlay") || dialog?.closest(".el-overlay-dialog") || dialog || null;
  }
  function hideSourceDialog(dialog) {
    state.sourceDialog = dialog || state.sourceDialog;
    state.sourceSurface = resolveSourceSurface(state.sourceDialog);
    state.sourceSurface?.classList.add("geo-meeting-suite-source-hidden");
  }
  function restoreSourceDialog() {
    state.sourceSurface?.classList.remove("geo-meeting-suite-source-hidden");
    state.sourceSurface = null;
    state.sourceDialog = null;
  }

  function closeExpertDialog(dialog) {
    const close = dialog?.querySelector(".el-dialog__headerbtn, .el-dialog__close, [aria-label*='关闭'], [title*='关闭']");
    if (close && !close.matches("[data-geo-meeting-confirm], [data-geo-meeting-cancel]")) {
      close.click();
      return true;
    }
    const overlay = dialog?.closest(".el-overlay, .el-overlay-dialog");
    if (overlay) {
      overlay.style.display = "none";
      return true;
    }
    return false;
  }

  async function fetchJson(url, init) {
    const response = await originalFetch(url, init);
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    return payload;
  }

  async function hydrateParticipants() {
    let meetingId = state.context?.meetingId || "";
    try {
      const idPayload = await fetchJson("/api/dizai/meeting/getMeetingId/local-region-response");
      meetingId = String(idPayload?.data || meetingId || "");
    } catch { /* keep local */ }
    try {
      const lookupId = meetingId || "local-meeting";
      const info = await fetchJson(`/api/dizai/meeting/getMeetingInfo/${encodeURIComponent(lookupId)}`);
      const data = info?.data || {};
      const participants = Object.keys(data.participantsMap || {});
      state.context = {
        ...(state.context || {}),
        meetingId: meetingId || state.context?.meetingId || "",
        participants,
        participantNames: Array.isArray(data.participantNames) ? data.participantNames : (state.context?.participantNames || []),
        handleId: data.handleId || state.context?.handleId || "local-region-response",
        region: data.region || state.context?.region || "恩施市 · 芭蕉侗族乡",
        responseLevel: data.responseLevel || state.context?.responseLevel || "Ⅱ级响应",
        startedAt: data.startedAt || state.context?.startedAt || null
      };
      writeJson(CONTEXT_KEY, state.context);
    } catch { /* keep local */ }
  }

  async function ensureServerMeeting() {
    let meetingId = state.context?.meetingId || "";
    if (!meetingId) {
      try {
        const payload = await fetchJson("/api/dizai/meeting/getMeetingId/local-region-response");
        meetingId = String(payload?.data || "");
      } catch { /* create below */ }
    }
    if (meetingId) {
      state.context = { ...(state.context || {}), meetingId };
      writeJson(CONTEXT_KEY, state.context);
      await hydrateParticipants();
      return meetingId;
    }
    try {
      const payload = await fetchJson("/api/dizai/meeting/startMeeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: currentSubject(),
          riskTopic: currentRiskTopic(),
          participants: Array.isArray(state.context?.participants) ? state.context.participants : [],
          handleId: state.context?.handleId || "local-region-response",
          region: state.context?.region || "恩施市 · 芭蕉侗族乡",
          responseLevel: state.context?.responseLevel || "Ⅱ级响应",
          host: state.context?.host || "演示账号"
        })
      });
      const data = payload?.data || {};
      meetingId = String(data.meetingId || "");
      state.context = { ...(state.context || {}), ...(data.context || {}), meetingId };
      writeJson(CONTEXT_KEY, state.context);
      return meetingId;
    } catch {
      return "";
    }
  }

  async function persistDraftContext(subject) {
    const next = {
      ...(state.context || {}),
      subject,
      riskTopic: currentRiskTopic(),
      handleId: state.context?.handleId || "local-region-response",
      region: state.context?.region || "恩施市 · 芭蕉侗族乡",
      responseLevel: state.context?.responseLevel || "Ⅱ级响应",
      host: state.context?.host || "演示账号"
    };
    state.context = next;
    persistSubject(subject);
    persistRiskTopic(next.riskTopic);
    writeJson(CONTEXT_KEY, next);
    ensureMinutes();
    try {
      await fetchJson("/api/dizai/meeting/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
    } catch { /* local context is sufficient for the demo */ }
    await hydrateParticipants();
  }

  async function beginJoinFlow(dialog) {
    const input = dialog?.querySelector("#geo-meeting-subject-input");
    const value = input?.value.trim() || "";
    if (!value) {
      input?.classList.add("is-invalid");
      dialog?.querySelector(".geo-meeting-topic-error")?.classList.add("is-visible");
      input?.focus();
      return;
    }
    await persistDraftContext(value);
    await ensureServerMeeting();
    state.sidebarOpen = false;
    state.sidebarMode = "pre";
    state.phase = "join";
    state.notice = "";
    hideSourceDialog(dialog);
    render();
    prepareJoinMedia();
  }

  function stopMedia() {
    state.mediaStream?.getTracks().forEach(track => track.stop());
    state.mediaStream = null;
    state.mediaError = "";
  }

  async function enumerateDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    state.devices.microphones = devices.filter(device => device.kind === "audioinput");
    state.devices.cameras = devices.filter(device => device.kind === "videoinput");
    if (!state.selectedMicId) state.selectedMicId = state.devices.microphones[0]?.deviceId || "";
    if (!state.selectedCameraId) state.selectedCameraId = state.devices.cameras[0]?.deviceId || "";
  }

  async function acquireMedia() {
    if (!navigator.mediaDevices?.getUserMedia) {
      state.mediaError = "当前浏览器未提供摄像头/麦克风能力，可继续使用占位画面进入会议。";
      render();
      return;
    }
    const constraints = {
      audio: state.selectedMicId ? { deviceId: { exact: state.selectedMicId } } : true,
      video: state.selectedCameraId ? { deviceId: { exact: state.selectedCameraId } } : true
    };
    stopMedia();
    try {
      state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      state.mediaError = "";
      state.micEnabled = true;
      state.videoEnabled = true;
      await enumerateDevices();
      render();
      bindMediaStreams();
    } catch (error) {
      state.mediaError = error?.name === "NotAllowedError"
        ? "未获得摄像头/麦克风权限，可在浏览器地址栏允许权限后重试。"
        : "摄像头或麦克风暂不可用，可使用占位画面继续入会。";
      render();
    }
  }

  async function prepareJoinMedia() {
    await enumerateDevices();
    await acquireMedia();
  }

  async function switchDevice(kind, deviceId) {
    if (kind === "mic") state.selectedMicId = deviceId;
    if (kind === "camera") state.selectedCameraId = deviceId;
    await acquireMedia();
  }

  function deviceOptions(devices, selectedId, fallback) {
    if (!devices.length) return `<option value="">${escapeHtml(fallback)}</option>`;
    return devices.map((device, index) => {
      const label = device.label || `${fallback} ${index + 1}`;
      return `<option value="${escapeHtml(device.deviceId)}" ${device.deviceId === selectedId ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderJoinDialog() {
    return `
      <div class="geo-meeting-join-backdrop"></div>
      <section class="geo-meeting-join-dialog" role="dialog" aria-modal="true" aria-label="加入会议">
        <header class="geo-meeting-join-header">
          <div><h2>加入会议</h2><p>${escapeHtml(currentSubject())}</p></div>
          <button type="button" class="geo-meeting-icon-button" data-meeting-action="cancel-join" aria-label="关闭加入会议">×</button>
        </header>
        <div class="geo-meeting-join-preview">
          ${state.mediaStream ? '<video class="geo-meeting-join-video" autoplay playsinline muted></video>' : '<div class="geo-meeting-camera-placeholder"><span>演</span><small>摄像头预览</small></div>'}
          ${state.mediaError ? `<div class="geo-meeting-media-notice"><span>${escapeHtml(state.mediaError)}</span><button type="button" class="geo-ui-button geo-ui-button--sm" data-meeting-action="retry-media">重试</button></div>` : ""}
        </div>
        <div class="geo-meeting-join-fields">
          <label class="geo-meeting-device-field"><span>麦克风</span><select class="geo-ui-select" data-meeting-device="mic">${deviceOptions(state.devices.microphones, state.selectedMicId, "默认麦克风")}</select></label>
          <label class="geo-meeting-device-field"><span>摄像头</span><select class="geo-ui-select" data-meeting-device="camera">${deviceOptions(state.devices.cameras, state.selectedCameraId, "默认摄像头")}</select></label>
        </div>
        <button type="button" class="geo-ui-button geo-ui-button--primary geo-ui-button--lg geo-meeting-join-submit" data-meeting-action="join-room">加入会议</button>
      </section>`;
  }

  function meetingIcon(name) {
    const icons = {
      minutes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h8l4 4v12H6z"/><path d="M14 4v4h4M9 12h6M9 16h4"/></svg>',
      meeting: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3M7 3v3M12 3v3M7 18v3M12 18v3"/></svg>',
      fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4"/></svg>',
      mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8"/></svg>',
      camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><path d="m17 10 5-3v10l-5-3z"/></svg>',
      screen: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/></svg>',
      volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h4l5-4v12l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
      leave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h7v14h-7M3 12h12M10 8l5 4-5 4"/></svg>',
      end: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>'
    };
    return icons[name] || "";
  }

  function bindMediaStreams() {
    if (!state.mediaStream) return;
    document.querySelectorAll(".geo-meeting-join-video, .geo-meeting-video-live, .geo-meeting-person-live").forEach(video => {
      if (video.srcObject !== state.mediaStream) video.srcObject = state.mediaStream;
      video.play?.().catch(() => {});
    });
  }

  function bindJoinButton() {
    const button = document.querySelector('[data-meeting-action="join-room"]');
    if (!button || button.dataset.geoJoinBound === "1") return;
    button.dataset.geoJoinBound = "1";
    button.addEventListener("click", () => {
      if (state.phase === "join") void enterRoom();
    });
  }

  function meetingTime() {
    const elapsed = state.startedAtMs ? Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000)) : 0;
    const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  function startRoomTimer() {
    stopRoomTimer();
    state.timerId = window.setInterval(() => {
      const node = document.querySelector(".geo-meeting-room-time");
      if (node) node.textContent = meetingTime();
    }, 1000);
  }
  function stopRoomTimer() {
    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = 0;
  }

  function renderParticipantPane() {
    return `
      <aside class="geo-meeting-people-pane" aria-label="会议人员">
        <div class="geo-meeting-person-tile">
          ${state.mediaStream ? '<video class="geo-meeting-person-live" autoplay playsinline muted></video>' : '<div class="geo-meeting-camera-placeholder geo-meeting-camera-placeholder--small"><span>演</span></div>'}
          <div class="geo-meeting-person-label"><span class="geo-meeting-signal">▂▅▇</span><strong>演示账号</strong></div>
        </div>
      </aside>`;
  }

  function renderMeetingRoom() {
    const context = state.context || {};
    return `
      <section class="geo-meeting-room" role="dialog" aria-label="应急会商室">
        <header class="geo-meeting-room-header">
          <div class="geo-meeting-room-title-block">
            <div class="geo-meeting-room-title-row"><span class="geo-meeting-room-dot"></span><strong>应急会商室</strong><span class="geo-meeting-room-time">${meetingTime()}</span><span class="geo-meeting-signal">▂▅▇</span></div>
            <div class="geo-meeting-room-subject" title="${escapeHtml(currentSubject())}">${escapeHtml(currentSubject())}</div>
          </div>
          <div class="geo-meeting-room-tools">
            <div class="geo-meeting-layout-switch"><button type="button" class="geo-meeting-layout-button">宫格布局</button><button type="button" class="geo-meeting-layout-button is-selected">右侧人员布局</button></div>
            <button type="button" class="geo-meeting-room-tool ${state.sidebarOpen ? "is-active" : ""}" data-meeting-action="toggle-room-minutes" aria-pressed="${state.sidebarOpen}"><span>${meetingIcon("minutes")}</span>智能纪要</button>
            ${state.sidebarOpen ? '<button type="button" class="geo-meeting-room-tool" data-meeting-action="close-minutes">收起</button>' : ""}
            <button type="button" class="geo-meeting-room-tool geo-meeting-fullscreen-button" data-meeting-action="fullscreen" aria-label="全屏">${meetingIcon("fullscreen")}</button>
          </div>
        </header>
        <div class="geo-meeting-room-content">
          <main class="geo-meeting-stage">
            ${state.mediaStream ? '<video class="geo-meeting-video-live" autoplay playsinline muted></video>' : '<div class="geo-meeting-camera-placeholder geo-meeting-camera-placeholder--stage"><span>演</span><small>摄像头未开启</small></div>'}
            ${state.mediaError ? `<div class="geo-meeting-room-media-warning">${escapeHtml(state.mediaError)}</div>` : ""}
            <div class="geo-meeting-participant-name">${meetingIcon("mic")}<span>演示账号</span></div>
          </main>
          ${renderParticipantPane()}
        </div>
        <footer class="geo-meeting-room-footer">
          <div class="geo-meeting-control-group">
            <button type="button" class="geo-meeting-control" data-meeting-action="toggle-mic"><span>${meetingIcon("mic")}</span><small>${state.micEnabled ? "静音" : "解除静音"}</small></button>
            <button type="button" class="geo-meeting-control" data-meeting-action="toggle-video"><span>${meetingIcon("camera")}</span><small>${state.videoEnabled ? "停止视频" : "开启视频"}</small></button>
            <button type="button" class="geo-meeting-control" data-meeting-action="screen"><span>${meetingIcon("screen")}</span><small>共享屏幕</small></button>
            <button type="button" class="geo-meeting-control" data-meeting-action="volume"><span>${meetingIcon("volume")}</span><small>音量</small></button>
          </div>
          <div class="geo-meeting-end-actions">
            <button type="button" class="geo-meeting-control geo-meeting-control--danger" data-meeting-action="leave-room"><span>${meetingIcon("leave")}</span><small>离开会议</small></button>
            <button type="button" class="geo-meeting-control geo-meeting-control--danger" data-meeting-action="end-room"><span>${meetingIcon("end")}</span><small>结束会议</small></button>
          </div>
        </footer>
      </section>`;
  }

  function participantLabel() {
    const context = state.context || {};
    if (context.participantNames?.length) return context.participantNames.join("、");
    if (context.participants?.length) return `已邀请 ${context.participants.length} 人`;
    return "待邀请";
  }

  function renderMinutesContent(mode) {
    const context = state.context || {};
    const minutes = ensureMinutes();
    const pre = mode === "pre";
    const overview = `
      <section class="geo-meeting-minutes-card">
        <div class="geo-meeting-minutes-card-title"><span>会议概览</span><span class="geo-meeting-minutes-mark">会商</span></div>
        <dl class="geo-meeting-minutes-overview">
          <div><dt>研判主题</dt><dd>${escapeHtml(currentRiskTopic())}</dd></div>
          <div><dt>响应区域</dt><dd>${escapeHtml(context.region || "恩施市 · 芭蕉侗族乡")}</dd></div>
          <div><dt>当前建议</dt><dd>${escapeHtml(context.responseLevel || "Ⅱ级响应")}</dd></div>
          <div><dt>参会人员</dt><dd>${escapeHtml(participantLabel())}</dd></div>
        </dl>
      </section>`;
    if (pre) {
      return `${overview}
        <section class="geo-meeting-minutes-card geo-meeting-minutes-empty-card"><div class="geo-meeting-minutes-card-title"><span>风险研判总结</span><span class="geo-meeting-minutes-mark">待生成</span></div><div class="geo-meeting-minutes-empty"><strong>会议开始后自动沉淀</strong><p>进入会商室后，将基于会议主题、参会人员和会商内容形成风险研判总结。</p></div></section>
        <section class="geo-meeting-minutes-card geo-meeting-minutes-empty-card"><div class="geo-meeting-minutes-card-title"><span>处置建议</span><span class="geo-meeting-minutes-mark">待会商</span></div><div class="geo-meeting-minutes-empty"><p>会商形成明确意见后显示处置建议。</p></div></section>
        <section class="geo-meeting-minutes-card geo-meeting-minutes-empty-card"><div class="geo-meeting-minutes-card-title"><span>责任事项</span><span class="geo-meeting-minutes-mark">待会商</span></div><div class="geo-meeting-minutes-empty"><p>会商确认责任人后形成闭环事项。</p></div></section>`;
    }
    return `${overview}
      <section class="geo-meeting-minutes-card">
        <div class="geo-meeting-minutes-card-title"><span>风险研判总结</span><span class="geo-meeting-minutes-mark">基于本次会商</span></div>
        ${state.editing ? `<textarea id="geo-meeting-minutes-editor" class="geo-ui-textarea geo-meeting-minutes-editor">${escapeHtml(minutes.summary)}</textarea>` : `<p class="geo-meeting-minutes-summary">${escapeHtml(minutes.summary)}</p>`}
      </section>
      <section class="geo-meeting-minutes-card"><div class="geo-meeting-minutes-card-title"><span>处置建议</span><span class="geo-meeting-minutes-mark">待落实</span></div><ul class="geo-meeting-minutes-list">${minutes.recommendations.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
      <section class="geo-meeting-minutes-card"><div class="geo-meeting-minutes-card-title"><span>责任事项</span><span class="geo-meeting-minutes-mark">可发送</span></div><p class="geo-meeting-minutes-responsibility">${escapeHtml(minutes.responsibilities.join("\n"))}</p></section>`;
  }

  function renderMinutesSidebar(mode = "pre") {
    const live = mode === "live";
    return `
      <aside class="geo-meeting-minutes-sidebar ${live ? "" : "geo-meeting-minutes-sidebar--pre"}" aria-label="智能纪要">
        <header class="geo-meeting-minutes-header">
          <div class="geo-meeting-minutes-heading"><span class="geo-meeting-minutes-icon">${meetingIcon("minutes")}</span><div><h2>智能纪要</h2><p>${live ? "会商内容沉淀" : "会前上下文"}</p></div></div>
          <button type="button" class="geo-meeting-icon-button" data-meeting-action="close-minutes" aria-label="关闭智能纪要">×</button>
        </header>
        <main class="geo-meeting-minutes-body">${renderMinutesContent(mode)}${state.notice ? `<div class="geo-meeting-minutes-notice">${escapeHtml(state.notice)}</div>` : ""}</main>
        <footer class="geo-meeting-minutes-footer">
          <span class="geo-meeting-minutes-footnote">${live ? "结束会议后自动归档最终纪要" : "会议开始后自动生成智能纪要"}</span>
          ${live ? `<div class="geo-meeting-minutes-actions"><button class="geo-ui-button geo-ui-button--sm" data-meeting-action="${state.editing ? "save-minutes" : "edit-minutes"}">${state.editing ? "保存纪要" : "编辑纪要"}</button><button class="geo-ui-button geo-ui-button--sm geo-ui-button--primary" data-meeting-action="send-minutes">发送给责任人</button></div>` : ""}
        </footer>
      </aside>${state.sendOpen ? renderSendDialog() : ""}`;
  }

  function renderSendDialog() {
    const rows = state.sendRecipients.length ? state.sendRecipients : [
      { userId: "gov-demo-1", nickName: "乡镇联络员", deptName: "芭蕉侗族乡人民政府", online: true },
      { userId: "expert-demo-1", nickName: "专家席位", deptName: "地质灾害防治技术中心", online: true }
    ];
    return `
      <div class="geo-meeting-send-backdrop"></div>
      <section class="geo-meeting-send-dialog" role="dialog" aria-modal="true" aria-label="发送给责任人">
        <header class="geo-meeting-send-head"><div><h3>发送给责任人</h3><p>选择需要吸收本次会商结论的人员</p></div><button class="geo-meeting-icon-button" data-meeting-action="cancel-send">×</button></header>
        <div class="geo-meeting-send-list">${rows.map(person => `<label class="geo-meeting-send-row"><input class="geo-ui-checkbox" type="checkbox" data-meeting-recipient="${escapeHtml(person.userId)}" ${state.sendSelected.has(String(person.userId)) ? "checked" : ""}/><span class="geo-meeting-send-avatar">${String(person.matchedRoleNames || "责").slice(0, 1)}</span><span class="geo-meeting-send-person"><strong>${escapeHtml(person.nickName || person.name || "责任人")}</strong><small>${escapeHtml(person.deptName || person.org || "")}</small></span><span class="geo-meeting-send-online">${person.online === false ? "离线" : "在线"}</span></label>`).join("")}</div>
        <label class="geo-ui-field"><span class="geo-ui-label">附言</span><textarea class="geo-ui-textarea" data-meeting-message>请结合本次会商纪要，落实风险研判及处置建议，并及时反馈现场进展。</textarea></label>
        <footer class="geo-meeting-send-footer"><span>已选择 ${state.sendSelected.size} 人</span><div><button class="geo-ui-button" data-meeting-action="cancel-send">取消</button><button class="geo-ui-button geo-ui-button--primary" data-meeting-action="confirm-send">确认发送</button></div></footer>
      </section>`;
  }

  async function loadSendRecipients() {
    try {
      const payload = await fetchJson("/api/dizai/role/expert?pageNum=1&pageSize=10");
      state.sendRecipients = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload.data?.rows) ? payload.data.rows : []);
    } catch { state.sendRecipients = []; }
  }

  function renderContextEditor() {
    const draft = state.contextDraft || contextDefaults();
    const levels = ["暂无", "Ⅳ级响应", "Ⅲ级响应", "Ⅱ级响应", "Ⅰ级响应"];
    const options = levels.map(level => "<option value=\"" + escapeHtml(level) + "\" " + (draft.responseLevel === level ? "selected" : "") + ">" + escapeHtml(level) + "</option>").join("");
    return [
      "      <div class=\"geo-meeting-context-backdrop\" data-meeting-action=\"cancel-context-edit\"></div>",
      "      <section class=\"geo-meeting-context-dialog\" role=\"dialog\" aria-modal=\"true\" aria-label=\"编辑会商信息\">",
      "        <header class=\"geo-meeting-context-head\">",
      "          <div><h2>会商信息</h2><p>保存后同步到专家库、智能纪要和历史会议。</p></div>",
      "          <button type=\"button\" class=\"geo-meeting-icon-button\" data-meeting-action=\"cancel-context-edit\" aria-label=\"关闭会商信息\">×</button>",
      "        </header>",
      "        <div class=\"geo-meeting-context-fields\">",
      "          <label class=\"geo-ui-field\"><span class=\"geo-ui-label\"><i aria-hidden=\"true\">*</i> 会商主题</span><input id=\"geo-meeting-context-subject\" class=\"geo-ui-input\" maxlength=\"80\" value=\"" + escapeHtml(draft.subject) + "\" placeholder=\"请输入本次会商主题\" /></label>",
      "          <label class=\"geo-ui-field\"><span class=\"geo-ui-label\"><i aria-hidden=\"true\">*</i> 研判主题</span><textarea id=\"geo-meeting-context-risk-topic\" class=\"geo-ui-textarea\" maxlength=\"160\" placeholder=\"请输入本次风险研判要回答的问题\">" + escapeHtml(draft.riskTopic) + "</textarea></label>",
      "          <label class=\"geo-ui-field\"><span class=\"geo-ui-label\">响应区域</span><input id=\"geo-meeting-context-region\" class=\"geo-ui-input\" maxlength=\"120\" value=\"" + escapeHtml(draft.region) + "\" placeholder=\"请输入响应区域\" /></label>",
      "          <label class=\"geo-ui-field\"><span class=\"geo-ui-label\">响应等级 / 当前建议</span><select id=\"geo-meeting-context-level\" class=\"geo-ui-input\">" + options + "</select></label>",
      "          <div class=\"geo-meeting-context-people\"><span class=\"geo-ui-label\">参会人员</span><strong>" + escapeHtml(participantLabel()) + "</strong><small>由专家邀请自动同步，不在此处手动填写。</small></div>",
      "          <div id=\"geo-meeting-context-error\" class=\"geo-meeting-context-error\" role=\"alert\"></div>",
      "        </div>",
      "        <footer class=\"geo-meeting-context-footer\"><button type=\"button\" class=\"geo-ui-button\" data-meeting-action=\"cancel-context-edit\">取消</button><button type=\"button\" class=\"geo-ui-button geo-ui-button--primary\" data-meeting-action=\"save-context\">保存信息</button></footer>",
      "      </section>"
    ].join("");
  }

  function openContextEditor() {
    state.contextDraft = contextDefaults();
    state.contextEditorOpen = true;
    state.sidebarOpen = false;
    render();
  }

  async function saveContextEditor() {
    const read = id => document.getElementById(id)?.value.trim() || "";
    const subject = read("geo-meeting-context-subject");
    const riskTopic = read("geo-meeting-context-risk-topic");
    const region = read("geo-meeting-context-region");
    const responseLevel = read("geo-meeting-context-level");
    const error = document.getElementById("geo-meeting-context-error");
    if (!subject || !riskTopic) {
      if (error) error.textContent = "请填写会商主题和研判主题。";
      return;
    }
    const next = {
      ...(state.context || {}),
      subject,
      riskTopic,
      handleId: state.context?.handleId || "local-region-response",
      region: region || "恩施市 · 芭蕉侗族乡",
      responseLevel: responseLevel || "暂无",
      host: state.context?.host || "演示账号"
    };
    const topicInput = document.getElementById("geo-meeting-subject-input");
    state.context = next;
    persistSubject(subject);
    persistRiskTopic(riskTopic);
    writeJson(CONTEXT_KEY, next);
    if (topicInput) topicInput.value = subject;
    state.contextDraft = null;
    state.contextEditorOpen = false;
    state.sidebarOpen = false;
    state.notice = "";
    ensureMinutes();
    try {
      await fetchJson("/api/dizai/meeting/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    } catch { /* local context is sufficient for the demo */ }
    render();
  }

  function renderMeetingHome() {
    const current = state.currentMeeting;
    const records = state.historyRecords.slice(0, 8);
    const currentContent = state.meetingHomeLoading
      ? '<div class="geo-meeting-home-empty"><span class="geo-meeting-home-empty-mark">···</span><strong>正在读取当前会议</strong><p>正在同步会议状态，请稍候。</p></div>'
      : current
        ? `<div class="geo-meeting-home-current-card">
            <div class="geo-meeting-home-current-heading"><div><span class="geo-meeting-home-status">进行中</span><h4>${escapeHtml(current.subject || "未命名会商")}</h4><p>${escapeHtml(current.region || "恩施市 · 芭蕉侗族乡")} · ${escapeHtml(current.responseLevel || "Ⅱ级响应")}</p></div><span class="geo-meeting-home-current-signal">▂▅▇</span></div>
            <dl class="geo-meeting-home-current-meta"><div><dt>发起人</dt><dd>${escapeHtml(current.host || "演示账号")}</dd></div><div><dt>参会人员</dt><dd>${escapeHtml(current.participantNames?.length ? current.participantNames.join("、") : participantLabel())}</dd></div><div><dt>开始时间</dt><dd>${escapeHtml(formatTime(current.startedAt))}</dd></div></dl>
            <button type="button" class="geo-ui-button geo-ui-button--primary" data-meeting-action="open-current-meeting">进入会商室</button>
          </div>`
        : '<div class="geo-meeting-home-empty"><span class="geo-meeting-home-empty-mark">' + meetingIcon("meeting") + '</span><strong>当前暂无进行中的会议</strong><p>点击“发起会议”，邀请专家后进入应急会商室。</p><button type="button" class="geo-ui-button geo-ui-button--primary" data-meeting-action="begin-meeting">发起会议</button></div>';
    const historyContent = state.meetingHomeHistoryOpen
      ? `<section class="geo-meeting-home-history-section"><div class="geo-meeting-home-section-heading"><div><span class="geo-meeting-home-section-kicker">记录</span><h3>历史会议</h3></div><button type="button" class="geo-ui-button geo-ui-button--sm" data-meeting-action="toggle-home-history">收起</button></div><div class="geo-meeting-home-history-items">${records.length ? records.map(record => `<button type="button" class="geo-meeting-home-history-item" data-meeting-action="home-history-record" data-history-id="${escapeHtml(record.id)}"><span class="geo-meeting-home-history-icon">${meetingIcon("minutes")}</span><span><strong>${escapeHtml(record.subject || "会商")}</strong><small>${escapeHtml(formatTime(record.startedAt))} · ${escapeHtml(record.region || "--")}</small></span><em>已结束</em><span class="geo-meeting-home-history-arrow">›</span></button>`).join("") : '<div class="geo-meeting-home-history-empty">暂无历史会议记录</div>'}</div></section>`
      : '<button type="button" class="geo-meeting-home-history-collapsed" data-meeting-action="toggle-home-history"><span class="geo-meeting-home-history-icon">' + meetingIcon("minutes") + '</span><span><strong>历史会议</strong><small>点击展开已结束的会商记录</small></span><span class="geo-meeting-home-history-arrow">⌄</span></button>';
    return `
      <div class="geo-meeting-home-backdrop" data-meeting-action="close-meeting-home"></div>
      <section class="geo-meeting-home-dialog" role="dialog" aria-modal="true" aria-label="会商中心">
        <header class="geo-meeting-home-header">
          <div><h2>会商中心</h2></div>
          <button type="button" class="geo-meeting-icon-button" data-meeting-action="close-meeting-home" aria-label="关闭会商中心">×</button>
        </header>
        <div class="geo-meeting-home-layout">
          <aside class="geo-meeting-home-actions" aria-label="会议入口">
            <button type="button" class="geo-meeting-home-action is-selected" data-meeting-action="home-current"><span class="geo-meeting-home-action-icon">${meetingIcon("meeting")}</span><strong>当前会议</strong><small>查看正在进行的会商</small></button>
            <button type="button" class="geo-meeting-home-action geo-meeting-home-action--primary" data-meeting-action="begin-meeting"><span class="geo-meeting-home-action-icon">＋</span><strong>发起会议</strong><small>邀请专家并进入会商室</small></button>
            <button type="button" class="geo-meeting-home-action" data-meeting-action="toggle-home-history" aria-expanded="${state.meetingHomeHistoryOpen}"><span class="geo-meeting-home-action-icon">${meetingIcon("minutes")}</span><strong>历史会议</strong><small>查看已结束的会商记录</small></button>
          </aside>
          <main class="geo-meeting-home-content">
            <section class="geo-meeting-home-current-section"><div class="geo-meeting-home-section-heading"><div><span class="geo-meeting-home-section-kicker">实时状态</span><h3>当前会议</h3></div><span class="geo-meeting-home-section-count">${current ? "1 场进行中" : "暂无进行中"}</span></div>${currentContent}</section>
            ${historyContent}
          </main>
        </div>
      </section>`;
  }

  async function loadMeetingHomeData() {
    let current = null;
    try {
      const payload = await fetchJson("/api/dizai/meeting/currentContext");
      const data = payload?.data;
      if (data?.meetingId) current = data;
    } catch { /* empty state is valid */ }
    await loadHistory();
    state.currentMeeting = current;
    state.meetingHomeLoading = false;
    if (state.meetingHomeOpen) render();
  }

  function openMeetingHome() {
    state.meetingHomeOpen = true;
    state.meetingHomeHistoryOpen = false;
    state.meetingHomeLoading = true;
    state.currentMeeting = null;
    state.sidebarOpen = false;
    state.notice = "";
    render();
    void loadMeetingHomeData();
  }

  function isDirectLaunchLabel(node) {
    const label = textOf(node);
    return label.includes("直接启动响应") && !label.includes("上传预警报告");
  }

  function directLaunchTarget(event) {
    let node = event.target;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (visible(node) && isDirectLaunchLabel(node)) return node;
    }
    return null;
  }

  function findDirectLaunchAction() {
    return [...document.querySelectorAll("#chat-left-btn *, .left-btn *")]
      .filter(node => visible(node) && isDirectLaunchLabel(node))
      .sort((a, b) => textOf(a).length - textOf(b).length)[0] || null;
  }

  function beginMeetingFromHome() {
    state.meetingHomeOpen = false;
    state.meetingHomeHistoryOpen = false;
    state.meetingHomeLoading = false;
    render();
    const action = findDirectLaunchAction();
    if (!action) {
      state.meetingHomeOpen = true;
      state.notice = "暂未找到发起会议入口，请稍后重试。";
      render();
      return;
    }
    state.allowNativeDirectLaunch = true;
    action.click();
    window.setTimeout(() => { state.allowNativeDirectLaunch = false; }, 0);
  }

  function openCurrentMeeting() {
    if (!state.currentMeeting) return;
    state.context = { ...(state.context || {}), ...state.currentMeeting };
    state.meetingHomeOpen = false;
    state.phase = "room";
    state.sidebarOpen = false;
    state.sidebarMode = "live";
    state.startedAtMs = Date.parse(state.currentMeeting.startedAt || "") || Date.now();
    ensureMinutes();
    render();
    startRoomTimer();
  }

  function render() {
    const mount = root();
    mount.className = `geo-ui geo-meeting-suite-root is-${state.phase}${state.sidebarOpen ? " is-minutes-open" : ""}${state.meetingHomeOpen ? " is-meeting-home" : ""}`;
    if (state.meetingHomeOpen) {
      mount.innerHTML = renderMeetingHome();
      return;
    }
    if (state.phase === "join") {
      mount.innerHTML = renderJoinDialog();
      bindJoinButton();
      bindMediaStreams();
      return;
    }
    if (state.phase === "room") {
      mount.innerHTML = `<div class="geo-meeting-room-shell">${renderMeetingRoom()}${state.sidebarOpen ? renderMinutesSidebar("live") : ""}</div>`;
      bindMediaStreams();
      return;
    }
    if (state.contextEditorOpen) {
      mount.innerHTML = renderContextEditor();
      return;
    }
    if (state.sidebarOpen) {
      mount.innerHTML = renderMinutesSidebar("pre");
      requestAnimationFrame(alignPreMeetingMinutes);
      return;
    }
    mount.innerHTML = "";
  }

  async function enterRoom() {
    state.phase = "room";
    state.sidebarOpen = false;
    state.sidebarMode = "live";
    state.editing = false;
    state.sendOpen = false;
    state.notice = "";
    state.startedAtMs = Date.now();
    state.context = {
      ...(state.context || {}),
      subject: currentSubject(),
      startedAt: new Date().toISOString()
    };
    writeJson(CONTEXT_KEY, state.context);
    ensureMinutes();
    render();
    bindMediaStreams();
    startRoomTimer();
  }

  function toggleTrack(kind) {
    if (!state.mediaStream) {
      state.notice = "当前使用占位画面，未检测到可控制的媒体轨道。";
      return;
    }
    if (kind === "audio") {
      state.micEnabled = !state.micEnabled;
      state.mediaStream.getAudioTracks().forEach(track => { track.enabled = state.micEnabled; });
    } else {
      state.videoEnabled = !state.videoEnabled;
      state.mediaStream.getVideoTracks().forEach(track => { track.enabled = state.videoEnabled; });
    }
    render();
    bindMediaStreams();
  }

  function currentRecord(status = "completed") {
    const context = state.context || {};
    const minutes = ensureMinutes();
    const endedAt = new Date().toISOString();
    const startedAt = context.startedAt || endedAt;
    return {
      id: context.meetingId || `meeting-${Date.now()}`,
      meetingId: context.meetingId || "",
      subject: currentSubject(),
      riskTopic: currentRiskTopic(),
      handleId: context.handleId || "local-region-response",
      region: context.region || "恩施市 · 芭蕉侗族乡",
      responseLevel: context.responseLevel || "Ⅱ级响应",
      host: context.host || "演示账号",
      participants: Array.isArray(context.participants) ? context.participants : [],
      participantNames: Array.isArray(context.participantNames) ? context.participantNames : [],
      startedAt,
      endedAt,
      durationMinutes: Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60000) || 0),
      status,
      minutes: {
        summary: minutes.summary,
        recommendations: [...minutes.recommendations],
        responsibilities: [...minutes.responsibilities]
      },
      distribution: state.sentInfo ? { ...state.sentInfo } : null
    };
  }

  function saveRecordLocal(record) {
    const current = readMigratedJson(HISTORY_KEY, LEGACY_HISTORY_KEY, []);
    const next = [record, ...current.filter(item => item.id !== record.id)].slice(0, 100);
    writeJson(HISTORY_KEY, next);
    state.historyRecords = next;
  }

  async function saveCurrentRecord(status = "completed") {
    const record = currentRecord(status);
    saveRecordLocal(record);
    try {
      await fetchJson("/api/dizai/meeting/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
    } catch { /* localStorage is the fallback */ }
    return record;
  }

  async function endMeeting(status) {
    const meetingId = state.context?.meetingId || "local-meeting";
    if (status === "ended") await saveCurrentRecord("completed");
    try {
      await originalFetch(`/api/dizai/meeting/${status === "ended" ? "closeMeeting" : "exitMeeting"}/${encodeURIComponent(meetingId)}`, { method: "POST" });
    } catch { /* best effort */ }
    stopRoomTimer();
    stopMedia();
    state.phase = "idle";
    state.sidebarOpen = false;
    restoreSourceDialog();
    location.href = "/defense-response";
  }

  async function loadHistory() {
    const local = readMigratedJson(HISTORY_KEY, LEGACY_HISTORY_KEY, []);
    let remote = [];
    try {
      const payload = await fetchJson("/api/dizai/meeting/history");
      remote = Array.isArray(payload.data) ? payload.data : [];
    } catch { /* local only */ }
    const merged = new Map();
    [...remote, ...local].forEach(item => { if (item?.id) merged.set(item.id, item); });
    state.historyRecords = [...merged.values()].sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
    if (!state.historySelectedId && state.historyRecords[0]) state.historySelectedId = state.historyRecords[0].id;
  }

  function selectedHistoryRecord() {
    return state.historyRecords.find(item => item.id === state.historySelectedId) || state.historyRecords[0] || null;
  }

  function renderHistoryDetail(record) {
    const minute = record.minutes || {};
    const people = record.participantNames?.length ? record.participantNames.join("、") : (record.participants?.length ? `${record.participants.length} 人` : "--");
    const distribution = record.distribution;
    return `
      <div class="geo-meeting-history-detail-head"><div><span class="geo-meeting-history-state">已结束</span><h2>${escapeHtml(record.subject || "会商")}</h2></div><span>${escapeHtml(formatTime(record.startedAt))}</span></div>
      <section class="geo-meeting-history-section"><h3>基础信息</h3><dl class="geo-meeting-history-meta"><div><dt>会议时间</dt><dd>${escapeHtml(formatTime(record.startedAt))}</dd></div><div><dt>会议时长</dt><dd>${escapeHtml(record.durationMinutes ?? 0)} 分钟</dd></div><div><dt>主持人</dt><dd>${escapeHtml(record.host || "--")}</dd></div><div><dt>研判主题</dt><dd>${escapeHtml(record.riskTopic || record.subject || "--")}</dd></div><div><dt>响应区域</dt><dd>${escapeHtml(record.region || "--")}</dd></div><div><dt>响应等级</dt><dd>${escapeHtml(record.responseLevel || "--")}</dd></div><div><dt>参会人员</dt><dd>${escapeHtml(people)}</dd></div></dl></section>
      <section class="geo-meeting-history-section"><h3>风险研判总结</h3><div class="geo-meeting-history-copy">${escapeHtml(minute.summary || "暂无")}</div></section>
      <section class="geo-meeting-history-section"><h3>处置建议</h3><div class="geo-meeting-history-copy">${escapeHtml((minute.recommendations || []).map((item, index) => `${index + 1}. ${item}`).join("\n") || "暂无")}</div></section>
      <section class="geo-meeting-history-section"><h3>责任事项</h3><div class="geo-meeting-history-copy">${escapeHtml((minute.responsibilities || []).join("\n") || "暂无")}</div></section>
      <section class="geo-meeting-history-section"><h3>发送记录</h3><div class="geo-meeting-history-copy">${distribution ? `已发送 ${escapeHtml(distribution.recipientCount || 0)} 人 · ${escapeHtml(formatTime(distribution.sentAt))}` : "未发送"}</div></section>`;
  }

  function renderHistoryPage() {
    document.getElementById("app")?.setAttribute("hidden", "");
    let mount = document.getElementById(HISTORY_ROOT_ID);
    if (!mount) {
      mount = document.createElement("div");
      mount.id = HISTORY_ROOT_ID;
      mount.className = "geo-ui";
      document.body.appendChild(mount);
    }
    const query = state.historyQuery.trim().toLowerCase();
    const list = state.historyRecords.filter(item => !query || `${item.subject} ${item.region} ${item.host}`.toLowerCase().includes(query));
    const selected = selectedHistoryRecord();
    mount.innerHTML = `
      <div class="geo-meeting-history-shell">
        <header class="geo-meeting-history-header"><div class="geo-meeting-history-heading"><button class="geo-ui-button geo-ui-button--sm" data-meeting-action="back-defense">← 返回防御响应</button><div><h1>历史会议记录</h1><p>查看会议基础信息与最终智能纪要</p></div></div></header>
        <main class="geo-meeting-history-main">
          <aside class="geo-meeting-history-list-pane"><div class="geo-meeting-history-search"><input id="geo-meeting-history-search" class="geo-ui-input" value="${escapeHtml(state.historyQuery)}" placeholder="搜索会议主题 / 区域" /></div><div class="geo-meeting-history-items">${list.length ? list.map(item => `<button class="geo-meeting-history-item ${item.id === selected?.id ? "is-active" : ""}" data-history-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.subject || "会商")}</strong><small>${escapeHtml(formatTime(item.startedAt))}</small><span>${escapeHtml(item.region || "--")}</span><em>${item.minutes ? "已生成纪要" : "无纪要"}</em></button>`).join("") : '<div class="geo-meeting-history-empty">暂无历史会议记录</div>'}</div></aside>
          <section class="geo-meeting-history-detail">${selected ? renderHistoryDetail(selected) : '<div class="geo-meeting-history-empty">结束一场会商后，这里会显示最终会议记录。</div>'}</section>
        </main>
      </div>`;
    mount.querySelector("#geo-meeting-history-search")?.addEventListener("input", event => {
      state.historyQuery = event.target.value;
      renderHistoryPage();
      const next = document.getElementById("geo-meeting-history-search");
      next?.focus();
      next?.setSelectionRange(next.value.length, next.value.length);
    });
  }

  async function initHistoryRoute() {
    await loadHistory();
    renderHistoryPage();
  }

  const originalFetch = window.fetch.bind(window);

  async function onCaptureClick(event) {
    const launch = directLaunchTarget(event);
    const featureRoot = document.getElementById(ROOT_ID);
    if (launch && !featureRoot?.contains(launch) && state.phase === "idle" && !state.allowNativeDirectLaunch) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMeetingHome();
      return;
    }
    const button = event.target.closest("button");
    if (!button) return;
    const label = textOf(button);
    if ((label === "进入会商室" || label === "确认邀请") && findExpertDialog()?.contains(button)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await beginJoinFlow(findExpertDialog());
      return;
    }
    if (button.dataset.geoMeetingCancel === "1") {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.sidebarOpen = false;
      render();
      closeExpertDialog(findExpertDialog());
    }
  }

  async function onClick(event) {
    const homeRecord = event.target.closest('[data-meeting-action="home-history-record"]');
    if (homeRecord) {
      state.historySelectedId = homeRecord.dataset.historyId || state.historySelectedId;
      location.href = "/meeting-history";
      return;
    }
    const historyItem = event.target.closest("[data-history-id]");
    if (historyItem) {
      state.historySelectedId = historyItem.dataset.historyId;
      renderHistoryPage();
      return;
    }
    const recipient = event.target.closest("[data-meeting-recipient]");
    if (recipient?.matches("input")) return;
    const action = event.target.closest("[data-meeting-action]")?.dataset.meetingAction;
    if (!action) return;
    if (action === "close-meeting-home") { state.meetingHomeOpen = false; state.meetingHomeHistoryOpen = false; state.meetingHomeLoading = false; render(); return; }
    if (action === "home-current") { state.meetingHomeHistoryOpen = false; render(); return; }
    if (action === "toggle-home-history") { state.meetingHomeHistoryOpen = !state.meetingHomeHistoryOpen; render(); return; }
    if (action === "begin-meeting") { beginMeetingFromHome(); return; }
    if (action === "open-current-meeting") { openCurrentMeeting(); return; }
    if (action === "history") { location.href = "/meeting-history"; return; }
    if (action === "back-defense") { location.href = "/defense-response"; return; }
    if (action === "edit-context") { openContextEditor(); return; }
    if (action === "cancel-context-edit") { state.contextDraft = null; state.contextEditorOpen = false; render(); return; }
    if (action === "save-context") { await saveContextEditor(); return; }
    if (action === "toggle-pre-minutes") { state.sidebarMode = "pre"; state.sidebarOpen = !state.sidebarOpen; render(); return; }
    if (action === "close-minutes") { state.sidebarOpen = false; state.sendOpen = false; render(); return; }
    if (action === "cancel-join") { stopMedia(); state.phase = "idle"; restoreSourceDialog(); render(); return; }
    if (action === "retry-media") { await acquireMedia(); return; }
    if (action === "join-room") { await enterRoom(); return; }
    if (action === "toggle-room-minutes") { state.sidebarOpen = !state.sidebarOpen; state.sidebarMode = "live"; state.sendOpen = false; render(); bindMediaStreams(); return; }
    if (action === "fullscreen") {
      const room = document.querySelector(".geo-meeting-room");
      if (!document.fullscreenElement) room?.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.().catch(() => {});
      return;
    }
    if (action === "toggle-mic") { toggleTrack("audio"); return; }
    if (action === "toggle-video") { toggleTrack("video"); return; }
    if (action === "screen") { state.notice = "屏幕共享需接入正式会议信令后启用。"; if (state.sidebarOpen) render(); return; }
    if (action === "volume") { state.notice = "音量控制已保留会议操作位。"; if (state.sidebarOpen) render(); return; }
    if (action === "edit-minutes") { state.editing = true; state.notice = ""; render(); return; }
    if (action === "save-minutes") {
      const editor = document.getElementById("geo-meeting-minutes-editor");
      if (editor) ensureMinutes().summary = editor.value.trim();
      state.editing = false;
      state.notice = "纪要已更新，结束会议后将按最终版本归档。";
      render(); return;
    }
    if (action === "send-minutes") { await loadSendRecipients(); state.sendOpen = true; state.notice = ""; render(); return; }
    if (action === "cancel-send") { state.sendOpen = false; render(); return; }
    if (action === "confirm-send") {
      if (!state.sendSelected.size) { state.notice = "请至少选择一位责任人。"; state.sendOpen = false; render(); return; }
      state.sentInfo = { recipientCount: state.sendSelected.size, recipientIds: [...state.sendSelected], sentAt: new Date().toISOString() };
      state.notice = `已发送给 ${state.sendSelected.size} 位责任人。`;
      state.sendOpen = false;
      render(); return;
    }
    if (action === "leave-room") { await endMeeting("left"); return; }
    if (action === "end-room") { await endMeeting("ended"); return; }
  }

  function onChange(event) {
    const recipientId = event.target?.dataset?.meetingRecipient;
    if (recipientId) {
      if (event.target.checked) state.sendSelected.add(String(recipientId)); else state.sendSelected.delete(String(recipientId));
      const footer = document.querySelector(".geo-meeting-send-footer > span");
      if (footer) footer.textContent = `已选择 ${state.sendSelected.size} 人`;
      return;
    }
    const kind = event.target?.dataset?.meetingDevice;
    if (kind) switchDevice(kind, event.target.value);
  }

  let syncScheduled = false;
  function scheduleSync() {
    if (syncScheduled || location.pathname === "/meeting-history") return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
      injectMeetingTopic();
    });
  }

  document.addEventListener("click", onCaptureClick, true);
  document.addEventListener("click", onClick, false);
  document.addEventListener("change", onChange, false);
  window.addEventListener("resize", () => requestAnimationFrame(alignPreMeetingMinutes));
  new MutationObserver(scheduleSync).observe(document.documentElement, { childList: true, subtree: true });

  if (location.pathname === "/meeting-history") initHistoryRoute();
  else scheduleSync();
})();
