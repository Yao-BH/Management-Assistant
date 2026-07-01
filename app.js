const assistantHistory = [];

const employees = {};
const profileFallbacks = {};
const loadingBrief = {
  title: "正在生成今日研判...",
  summary: "正在结合数据库中的员工档案、沟通记录和待办生成研判。",
  insights: []
};
const emptyBrief = {
  title: "今日管理研判",
  summary: "暂无可研判数据，请先补充员工档案或沟通记录。",
  insights: []
};

let archiveEmployees = [];
let communicationRecords = [];
let smartTodos = [];
let riskSignals = [];
let selectedTodoId = "";
let selectedFocusId = "";
let currentBrief = emptyBrief;
let pendingEmployeeEdits = {};
let agentEvents = [];
let agentFeedSignature = "";

function initIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugifyName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, "-") || `employee-${Date.now()}`;
}

function inlineFormat(value) {
  return escapeHtml(value)
    .replace(/(^|[\s：:])\*([^*：:]{2,24})\*\*/g, "$1<strong>$2</strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function formatAssistantMessage(text) {
  const lines = String(text).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ol>${listItems.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</ol>`);
    listItems = [];
  };
  lines.forEach((line) => {
    const heading = line.match(/^#{1,6}\s*(.*)$/);
    if (heading) {
      flushList();
      blocks.push(`<p class="assistant-heading">${inlineFormat(heading[1])}</p>`);
      return;
    }
    const cleaned = line.replace(/^\*+(?=\d+[.、])/, "").replace(/^[-*]\s*/, "");
    const numbered = cleaned.match(/^\d+[.、]\s*(.*)$/);
    if (numbered) {
      listItems.push(numbered[1]);
      return;
    }
    flushList();
    const actionLike = /^(结论|依据|建议|动作|下一步|优先处理|风险原因|需要补充)[:：]/.test(cleaned);
    blocks.push(`<p class="${actionLike ? "assistant-action" : ""}">${inlineFormat(cleaned)}</p>`);
  });
  flushList();
  return blocks.join("");
}

async function postJson(url, payload = {}) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`${url} failed`);
  return response.json();
}

function signalText(signal) {
  if (!signal) return "";
  const label = signal.label || signal.type || "";
  const value = signal.value || "";
  return value && value !== label ? `${label}：${value}` : label;
}

function formatEventTime(date = new Date()) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function employeeNameByKey(employeeKey) {
  return employees[employeeKey]?.name || archiveEmployees.find((employee) => employee.key === employeeKey)?.name || "重点员工";
}

function renderAgentFeed() {
  const feed = document.querySelector("[data-agent-feed]");
  if (!feed) return;
  const teamCount = archiveEmployees.length;
  const focusQueue = buildFocusQueue();
  const focusCount = focusQueue.length;
  const topFocus = focusQueue[0];
  const topName = topFocus ? employeeNameByKey(topFocus.employeeKey) : "暂无";
  const latestSignal = riskSignals[0];
  const latestText = latestSignal ? `${employeeNameByKey(latestSignal.employeeKey)} · ${signalText(latestSignal)}` : "未发现新的高强度信号";
  const nextAction = topFocus?.title || "保持常规沟通节奏";
  const latestEvent = agentEvents[0]?.text || `已同步 ${smartTodos.length} 条管理待办。`;
  feed.innerHTML = `
    <div class="agent-status-item scan"><b>扫描</b><span>${escapeHtml(teamCount)} 名员工</span></div>
    <div class="agent-status-item found"><b>发现</b><span>${escapeHtml(focusCount)} 个关注对象 · ${escapeHtml(latestText)}</span></div>
    <div class="agent-status-item next"><b>建议</b><span>${escapeHtml(topName)}：${escapeHtml(nextAction)}</span></div>
    <div class="agent-status-ticker"><time>${escapeHtml(formatEventTime())}</time><span>${escapeHtml(latestEvent)}</span></div>
  `;
}

function pushAgentEvent(text) {
  if (!text) return;
  agentEvents = [{ time: formatEventTime(), text }, ...agentEvents].slice(0, 8);
  renderAgentFeed();
}

function buildAgentSnapshotEvents() {
  const teamCount = archiveEmployees.length;
  const focusCount = archiveEmployees.filter(shouldShowInFocus).length;
  const todoCount = smartTodos.length;
  const events = [
    { time: formatEventTime(), text: `扫描 ${teamCount} 名员工，发现 ${focusCount} 个重点关注对象。` },
  ];
  const signalItems = riskSignals.slice(0, 2);
  signalItems.forEach((signal) => {
    events.push({
      time: formatEventTime(),
      text: `识别到${employeeNameByKey(signal.employeeKey)}：${signalText(signal)}。`,
    });
  });
  if (!signalItems.length) {
    const topFocus = buildFocusQueue()[0];
    if (topFocus) events.push({ time: formatEventTime(), text: `当前优先关注${employeeNameByKey(topFocus.employeeKey)}，建议推进管理动作。` });
  }
  events.push({ time: formatEventTime(), text: `已同步 ${todoCount} 条管理待办。` });
  return events.slice(0, 5);
}

function updateAgentFeedFromState(reason = "已同步最新管理数据。") {
  const signature = JSON.stringify({
    team: archiveEmployees.length,
    focus: archiveEmployees.filter(shouldShowInFocus).length,
    todos: smartTodos.map((todo) => `${todo.id}:${todo.status}`).join("|"),
    signals: riskSignals.map((signal) => `${signal.id}:${signal.status}`).join("|"),
  });
  if (!agentFeedSignature) {
    agentFeedSignature = signature;
    agentEvents = buildAgentSnapshotEvents();
    renderAgentFeed();
    return;
  }
  if (signature !== agentFeedSignature) {
    agentFeedSignature = signature;
    pushAgentEvent(reason);
    const latestSignal = riskSignals[0];
    if (latestSignal) pushAgentEvent(`刷新风险证据：${employeeNameByKey(latestSignal.employeeKey)} · ${signalText(latestSignal)}。`);
  }
}

function syncEmployeesFromArchive(list = archiveEmployees) {
  Object.keys(employees).forEach((key) => delete employees[key]);
  list.forEach((employee) => {
    employees[employee.key] = {
      key: employee.key,
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
      role: employee.role,
      jobLevel: employee.jobLevel || "",
      hireDate: employee.hireDate,
      manager: employee.manager,
      performanceRating: employee.performanceRating || "",
      performanceTrend: employee.performanceTrend || "",
      goalCompletionRate: employee.goalCompletionRate || 0,
      overtimeHours30d: employee.overtimeHours30d || 0,
      lateCount30d: employee.lateCount30d || 0,
      leaveDays30d: employee.leaveDays30d || 0,
      contractEndDate: employee.contractEndDate || "",
      probationEndDate: employee.probationEndDate || "",
      mentor: employee.mentor || "",
      growthSummary: employee.growthSummary || "",
      awardsSummary: employee.awardsSummary || "",
      keyEvents: employee.keyEvents || "",
      compensationSignal: employee.compensationSignal || "",
      risk: employee.risk || 0,
      level: employee.level || "待分析",
      reason: employee.reason || "",
      evidence: employee.evidence || [],
      riskSignals: employee.riskSignals || [],
      riskFactors: employee.riskFactors || [],
      goal: employee.goal || employee.suggestedAction || "",
      lifecycle: employee.lifecycle || { stage: employee.lifecycleStage || "待分析", detail: employee.lifecycleDetail || "" },
      performance: employee.performance || "待分析",
      attendance: employee.attendance || "待分析",
      communication: employee.communication || "待分析",
      suggestedAction: employee.suggestedAction || "待分析",
      analysisStatus: employee.analysisStatus || "待分析"
    };
    profileFallbacks[employee.key] = {
      riskSummary: employee.reason || "当前员工缺少足够分析数据，建议补充沟通记录后运行 AI 分析。",
      evidence: (employee.riskSignals || []).map(signalText).filter(Boolean).length
        ? (employee.riskSignals || []).map(signalText).filter(Boolean)
        : employee.evidence || [],
      performance: employee.performance || "待分析",
      attendance: employee.attendance || "待分析",
      communication: employee.communication || "待分析",
      suggestedAction: employee.suggestedAction || "待分析",
      lifecycleStage: employee.lifecycle?.stage || "待分析",
      lifecycleDetail: employee.lifecycle?.detail || "系统将结合入职时间、沟通记录和关键节点判断生命周期。"
    };
  });
}

function applyArchivePayload(payload = {}) {
  if (!payload) return;
  archiveEmployees = payload.employees || archiveEmployees;
  communicationRecords = payload.communicationRecords || communicationRecords;
  smartTodos = payload.todos || smartTodos;
  riskSignals = payload.riskSignals || riskSignals;
  syncEmployeesFromArchive(archiveEmployees);
  renderArchive();
  renderMetrics(payload.metrics || deriveDashboardMetrics());
  renderRiskTable(smartTodos);
  renderTodoWorkbench();
  updateAgentFeedFromState("AI 已根据最新数据刷新风险、待办和关注队列。");
}

async function loadArchive() {
  try {
    const payload = await postJson("/api/archive");
    applyArchivePayload(payload);
  } catch {
    syncEmployeesFromArchive();
    renderArchive();
    renderRiskTable(smartTodos);
    renderTodoWorkbench();
  }
}

function renderMetrics(items) {
  const grid = document.querySelector("[data-metrics]");
  if (!grid) {
    renderSignalBoard(Array.isArray(items) && items.length ? items : deriveDashboardMetrics());
    return;
  }
  grid.innerHTML = "";
  const source = Array.isArray(items) && items.length ? items : deriveDashboardMetrics();
  const dashboardKeys = ["team", "focus", "todo"];
  const metricDefaults = {
    team: { key: "team", label: "员工档案", value: "0", detail: "来自数据库", tone: "pink" },
    focus: { key: "focus", label: "重点关注", value: "0", detail: "暂无风险标记", tone: "blue" },
    todo: { key: "todo", label: "待办动作", value: "0", detail: "暂无待办", tone: "green" }
  };
  const visibleSource = dashboardKeys.map((key) => source.find((item) => item.key === key) || metricDefaults[key]).filter(Boolean);
  const normalized = visibleSource.map((item, index) => ({
    key: item.key || dashboardKeys[index],
    label: item.label || metricDefaults[dashboardKeys[index]].label,
    value: item.value ?? metricDefaults[dashboardKeys[index]].value,
    detail: item.detail || metricDefaults[dashboardKeys[index]].detail,
    tone: item.tone || metricDefaults[dashboardKeys[index]].tone
  }));
  normalized.forEach((item) => {
    const card = document.createElement("article");
    card.className = `kpi ${item.tone || ""}`;
    card.innerHTML = `<strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.detail)}</small>`;
    grid.appendChild(card);
  });
  renderSignalBoard(source);
}

function metricValue(items, key, fallbackValue) {
  const item = items.find((entry) => entry.key === key || entry.label === key);
  return item?.value || fallbackValue;
}

function isRiskEmployee(employee) {
  return ["高风险", "中风险"].includes(employee.level);
}

function deriveDashboardMetrics() {
  const teamCount = archiveEmployees.length;
  const focusCount = archiveEmployees.filter(isRiskEmployee).length;
  const coveredEmployees = new Set(communicationRecords.map((record) => record.employee).filter(Boolean));
  const coverage = teamCount ? Math.round((coveredEmployees.size / teamCount) * 100) : 0;
  const actionCount = smartTodos.length || focusCount + communicationRecords.filter((record) => record.action).length;

  return [
    { key: "team", label: "员工档案", value: String(teamCount), detail: "已录入基础信息", tone: "pink" },
    { key: "focus", label: "重点关注", value: String(focusCount), detail: focusCount ? "系统识别对象" : "暂无风险标记", tone: "blue" },
    { key: "todo", label: "待办动作", value: String(actionCount), detail: "风险与节点生成", tone: "green" },
    { key: "coverage", label: "沟通覆盖", value: `${coverage}%`, detail: `${coveredEmployees.size}/${teamCount || 0} 员工已覆盖`, tone: "amber" }
  ];
}

function refreshDashboardMetrics() {
  renderMetrics(deriveDashboardMetrics());
}

function renderSignalBoard(items = deriveDashboardMetrics()) {
  const team = metricValue(items, "team", "0");
  const focus = metricValue(items, "focus", "0");
  const todo = metricValue(items, "todo", "0");
  const coverage = metricValue(items, "coverage", "0%");
  const teamNumber = Number.parseInt(team, 10) || 0;
  const focusNumber = Number.parseInt(focus, 10) || 0;
  const stableNumber = Math.max(teamNumber - focusNumber, 0);
  const stableRate = teamNumber ? Math.round((stableNumber / teamNumber) * 100) : 0;
  const focusRate = teamNumber ? Math.round((focusNumber / teamNumber) * 100) : 0;
  const coverageNumber = Number.parseInt(coverage, 10) || 0;
  const todoNumber = Number.parseInt(todo, 10) || 0;
  const health = Math.max(0, Math.min(100, Math.round(stableRate * 0.55 + coverageNumber * 0.35 - todoNumber * 1.2)));
  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  };
  const setWidth = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.style.width = value;
  };
  setText("[data-funnel-total]", team);
  setText("[data-funnel-stable]", String(stableNumber));
  setText("[data-funnel-focus]", focus);
  setText("[data-funnel-action]", todo);
  setText("[data-signal-health]", `${health}%`);
  setText("[data-signal-coverage]", coverage);
  setText("[data-signal-focus-rate]", `${focusRate}%`);
  setWidth("[data-signal-stable-bar]", `${stableRate}%`);
  setWidth("[data-signal-focus-bar]", `${focusRate}%`);
  setWidth("[data-signal-action-bar]", `${Math.min(todoNumber * 12, 100)}%`);
  setWidth("[data-signal-coverage-bar]", `${coverageNumber}%`);
}

async function loadMetrics() {
  try {
    const result = await postJson("/api/metrics");
    renderMetrics(result.items || deriveDashboardMetrics());
  } catch {
    refreshDashboardMetrics();
  }
}

function renderBrief(brief) {
  currentBrief = { ...emptyBrief, ...brief };
  const briefTitle = document.querySelector("[data-brief-title]");
  briefTitle.textContent = String(currentBrief.title || "").includes("正在") ? "正在生成今日重点关注..." : "今日重点关注";
  document.querySelector("[data-brief-summary]").textContent = currentBrief.summary || emptyBrief.summary;
  const insights = document.querySelector("[data-brief-insights]");
  if (insights) {
    insights.innerHTML = "";
    (currentBrief.insights || []).slice(0, 3).forEach((item) => {
      const card = document.createElement("div");
      card.innerHTML = `<span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small>`;
      insights.appendChild(card);
    });
  }
  renderFocusDetail(selectedFocusItem());
}

async function loadBrief() {
  renderBrief(loadingBrief);
  try {
    renderBrief(await postJson("/api/brief"));
  } catch {
    renderBrief(emptyBrief);
  }
}

function addChatBubble(text, role, actions = [], card = null) {
  const chat = document.querySelector(".chat-preview");
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.innerHTML = role === "assistant" ? formatAssistantMessage(text) : escapeHtml(text);
  chat.appendChild(bubble);
  chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
}

async function submitChat(message, intent = "") {
  if (!message) return;
  document.querySelector(".copilot-card")?.classList.add("chat-active");
  addChatBubble(message, "user");
  const thinking = document.createElement("div");
  thinking.className = "bubble assistant";
  thinking.innerHTML = "<p>正在结合员工状态与风险信号分析...</p>";
  document.querySelector(".chat-preview").appendChild(thinking);
  try {
    const result = await postJson("/api/chat", { message, intent, history: assistantHistory });
    thinking.remove();
    addChatBubble(result.reply || "建议优先查看风险画像，并生成 1 对 1 沟通提纲。", "assistant", result.actions || [], result.card || null);
    pushAgentEvent(`Agent 已识别“${intent || result.intent || "团队问答"}”意图并完成回复。`);
    assistantHistory.push({ role: "user", content: message });
    assistantHistory.push({ role: "assistant", content: result.reply || "" });
  } catch {
    thinking.remove();
    addChatBubble("建议优先查看重点员工风险画像，并生成 1 对 1 沟通提纲。", "assistant");
  }
}

function activateChat() {
  const input = document.querySelector(".chat-input input");
  const send = document.querySelector(".chat-input button");
  const submit = async () => {
    const value = input.value.trim();
    input.value = "";
    await submitChat(value);
  };
  send.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });
  document.querySelectorAll("[data-quick-chat]").forEach((button) => {
    button.addEventListener("click", async () => submitChat(button.dataset.quickChat, button.dataset.intent || ""));
  });
}

function dotsForLevel(level = "medium") {
  const active = level === "high" ? 4 : level === "medium" ? 3 : 2;
  return Array.from({ length: 4 }, (_, index) => `<i class="${index < active ? "active" : ""}"></i>`).join("");
}

function todoStatus(item) {
  if (item.status && item.status !== "待处理") return item.status;
  if (item.level === "high") return "今日处理";
  if (item.badge?.includes("9 天")) return "本周评估";
  if (item.badge?.includes("本周")) return "节点提醒";
  return "待处理";
}

function focusLevelFromEmployee(employee) {
  if (employee.level === "高风险" || employee.risk >= 75) return "high";
  if (employee.level === "中风险" || employee.risk >= 55) return "medium";
  return "low";
}

function focusPriority(employee) {
  if (employee.level === "高风险" || employee.risk >= 75) return "P1";
  if (employee.level === "中风险" || employee.risk >= 55) return "P2";
  return "P3";
}

function shouldShowInFocus(employee) {
  return ["高风险", "中风险"].includes(employee.level)
    || employee.risk >= 40
    || employee.modelRequired
    || ["待模型精算", "待分析"].includes(employee.analysisStatus);
}

function buildFocusQueue() {
  return archiveEmployees
    .filter(shouldShowInFocus)
    .map((employee) => {
      const relatedTodo = smartTodos.find((todo) => todo.employeeKey === employee.key);
      const evidence = employee.riskSignals?.length ? employee.riskSignals.map(signalText).filter(Boolean) : employee.evidence?.length ? employee.evidence : employee.riskFactors || [];
      return {
        id: `focus-${employee.key}`,
        todoId: relatedTodo?.id || "",
        employeeKey: employee.key,
        priority: relatedTodo?.priority || focusPriority(employee),
        title: relatedTodo?.title || employee.suggestedAction || employee.goal || "安排一次状态确认",
        badge: employee.level,
        summary: employee.reason || relatedTodo?.summary || "规则扫描未发现完整风险说明。",
        tags: evidence,
        level: relatedTodo?.level || focusLevelFromEmployee(employee),
        status: relatedTodo?.status || "",
      };
    })
    .sort((left, right) => (employees[right.employeeKey]?.risk || 0) - (employees[left.employeeKey]?.risk || 0));
}

function selectedFocusItem(items = buildFocusQueue()) {
  if (!selectedFocusId && items.length) selectedFocusId = items[0].id;
  if (selectedFocusId && !items.some((item) => item.id === selectedFocusId)) selectedFocusId = items[0]?.id || "";
  return items.find((item) => item.id === selectedFocusId) || items[0];
}

function renderFocusDetail(item) {
  const detail = document.querySelector("[data-focus-detail]");
  if (!detail) return;
  if (!item) {
    detail.innerHTML = `<div class="empty-detail"><i data-lucide="check-circle-2"></i><h2>暂无重点风险</h2><p>补充员工档案和沟通记录后，系统会在这里生成关注对象。</p></div>`;
    initIcons();
    return;
  }
  const employeeKey = employees[item.employeeKey] ? item.employeeKey : Object.keys(employees)[0];
  const employee = employees[employeeKey] || {};
  const profile = profileFallbacks[employeeKey] || {};
  const insights = (currentBrief.insights || []).slice(0, 2);
  detail.innerHTML = `
    <div class="focus-detail-hero ${escapeHtml(item.level || "medium")}">
      <span>${escapeHtml(item.priority || "P-")}</span>
      <div>
        <strong>${escapeHtml(employee.name || item.employeeKey || "未关联员工")}</strong>
        <small>${escapeHtml(employee.role || "员工画像待补充")}</small>
      </div>
      <em>${escapeHtml(todoStatus(item))}</em>
    </div>
    <section class="focus-brief-card">
      <span>管理判断</span>
      <p>${escapeHtml(item.summary || profile.riskSummary || employee.reason || "暂无足够数据，请补充沟通记录后分析。")}</p>
    </section>
    <section class="focus-mini-grid">
      <div><span>风险等级</span><strong>${escapeHtml(todoLevelLabel(item.level))}</strong></div>
      <div><span>处理状态</span><strong>${escapeHtml(todoStatus(item))}</strong></div>
    </section>
    <section class="focus-evidence">
      <span>风险依据</span>
      <div>${(item.tags || employee.evidence || []).slice(0, 4).map((tag) => `<b>${escapeHtml(tag)}</b>`).join("") || "<b>待补充</b>"}</div>
    </section>
    <section class="focus-brief-card">
      <span>下一步动作</span>
      <p>${escapeHtml(item.title || profile.suggestedAction || employee.goal || "安排一次 1 对 1 沟通。")}</p>
    </section>
    <div class="focus-insights">
      ${insights.map((insight) => `<div><span>${escapeHtml(insight.label)}</span><strong>${escapeHtml(insight.value)}</strong></div>`).join("")}
    </div>
    <div class="focus-detail-actions">
      <button type="button" data-focus-open="${escapeHtml(employeeKey)}"><i data-lucide="panel-right-open"></i><span>查看画像</span></button>
      <button type="button" data-focus-outline="${escapeHtml(employeeKey)}"><i data-lucide="wand-sparkles"></i><span>生成提纲</span></button>
      <button type="button" data-focus-workbench><i data-lucide="clipboard-list"></i><span>进入待办</span></button>
    </div>
  `;
  detail.querySelector("[data-focus-open]")?.addEventListener("click", (event) => openEmployeeDrawer(event.currentTarget.dataset.focusOpen, item.id, { editable: false }));
  detail.querySelector("[data-focus-outline]")?.addEventListener("click", (event) => generateOutlineInModal(event.currentTarget.dataset.focusOutline));
  detail.querySelector("[data-focus-workbench]")?.addEventListener("click", () => {
    selectedTodoId = item.todoId || item.id;
    showView("todo-workbench");
    document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === "todo-workbench"));
  });
  initIcons();
}

function renderRiskTable() {
  const table = document.querySelector("[data-risk-table]");
  const header = table.querySelector(".table-head");
  table.innerHTML = "";
  table.appendChild(header);
  const source = buildFocusQueue();
  selectedFocusItem(source);
  if (!source.length) {
    const row = document.createElement("div");
    row.className = "person-row loading-row";
    row.innerHTML = `<span class="person"><b>AI</b><em>暂无待办</em></span><span>当前没有重点风险项</span><span>可先补充沟通记录并运行 AI 分析</span><span class="status-pill">稳定</span>`;
    table.appendChild(row);
    renderFocusDetail(null);
    return;
  }
  source.forEach((item) => {
    const employeeKey = employees[item.employeeKey] ? item.employeeKey : Object.keys(employees)[0];
    if (!employeeKey) return;
    const employee = employees[employeeKey];
    const row = document.createElement("button");
    row.className = `person-row ${item.id === selectedFocusId ? "selected" : ""}`;
    row.type = "button";
    row.dataset.openEmployee = employeeKey;
    row.innerHTML = `<span class="person"><b>${escapeHtml(employee.name.slice(0, 1))}</b><em>${escapeHtml(employee.name)}</em><small>${escapeHtml(item.priority || todoLevelLabel(item.level))}</small></span><span>${escapeHtml((item.tags || []).slice(0, 2).join("、") || item.summary || employee.reason)}</span><span>${escapeHtml(item.title || employee.goal)}</span><span class="status-pill ${escapeHtml(item.level || "medium")}">${escapeHtml(todoStatus(item))}</span>`;
    row.addEventListener("click", () => {
      selectedFocusId = item.id;
      renderRiskTable(source);
    });
    row.addEventListener("dblclick", () => openEmployeeDrawer(employeeKey, item.todoId || item.id, { editable: false }));
    table.appendChild(row);
  });
  renderFocusDetail(selectedFocusItem(source));
}

function statusClass(status = "待处理") {
  if (status === "已完成") return "done";
  if (status === "处理中") return "active";
  if (status === "已忽略") return "muted";
  return "open";
}

function todoLevelLabel(level = "medium") {
  if (level === "high") return "高风险";
  if (level === "low") return "低风险";
  return "中风险";
}

function todoById(todoId) {
  return smartTodos.find((item) => item.id === todoId);
}

function renderTodoWorkbench() {
  const list = document.querySelector("[data-todo-list]");
  const count = document.querySelector("[data-todo-count]");
  if (!list) return;
  const items = smartTodos || [];
  if (count) count.textContent = `${items.length} 项`;
  const firstOpen = items.find((item) => !["已完成", "已忽略"].includes(item.status)) || items[0];
  if (!selectedTodoId && items.length) selectedTodoId = firstOpen.id;
  if (selectedTodoId && !todoById(selectedTodoId)) selectedTodoId = firstOpen?.id || "";
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<div class="todo-empty">暂无待办，可先补充员工沟通记录或运行 AI 分析。</div>`;
    renderTodoDetail(null);
    return;
  }
  const groups = [
    { title: "今日待办", hint: "需要处理或开始的事项", items: items.filter((item) => !item.status || item.status === "待处理") },
    { title: "处理中", hint: "已经进入跟进中的事项", items: items.filter((item) => item.status === "处理中") },
    { title: "历史待办", hint: "已完成或已忽略的事项", items: items.filter((item) => ["已完成", "已忽略"].includes(item.status)) },
  ].filter((group) => group.items.length);
  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "todo-group";
    section.innerHTML = `<div class="todo-group-title"><strong>${escapeHtml(group.title)}</strong><small>${escapeHtml(group.hint)} · ${group.items.length} 项</small></div>`;
    group.items.forEach((item) => {
    const employee = employees[item.employeeKey] || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = `todo-card ${item.id === selectedTodoId ? "selected" : ""} ${statusClass(item.status)}`;
    button.innerHTML = `
      <span class="todo-priority ${escapeHtml(item.level || "medium")}">${escapeHtml(item.priority || "P-")}</span>
      <strong>${escapeHtml(item.title || "待办动作")}</strong>
      <small>${escapeHtml(employee.name || item.employeeKey || "未关联员工")} · ${escapeHtml(todoLevelLabel(item.level))}</small>
      <em>${escapeHtml(item.status || "待处理")}</em>
    `;
    button.addEventListener("click", () => {
      selectedTodoId = item.id;
      renderTodoWorkbench();
    });
      section.appendChild(button);
    });
    list.appendChild(section);
  });
  renderTodoDetail(todoById(selectedTodoId));
  initIcons();
}

function renderTodoDetail(item) {
  const panel = document.querySelector("[data-todo-detail]");
  if (!panel) return;
  if (!item) {
    panel.innerHTML = `<div class="empty-detail"><i data-lucide="mouse-pointer-click"></i><h2>选择一项待办</h2><p>这里会展示员工风险、建议动作和完成闭环入口。</p></div>`;
    initIcons();
    return;
  }
  const employee = employees[item.employeeKey] || {};
  const records = communicationRecords.filter((record) => record.employeeKey === item.employeeKey || record.employee === employee.name).slice(0, 3);
  const nextBestAction = item.title || employee.suggestedAction || employee.goal || "安排一次状态确认，并记录下一步跟进动作。";
  panel.innerHTML = `
    <div class="todo-detail-head">
      <div>
        <p class="eyebrow">Selected Action</p>
        <h2>${escapeHtml(item.title)}</h2>
      </div>
      <span class="status-pill ${escapeHtml(item.level || "medium")}">${escapeHtml(item.status || "待处理")}</span>
    </div>
    <div class="todo-person-strip">
      <b>${escapeHtml((employee.name || "?").slice(0, 1))}</b>
      <div><strong>${escapeHtml(employee.name || "未关联员工")}</strong><span>${escapeHtml(employee.role || "暂无职务信息")}</span></div>
      <button type="button" data-todo-open-employee><i data-lucide="user-round-search"></i><span>查看画像</span></button>
    </div>
    <section class="todo-glass-section">
      <h3>风险依据</h3>
      <p>${escapeHtml(item.summary || employee.reason || "暂无风险摘要")}</p>
      <div class="drawer-tags">${(item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    </section>
    <section class="todo-glass-section next-action-section">
      <h3>下一步最佳动作</h3>
      <p>${escapeHtml(nextBestAction)}</p>
      <small>${escapeHtml(employee.name || "该员工")}当前处于${escapeHtml(todoLevelLabel(item.level))}，建议先完成这一步再复评风险。</small>
    </section>
    <section class="todo-glass-section">
      <h3>最近沟通</h3>
      <div class="mini-records">${records.length ? records.map((record) => `<div><strong>${escapeHtml(record.date || "-")} · ${escapeHtml(record.type || "-")}</strong><span>${escapeHtml(record.summary || "-")}</span></div>`).join("") : "<p>暂无沟通记录，建议先完成一次管理沟通。</p>"}</div>
    </section>
    <div class="todo-actions">
      <button type="button" data-todo-status="处理中"><i data-lucide="play-circle"></i><span>开始处理</span></button>
      <button type="button" data-todo-outline><i data-lucide="wand-sparkles"></i><span>生成提纲</span></button>
      <button type="button" data-todo-complete><i data-lucide="check-circle-2"></i><span>记录沟通并完成</span></button>
      <button type="button" data-todo-status="已忽略"><i data-lucide="circle-slash"></i><span>忽略</span></button>
      <button type="button" class="danger-action" data-todo-delete><i data-lucide="trash-2"></i><span>删除</span></button>
    </div>
  `;
  panel.querySelector("[data-todo-open-employee]")?.addEventListener("click", () => openEmployeeDrawer(item.employeeKey, item.id, { editable: false }));
  panel.querySelector("[data-todo-outline]")?.addEventListener("click", () => generateOutlineInModal(item.employeeKey));
  panel.querySelector("[data-todo-complete]")?.addEventListener("click", () => openEmployeeDrawer(item.employeeKey, item.id, { editable: false }));
  panel.querySelectorAll("[data-todo-status]").forEach((button) => {
    button.addEventListener("click", () => updateTodoStatus(item.id, button.dataset.todoStatus));
  });
  panel.querySelector("[data-todo-delete]")?.addEventListener("click", () => deleteTodo(item.id));
  initIcons();
}

async function updateTodoStatus(todoId, status) {
  if (!todoId || !status) return;
  try {
    const result = await postJson("/api/todos/status", { todoId, status });
    if (result.archive) applyArchivePayload(result.archive);
  } catch {
    const item = todoById(todoId);
    if (item) item.status = status;
    renderTodoWorkbench();
    renderRiskTable(smartTodos);
  }
}

async function deleteTodo(todoId) {
  if (!todoId) return;
  const item = todoById(todoId);
  if (!confirm(`确定删除待办「${item?.title || todoId}」吗？`)) return;
  try {
    const result = await postJson("/api/todos/delete", { todoId });
    selectedTodoId = "";
    if (result.archive) applyArchivePayload(result.archive);
  } catch {
    smartTodos = smartTodos.filter((todo) => todo.id !== todoId);
    selectedTodoId = "";
    renderTodoWorkbench();
    renderRiskTable(smartTodos);
  }
}

async function loadRiskTable() {
  try {
    const result = await postJson("/api/todos");
    smartTodos = result.items || smartTodos;
    renderRiskTable(smartTodos);
    renderTodoWorkbench();
    updateAgentFeedFromState("AI 已重新编排智能待办和关注队列。");
    loadMetrics();
  } catch {
    renderRiskTable(smartTodos);
    renderTodoWorkbench();
  }
}

function renderEmployeeProfile(employeeKey, profile) {
  document.querySelector("[data-drawer-reason]").textContent = profile.riskSummary;
  document.querySelector("[data-drawer-performance]").textContent = profile.performance;
  document.querySelector("[data-drawer-attendance]").textContent = profile.attendance;
  document.querySelector("[data-drawer-communication]").textContent = profile.communication;
  document.querySelector("[data-drawer-action]").textContent = profile.suggestedAction;
  document.querySelector("[data-drawer-lifecycle-stage]").textContent = profile.lifecycleStage;
  document.querySelector("[data-drawer-lifecycle-detail]").textContent = profile.lifecycleDetail;
  const evidence = document.querySelector("[data-drawer-evidence]");
  evidence.innerHTML = "";
  (profile.evidence || []).forEach((item) => {
    const tag = document.createElement("span");
    tag.textContent = item;
    evidence.appendChild(tag);
  });
}

function latestCommunicationForEmployee(employee) {
  return communicationRecords
    .filter((record) => record.employeeKey === employee.key || record.employee === employee.name)
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))[0];
}

function employeeStage(employee) {
  return employee.lifecycle?.stage || employee.lifecycleStage || profileFallbacks[employee.key]?.lifecycleStage || "待分析";
}

function riskClass(employee) {
  if (employee.level === "高风险" || employee.risk >= 75) return "high";
  if (employee.level === "中风险" || employee.risk >= 55) return "medium";
  if (employee.level === "低风险" || employee.risk >= 40) return "low";
  return "normal";
}

function drawerField(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "待补充")}</strong></div>`;
}

function editableDrawerField(label, value, key, multiline = false, editable = true) {
  if (!editable) return drawerField(label, value);
  return `<div class="drawer-edit-card">
    <span>${escapeHtml(label)}</span>
    <strong class="editable-cell drawer-editable ${multiline ? "multiline" : ""}" contenteditable="true" spellcheck="false" data-edit-entity="employee" data-edit-key="${escapeHtml(key)}">${escapeHtml(value || "")}</strong>
  </div>`;
}

function drawerEventItem(title, detail) {
  return `<div class="drawer-list-item"><strong>${escapeHtml(title || "未命名事项")}</strong><span>${escapeHtml(detail || "暂无补充说明")}</span></div>`;
}

function renderDrawerArchiveDetails(employeeKey, activeTab = "basic") {
  const employee = employees[employeeKey];
  const tabs = document.querySelector("[data-drawer-profile-tabs]");
  const detail = document.querySelector("[data-drawer-profile-detail]");
  if (!employee || !tabs || !detail) return;
  const editable = document.querySelector("[data-employee-drawer]")?.dataset.editable === "true";
  const latestRecord = latestCommunicationForEmployee(employee);
  const tabItems = [
    { key: "basic", label: "基本信息" },
    { key: "performance", label: "绩效" },
    { key: "growth", label: "成长" },
    { key: "awards", label: "获奖" },
    { key: "attendance", label: "考勤" },
    { key: "events", label: "关键事件" }
  ];
  tabs.innerHTML = tabItems.map((item) => `<button class="${item.key === activeTab ? "active" : ""}" type="button" data-drawer-profile-tab="${escapeHtml(item.key)}">${escapeHtml(item.label)}</button>`).join("");
  const panels = {
    basic: `<div class="drawer-profile-grid">
      ${editableDrawerField("姓名", employee.name, "name", false, editable)}
      ${editableDrawerField("工号", employee.employeeId, "employeeId", false, editable)}
      ${editableDrawerField("部门", employee.department, "department", false, editable)}
      ${editableDrawerField("岗位", employee.role, "role", false, editable)}
      ${editableDrawerField("入职日期", employee.hireDate, "hireDate", false, editable)}
      ${editableDrawerField("直属主管", employee.manager, "manager", false, editable)}
      ${drawerField("最近沟通", latestRecord?.date)}
      ${editableDrawerField("合同到期", employee.contractEndDate, "contractEndDate", false, editable)}
      ${editableDrawerField("转正日期", employee.probationEndDate, "probationEndDate", false, editable)}
    </div>`,
    performance: `<div class="drawer-profile-grid">
      ${editableDrawerField("当前绩效", employee.performanceRating, "performanceRating", false, editable)}
      ${editableDrawerField("绩效趋势", employee.performanceTrend, "performanceTrend", false, editable)}
      ${editableDrawerField("目标完成率", employee.goalCompletionRate, "goalCompletionRate", false, editable)}
      ${drawerField("AI 绩效判断", employee.performance)}
    </div>`,
    growth: `<div class="drawer-profile-grid">
      ${drawerField("生命周期阶段", employeeStage(employee))}
      ${editableDrawerField("导师", employee.mentor, "mentor", false, editable)}
      ${editableDrawerField("成长摘要", employee.growthSummary, "growthSummary", true, editable)}
      ${drawerField("建议动作", employee.suggestedAction || employee.goal)}
    </div>`,
    awards: `<div class="drawer-profile-grid">
      ${editableDrawerField("获奖摘要", employee.awardsSummary, "awardsSummary", true, editable)}
      ${drawerField("正向记录", employee.awardsSummary || "暂无获奖记录")}
    </div>`,
    attendance: `<div class="drawer-profile-grid">
      ${editableDrawerField("30天加班", employee.overtimeHours30d, "overtimeHours30d", false, editable)}
      ${editableDrawerField("30天迟到", employee.lateCount30d, "lateCount30d", false, editable)}
      ${editableDrawerField("30天请假", employee.leaveDays30d, "leaveDays30d", false, editable)}
      ${drawerField("AI 考勤判断", employee.attendance)}
    </div>`,
    events: `<div class="drawer-list">
      ${editable ? `<div class="drawer-edit-card wide">
        <span>备注/关键事件</span>
        <strong class="editable-cell drawer-editable multiline" contenteditable="true" spellcheck="false" data-edit-entity="employee" data-edit-key="keyEvents">${escapeHtml(employee.keyEvents || "")}</strong>
      </div>` : drawerEventItem("备注/关键事件", employee.keyEvents || "暂无补充说明")}
      ${drawerEventItem("风险原因", employee.reason)}
      ${drawerEventItem("最近沟通", latestRecord ? `${latestRecord.date} · ${latestRecord.summary}` : "暂无沟通记录")}
    </div>`
  };
  detail.innerHTML = panels[activeTab] || panels.basic;
  detail.querySelectorAll("[data-edit-entity='employee']").forEach((cell) => {
    cell.dataset.rowKey = employeeKey;
  });
  if (editable) bindEditableCells(detail);
  tabs.querySelectorAll("[data-drawer-profile-tab]").forEach((button) => {
    button.addEventListener("click", () => renderDrawerArchiveDetails(employeeKey, button.dataset.drawerProfileTab));
  });
}

function renderDrawerWorkflow(employeeKey) {
  const employee = employees[employeeKey];
  const todoBox = document.querySelector("[data-drawer-todos]");
  const recordBox = document.querySelector("[data-drawer-records]");
  if (!employee || !todoBox || !recordBox) return;
  const relatedTodos = smartTodos.filter((item) => item.employeeKey === employeeKey);
  const relatedRecords = communicationRecords.filter((record) => record.employeeKey === employeeKey || record.employee === employee.name).slice(0, 5);
  todoBox.innerHTML = relatedTodos.length
    ? relatedTodos.map((item) => `<div class="drawer-list-item"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.priority || "-")} · ${escapeHtml(item.status || "待处理")}</span></div>`).join("")
    : `<div class="drawer-list-item muted"><strong>暂无关联待办</strong><span>可从 Agent 或待办工作台生成。</span></div>`;
  recordBox.innerHTML = relatedRecords.length
    ? relatedRecords.map((record) => `<div class="drawer-list-item"><strong>${escapeHtml(record.date || "-")} · ${escapeHtml(record.type || "-")}</strong><span>${escapeHtml(record.summary || "-")}</span></div>`).join("")
    : `<div class="drawer-list-item muted"><strong>暂无沟通记录</strong><span>记录一次沟通后会自动进入历史。</span></div>`;
}

async function openEmployeeDrawer(employeeKey, todoId = "", options = {}) {
  const employee = employees[employeeKey];
  if (!employee) return;
  const drawer = document.querySelector("[data-employee-drawer]");
  const editable = options.editable === true;
  drawer.dataset.employee = employeeKey;
  drawer.dataset.todo = todoId || selectedTodoId || "";
  drawer.dataset.editable = editable ? "true" : "false";
  document.querySelector("[data-drawer-name]").textContent = employee.name;
  document.querySelector("[data-drawer-role]").textContent = employee.role;
  document.querySelector("[data-drawer-level]").textContent = employee.level;
  document.querySelector("[data-drawer-save-edits]")?.toggleAttribute("hidden", !editable);
  document.querySelector("[data-drawer-analyze]")?.toggleAttribute("hidden", !editable);
  renderEmployeeProfile(employeeKey, profileFallbacks[employeeKey]);
  renderDrawerArchiveDetails(employeeKey);
  renderDrawerWorkflow(employeeKey);
  document.body.classList.add("drawer-open");
  drawer.setAttribute("aria-hidden", "false");
  try {
    const profile = await postJson("/api/profile", { employeeKey });
    renderEmployeeProfile(employeeKey, { ...profileFallbacks[employeeKey], ...profile });
  } catch {
    renderEmployeeProfile(employeeKey, profileFallbacks[employeeKey]);
  }
}

function closeEmployeeDrawer() {
  document.body.classList.remove("drawer-open");
  document.querySelector("[data-employee-drawer]")?.setAttribute("aria-hidden", "true");
}

function renderOutline(employeeKey, lines, source = "本地智能模板") {
  const employee = employees[employeeKey];
  if (!employee) return;
  document.querySelector("[data-outline-title]").textContent = `${employee.name} 1 对 1 沟通提纲`;
  document.querySelector("[data-outline-source]").textContent = source;
  document.querySelector("[data-outline-output]").innerHTML = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
}

function openOutlineModal() {
  document.body.classList.add("outline-open");
  document.querySelector("[data-outline-modal]")?.setAttribute("aria-hidden", "false");
}

function closeOutlineModal() {
  document.body.classList.remove("outline-open");
  document.querySelector("[data-outline-modal]")?.setAttribute("aria-hidden", "true");
}

function openEmployeeModal() {
  document.querySelector("[data-employee-modal]")?.setAttribute("aria-hidden", "false");
  initIcons();
}

function closeEmployeeModal() {
  document.querySelector("[data-employee-modal]")?.setAttribute("aria-hidden", "true");
}

function openCommunicationModal() {
  document.querySelector("[data-communication-modal]")?.setAttribute("aria-hidden", "false");
  initIcons();
}

function closeCommunicationModal() {
  document.querySelector("[data-communication-modal]")?.setAttribute("aria-hidden", "true");
}

async function generateOutlineInModal(employeeKey) {
  if (!employeeKey || !employees[employeeKey]) return;
  openOutlineModal();
  renderOutline(employeeKey, ["正在读取员工风险原因、近期事件和建议目标..."], "生成中");
  try {
    const result = await postJson("/api/outline", { employeeKey });
    renderOutline(employeeKey, result.lines || ["请先补充员工信息和沟通记录。"], result.source || "DeepSeek");
  } catch {
    renderOutline(employeeKey, ["先确认员工当前状态。", "补充近期沟通记录。", "明确下一步管理动作。"], "本地智能模板");
  }
}

function showView(viewName) {
  document.querySelectorAll("[data-view]").forEach((view) => {
    const active = view.dataset.view === viewName;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
  if (viewName === "todo-workbench") renderTodoWorkbench();
}

function setArchiveTab(tabName) {
  document.querySelectorAll("[data-archive-tab]").forEach((button) => {
    const active = button.dataset.archiveTab === tabName;
    button.classList.toggle("active", active);
  });
  document.querySelectorAll("[data-archive-panel]").forEach((panel) => {
    const active = panel.dataset.archivePanel === tabName;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function editableCell(value, entity, key, multiline = false) {
  return `<span class="editable-cell ${multiline ? "multiline" : ""}" contenteditable="true" spellcheck="false" data-edit-entity="${entity}" data-edit-key="${key}">${escapeHtml(value || "")}</span>`;
}

function bindEditableCells(scope) {
  scope.querySelectorAll("[data-edit-entity]").forEach((cell) => {
    cell.dataset.originalValue = cell.textContent.trim();
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        cell.blur();
      }
      if (event.key === "Escape") {
        cell.textContent = cell.dataset.originalValue || "";
        cell.blur();
      }
    });
    cell.addEventListener("blur", () => handleEditableCellBlur(cell));
  });
}

function setEmployeeSaveState() {
  const count = Object.keys(pendingEmployeeEdits).length;
  document.querySelectorAll("[data-save-employee-edits], [data-drawer-save-edits]").forEach((button) => {
    button.disabled = count === 0;
    button.querySelector("span").textContent = count ? `保存修改(${count})` : "保存修改";
  });
}

async function handleEditableCellBlur(cell) {
  const value = cell.textContent.trim();
  if (value === (cell.dataset.originalValue || "")) return;
  if (cell.dataset.editEntity === "employee") {
    markEmployeeCellDirty(cell, value);
    return;
  }
  cell.classList.add("saving");
  try {
    await saveCommunicationCell(cell.dataset.rowKey, cell.dataset.editKey, value);
    cell.dataset.originalValue = value;
    cell.classList.remove("error");
  } catch {
    cell.classList.add("error");
  } finally {
    cell.classList.remove("saving");
  }
}

function markEmployeeCellDirty(cell, value) {
  const employeeKey = cell.dataset.rowKey;
  const field = cell.dataset.editKey;
  const current = archiveEmployees.find((employee) => employee.key === employeeKey);
  if (!current) return;
  const updated = { ...current, [field]: value };
  archiveEmployees = archiveEmployees.map((employee) => employee.key === employeeKey ? updated : employee);
  pendingEmployeeEdits[employeeKey] = updated;
  cell.classList.add("dirty");
  syncEmployeesFromArchive(archiveEmployees);
  if (document.querySelector("[data-employee-drawer]")?.dataset.employee === employeeKey) {
    const employee = employees[employeeKey];
    document.querySelector("[data-drawer-name]").textContent = employee.name || "员工姓名";
    document.querySelector("[data-drawer-role]").textContent = employee.role || "岗位待补充";
    renderArchiveEmployees();
  }
  setEmployeeSaveState();
}

async function savePendingEmployeeChanges() {
  const updates = Object.values(pendingEmployeeEdits);
  if (!updates.length) return;
  document.querySelectorAll("[data-save-employee-edits], [data-drawer-save-edits]").forEach((item) => {
    item.disabled = true;
    item.querySelector("span").textContent = "保存中";
  });
  try {
    for (const employee of updates) {
      const result = await postJson("/api/employees", { employee });
      if (result.archive) applyArchivePayload(result.archive);
    }
    pendingEmployeeEdits = {};
    document.querySelectorAll('.editable-cell.dirty[data-edit-entity="employee"]').forEach((cell) => {
      cell.dataset.originalValue = cell.textContent.trim();
      cell.classList.remove("dirty", "error");
    });
    await loadBrief();
  } catch {
    document.querySelectorAll('.editable-cell.dirty[data-edit-entity="employee"]').forEach((cell) => cell.classList.add("error"));
  } finally {
    setEmployeeSaveState();
  }
}

async function deleteEmployee(employeeKey) {
  const employee = employees[employeeKey] || archiveEmployees.find((item) => item.key === employeeKey);
  if (!employeeKey || !employee) return;
  if (!confirm(`确定删除员工「${employee.name}」吗？关联待办和沟通记录也会一起删除。`)) return;
  try {
    const result = await postJson("/api/employees/delete", { employeeKey });
    selectedTodoId = "";
    selectedFocusId = "";
    if (result.archive) applyArchivePayload(result.archive);
    await loadBrief();
  } catch {
    archiveEmployees = archiveEmployees.filter((item) => item.key !== employeeKey);
    communicationRecords = communicationRecords.filter((record) => record.employeeKey !== employeeKey && record.employee !== employee.name);
    smartTodos = smartTodos.filter((todo) => todo.employeeKey !== employeeKey);
    syncEmployeesFromArchive(archiveEmployees);
    renderArchive();
  }
}

async function saveCommunicationCell(recordId, field, value) {
  const current = communicationRecords.find((record) => String(record.id) === String(recordId));
  if (!current) return;
  const updated = { ...current, [field]: value };
  communicationRecords = communicationRecords.map((record) => String(record.id) === String(recordId) ? updated : record);
  const result = await postJson("/api/communication/update", { recordId, record: updated });
  if (result.archive) applyArchivePayload(result.archive);
}

function renderArchiveEmployees() {
  const table = document.querySelector("[data-employee-table]");
  if (!table) return;
  document.querySelector("[data-employee-count]").textContent = `${archiveEmployees.length} 人`;
  table.innerHTML = `<div class="archive-row archive-row-head archive-employee-row"><span>姓名</span><span>工号</span><span>部门</span><span>岗位</span><span>阶段</span><span>风险等级</span><span>最近沟通</span><span>操作</span></div>${archiveEmployees.map((employee) => {
    const latestRecord = latestCommunicationForEmployee(employee);
    const level = employee.level || "待分析";
    return `<div class="archive-row archive-employee-row" data-row-key="${escapeHtml(employee.key)}" title="双击查看员工画像">
      <span class="archive-person"><strong>${escapeHtml(employee.name || "未命名")}</strong></span>
      <span>${escapeHtml(employee.employeeId || "待补充")}</span>
      <span>${escapeHtml(employee.department || "待补充")}</span>
      <span>${escapeHtml(employee.role || "待补充")}</span>
      <span class="stage-pill">${escapeHtml(employeeStage(employee))}</span>
      <span class="status-pill ${escapeHtml(riskClass(employee))}">${escapeHtml(level)}</span>
      <span>${escapeHtml(latestRecord?.date || "暂无")}</span>
      <span class="row-actions"><button class="mini-action danger-action" type="button" data-delete-employee="${escapeHtml(employee.key)}"><i data-lucide="trash-2"></i><span>删除</span></button></span>
    </div>`;
  }).join("")}`;
  table.querySelectorAll(".archive-employee-row[data-row-key]").forEach((row) => {
    row.addEventListener("dblclick", (event) => {
      if (event.target.closest("button")) return;
      openEmployeeDrawer(row.dataset.rowKey, "", { editable: true });
    });
  });
  table.querySelectorAll("[data-delete-employee]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteEmployee(button.dataset.deleteEmployee);
    });
  });
  initIcons();
}

function renderCommunicationRecords() {
  const table = document.querySelector("[data-communication-table]");
  if (!table) return;
  document.querySelector("[data-communication-count]").textContent = `${communicationRecords.length} 条`;
  table.innerHTML = `<div class="archive-row archive-row-head communication"><span>员工</span><span>日期</span><span>沟通摘要</span></div>${communicationRecords.map((record) => `<div class="archive-row communication" data-row-key="${escapeHtml(record.id)}">${editableCell(record.employee || "", "communication", "employee")}${editableCell(record.date || "", "communication", "date")}${editableCell(record.summary || "", "communication", "summary", true)}</div>`).join("")}`;
  table.querySelectorAll("[data-edit-entity]").forEach((cell) => {
    cell.dataset.rowKey = cell.closest("[data-row-key]")?.dataset.rowKey || "";
  });
  bindEditableCells(table);
}

function updateCommunicationEmployeeOptions() {
  const options = document.querySelector("[data-employee-name-options]");
  if (!options) return;
  options.innerHTML = archiveEmployees.map((employee) => `<option value="${escapeHtml(employee.name)}"></option>`).join("");
}

function renderArchive() {
  renderArchiveEmployees();
  renderCommunicationRecords();
  updateCommunicationEmployeeOptions();
  initIcons();
  refreshDashboardMetrics();
  renderTodoWorkbench();
}

async function analyzeEmployee(employeeKey, trigger) {
  if (!employeeKey) return;
  const previousText = trigger?.textContent;
  if (trigger) {
    trigger.disabled = true;
    trigger.textContent = "分析中";
  }
  try {
    const result = await postJson("/api/analyze", { employeeKey });
    applyArchivePayload(result.archive);
    if (result.employee) {
      syncEmployeesFromArchive([...(archiveEmployees.filter((item) => item.key !== result.employee.key)), result.employee]);
    }
    openEmployeeDrawer(employeeKey, "", { editable: true });
  } catch {
    if (trigger) trigger.textContent = previousText || "AI分析";
  } finally {
    if (trigger) trigger.disabled = false;
  }
}

async function completeDrawerCommunication(event) {
  event.preventDefault();
  const drawer = document.querySelector("[data-employee-drawer]");
  const employeeKey = drawer?.dataset.employee || "";
  const employee = employees[employeeKey];
  if (!employee) return;
  const form = new FormData(event.currentTarget);
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  const record = {
    employeeKey,
    employee: employee.name,
    date: form.get("date") || new Date().toISOString().slice(0, 10),
    type: form.get("type"),
    summary: form.get("summary") || `已完成${employee.name}的管理沟通。`,
    action: form.get("action") || "持续跟进沟通结论"
  };
  const todoId = drawer.dataset.todo || selectedTodoId || "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = "闭环中";
  }
  try {
    const result = await postJson("/api/communication/complete", { record, todoId });
    event.currentTarget.reset();
    if (result.archive) applyArchivePayload(result.archive);
    renderDrawerWorkflow(employeeKey);
    await loadBrief();
  } catch {
    communicationRecords.unshift(record);
    smartTodos = smartTodos.map((item) => item.id === todoId || item.employeeKey === employeeKey ? { ...item, status: "已完成" } : item);
    renderArchive();
    renderRiskTable(smartTodos);
    renderDrawerWorkflow(employeeKey);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "记录并完成待办";
    }
  }
}

function parseCsv(text) {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) return [];
  const headers = rows[0].split(",").map((item) => item.trim());
  return rows.slice(1).map((row) => {
    const values = row.split(",").map((item) => item.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function normalizeEmployeeRecord(row) {
  const name = row.name || row.姓名 || row["员工姓名"];
  if (!name) return null;
  return {
    key: slugifyName(name),
    name,
    employeeId: row.employeeId || row.工号 || row["员工编号"] || "",
    department: row.department || row.部门 || "",
    role: row.role || row.职务 || row.岗位 || row.职位 || "",
    jobLevel: row.jobLevel || row.职级 || row["岗位职级"] || "",
    hireDate: row.hireDate || row.入职时间 || row["入职日期"] || "",
    manager: row.manager || row.直属主管 || row.主管 || "",
    performanceRating: row.performanceRating || row.当前绩效 || row["绩效等级"] || "",
    performanceTrend: row.performanceTrend || row.绩效趋势 || "",
    goalCompletionRate: row.goalCompletionRate || row.目标完成率 || "",
    overtimeHours30d: row.overtimeHours30d || row["30天加班小时"] || row.加班小时 || "",
    lateCount30d: row.lateCount30d || row["30天迟到次数"] || row.迟到次数 || "",
    leaveDays30d: row.leaveDays30d || row["30天请假天数"] || row.请假天数 || "",
    contractEndDate: row.contractEndDate || row.合同到期 || row["合同到期日"] || "",
    probationEndDate: row.probationEndDate || row.转正日期 || row["试用期结束日"] || "",
    mentor: row.mentor || row.导师 || "",
    growthSummary: row.growthSummary || row.成长摘要 || row.成长信息 || "",
    awardsSummary: row.awardsSummary || row.奖励摘要 || row.获奖信息 || "",
    keyEvents: row.keyEvents || row.备注 || row.关键事件 || "",
    compensationSignal: row.compensationSignal || row.薪酬信号 || row.薪酬风险 || "",
    lifecycle: "待分析",
    level: "待分析"
  };
}

async function importEmployeeRows(rows) {
  const normalized = rows.map(normalizeEmployeeRecord).filter(Boolean);
  if (!normalized.length) return;
  try {
    const result = await postJson("/api/employees/import", { employees: normalized });
    applyArchivePayload(result.archive);
  } catch {
    normalized.forEach((record) => {
      const index = archiveEmployees.findIndex((item) => item.name === record.name || (record.employeeId && item.employeeId === record.employeeId));
      if (index >= 0) archiveEmployees[index] = { ...archiveEmployees[index], ...record };
      else archiveEmployees.push(record);
    });
    renderArchive();
  }
}

async function handleEmployeeUpload(file) {
  if (!file) return;
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "csv") {
    await importEmployeeRows(parseCsv(await file.text()));
    return;
  }
  if (window.XLSX) {
    const data = await file.arrayBuffer();
    const workbook = window.XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    await importEmployeeRows(window.XLSX.utils.sheet_to_json(sheet));
    return;
  }
  alert("Excel 解析库加载失败，请先将表格另存为 CSV 后上传。");
}

function activateArchive() {
  document.querySelectorAll("[data-archive-tab]").forEach((button) => {
    button.addEventListener("click", () => setArchiveTab(button.dataset.archiveTab));
  });
  document.querySelector("[data-employee-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = event.currentTarget.querySelector("button[type='submit']");
    const form = new FormData(event.currentTarget);
    const name = form.get("name");
    const employee = {
      key: slugifyName(name),
      name,
      employeeId: form.get("employeeId"),
      department: form.get("department"),
      role: form.get("role"),
      hireDate: form.get("hireDate"),
      manager: form.get("manager"),
      performanceRating: form.get("performanceRating"),
      overtimeHours30d: form.get("overtimeHours30d"),
      lateCount30d: form.get("lateCount30d"),
      leaveDays30d: form.get("leaveDays30d"),
      contractEndDate: form.get("contractEndDate"),
      probationEndDate: form.get("probationEndDate"),
      mentor: form.get("mentor"),
      growthSummary: form.get("growthSummary"),
      awardsSummary: form.get("awardsSummary"),
      keyEvents: form.get("keyEvents"),
      lifecycle: "待分析",
      level: "待分析"
    };
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.querySelector("span").textContent = "新增中";
    }
    const existingIndex = archiveEmployees.findIndex((item) => item.key === employee.key || item.employeeId === employee.employeeId);
    if (existingIndex >= 0) archiveEmployees[existingIndex] = { ...archiveEmployees[existingIndex], ...employee };
    else archiveEmployees.unshift(employee);
    renderArchive();
    try {
      const result = await postJson("/api/employees", { employee });
      event.currentTarget.reset();
      closeEmployeeModal();
      if (result.archive) applyArchivePayload(result.archive);
      await loadArchive();
    } catch {
      renderArchive();
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.querySelector("span").textContent = "新增员工";
      }
    }
  });
  document.querySelector("[data-communication-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = event.currentTarget.querySelector("button[type='submit']");
    const form = new FormData(event.currentTarget);
    const record = {
      employee: form.get("employee"),
      date: form.get("date") || new Date().toISOString().slice(0, 10),
      type: "",
      summary: form.get("summary"),
      action: ""
    };
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.querySelector("span").textContent = "记录中";
    }
    communicationRecords.unshift(record);
    renderArchive();
    try {
      const result = await postJson("/api/communication", { record });
      event.currentTarget.reset();
      closeCommunicationModal();
      if (result.archive) applyArchivePayload(result.archive);
      await loadArchive();
    } catch {
      renderArchive();
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.querySelector("span").textContent = "记录沟通";
      }
    }
  });
  document.querySelector("[data-employee-upload]")?.addEventListener("change", async (event) => {
    await handleEmployeeUpload(event.target.files[0]);
    event.target.value = "";
  });
  document.querySelector("[data-open-employee-modal]")?.addEventListener("click", openEmployeeModal);
  document.querySelector("[data-open-communication-modal]")?.addEventListener("click", openCommunicationModal);
  document.querySelector("[data-save-employee-edits]")?.addEventListener("click", savePendingEmployeeChanges);
  document.querySelectorAll("[data-close-employee-modal]").forEach((button) => {
    button.addEventListener("click", closeEmployeeModal);
  });
  document.querySelectorAll("[data-close-communication-modal]").forEach((button) => {
    button.addEventListener("click", closeCommunicationModal);
  });
}

function activateUi() {
  const shell = document.querySelector(".app-shell");
  const sidebarToggle = document.querySelector("[data-sidebar-toggle]");
  const setSidebarCollapsed = (collapsed) => {
    shell?.classList.toggle("sidebar-collapsed", collapsed);
    if (sidebarToggle) {
      sidebarToggle.setAttribute("aria-label", collapsed ? "展开侧边栏" : "收起侧边栏");
      sidebarToggle.setAttribute("title", collapsed ? "展开侧边栏" : "收起侧边栏");
      sidebarToggle.innerHTML = `<i data-lucide="${collapsed ? "panel-left-open" : "panel-left-close"}"></i>`;
      initIcons();
    }
    localStorage.setItem("employeeAssistantSidebarCollapsed", collapsed ? "1" : "0");
  };
  setSidebarCollapsed(localStorage.getItem("employeeAssistantSidebarCollapsed") === "1");
  sidebarToggle?.addEventListener("click", () => setSidebarCollapsed(!shell?.classList.contains("sidebar-collapsed")));

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((button) => button.classList.remove("active"));
      item.classList.add("active");
      if (item.dataset.viewTarget) showView(item.dataset.viewTarget);
    });
  });
  document.querySelectorAll("[data-open-employee]").forEach((button) => button.addEventListener("click", () => openEmployeeDrawer(button.dataset.openEmployee, "", { editable: false })));
  document.querySelector("[data-close-drawer]")?.addEventListener("click", closeEmployeeDrawer);
  document.querySelector("[data-drawer-backdrop]")?.addEventListener("click", closeEmployeeDrawer);
  document.querySelector("[data-drawer-outline]")?.addEventListener("click", () => {
    const key = document.querySelector("[data-employee-drawer]").dataset.employee || "";
    if (key) generateOutlineInModal(key);
  });
  document.querySelector("[data-drawer-analyze]")?.addEventListener("click", () => {
    const key = document.querySelector("[data-employee-drawer]").dataset.employee || "";
    analyzeEmployee(key, document.querySelector("[data-drawer-analyze]"));
  });
  document.querySelector("[data-drawer-save-edits]")?.addEventListener("click", savePendingEmployeeChanges);
  document.querySelector("[data-drawer-communication-form]")?.addEventListener("submit", completeDrawerCommunication);
  document.querySelector("[data-close-outline]")?.addEventListener("click", closeOutlineModal);
  document.querySelector("[data-outline-modal-backdrop]")?.addEventListener("click", closeOutlineModal);
  document.querySelector("[data-generate-brief]")?.addEventListener("click", loadBrief);
  document.querySelector("[data-refresh-risk-list]")?.addEventListener("click", loadRiskTable);
  document.querySelector("[data-refresh-todos]")?.addEventListener("click", loadRiskTable);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeEmployeeDrawer();
      closeOutlineModal();
      closeEmployeeModal();
      closeCommunicationModal();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initIcons();
  activateUi();
  activateArchive();
  activateChat();
  loadArchive();
  renderBrief(emptyBrief);
  loadBrief();
});
