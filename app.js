const employees = {
  zhangsan: {
    name: "张三",
    employeeId: "E2024001",
    role: "产品运营 · P6",
    department: "产品部",
    hireDate: "2025-08-12",
    manager: "姚老师",
    risk: 86,
    level: "高风险",
    reason: "连续加班 5 天，绩效从 B+ 下滑到 C，30 天未进行 1 对 1 沟通。",
    evidence: ["近 7 天加班 28 小时", "Q1 绩效 B+ -> C", "上次沟通距今 30 天"],
    goal: "确认压力来源，明确 Q2 目标调整与两周复盘动作。",
    lifecycle: { stage: "成长期", detail: "入职 6-12 个月，重点关注目标承接、能力成长和稳定沟通节奏。" }
  },
  lisi: {
    name: "李四",
    employeeId: "E2023018",
    role: "客户成功 · P6",
    department: "客户成功部",
    hireDate: "2023-05-20",
    manager: "姚老师",
    risk: 67,
    level: "中风险",
    reason: "合同节点临近，本月迟到 4 次，需要结合绩效与稳定性完成续签判断。",
    evidence: ["合同 9 天后到期", "本月迟到 4 次", "近 30 天客户满意度稳定"],
    goal: "确认续签意愿、近期状态和必要支持，形成续签建议。",
    lifecycle: { stage: "稳定期", detail: "任职超过 1 年，当前重点是稳定性判断、续签意愿确认和关键客户交接风险。" }
  },
  wangwu: {
    name: "王五",
    employeeId: "E2026007",
    role: "前端工程师 · P5",
    department: "研发部",
    hireDate: "2026-03-28",
    manager: "姚老师",
    risk: 48,
    level: "低风险",
    reason: "入职满 3 个月，尚未安排转正面谈，成长反馈节点临近。",
    evidence: ["入职 92 天", "导师反馈尚未归档", "试用期目标完成率 82%"],
    goal: "确认试用期目标完成情况，记录转正结论和后续成长支持。",
    lifecycle: { stage: "适应期", detail: "入职 3 个月，处于试用期收口节点，需要完成转正判断和下一阶段成长目标。" }
  }
};

const profileFallbacks = {
  zhangsan: {
    riskSummary: "连续加班 5 天，绩效从 B+ 下滑到 C，30 天未进行 1 对 1 沟通。目标完成率 72%，近期投入较高但结果波动明显，建议先确认压力来源。",
    evidence: employees.zhangsan.evidence,
    performance: "B+ -> C",
    attendance: "加班 28h",
    communication: "30 天未沟通",
    suggestedAction: "安排 1 对 1",
    lifecycleStage: "成长期",
    lifecycleDetail: employees.zhangsan.lifecycle.detail
  },
  lisi: {
    riskSummary: "合同节点临近，本月迟到 4 次，需要结合绩效、稳定性和续签意愿形成判断。",
    evidence: employees.lisi.evidence,
    performance: "客户满意稳定",
    attendance: "迟到 4 次",
    communication: "续签待评估",
    suggestedAction: "完成续签评估",
    lifecycleStage: "稳定期",
    lifecycleDetail: employees.lisi.lifecycle.detail
  },
  wangwu: {
    riskSummary: "入职满 3 个月，尚未安排转正面谈，导师反馈也未归档，需要完成试用期收口。",
    evidence: employees.wangwu.evidence,
    performance: "试用期 82%",
    attendance: "出勤稳定",
    communication: "转正未面谈",
    suggestedAction: "完成转正面谈",
    lifecycleStage: "适应期",
    lifecycleDetail: employees.wangwu.lifecycle.detail
  }
};

const fallbackMetrics = [
  { key: "team", label: "员工档案", value: "12", detail: "已录入基础信息", tone: "pink" },
  { key: "focus", label: "重点关注", value: "3", detail: "系统识别对象", tone: "blue" },
  { key: "todo", label: "待办动作", value: "7", detail: "风险与节点生成", tone: "green" },
  { key: "coverage", label: "沟通覆盖", value: "76%", detail: "来自沟通记录", tone: "amber" }
];

const fallbackBrief = {
  title: "今日管理研判",
  summary: "团队整体稳定，当前有 3 名员工需要管理层关注。优先处理张三的绩效与压力沟通，并跟进王五转正、李四合同续签节点。",
  insights: [
    { label: "优先处理", value: "张三绩效沟通", detail: "高风险 86，建议今日完成" },
    { label: "主要风险因子", value: "加班 + 绩效 + 沟通缺失", detail: "3 个因子同时触发" },
    { label: "关键节点", value: "转正面谈 + 合同续签", detail: "王五本周转正，李四 9 天后到期" }
  ]
};

const fallbackOutlines = {
  zhangsan: ["开场先认可近期投入，说明本次沟通希望先理解压力来源。", "询问连续加班主要来自任务量、协作阻塞还是目标不清。", "一起拆解 Q2 目标，明确优先级和需要协调的资源。", "约定两周后复盘，并确认下一次 1 对 1 时间。"],
  lisi: ["先确认近期工作状态和续签意愿。", "讨论迟到原因，判断是否需要排班、通勤或个人状态支持。", "同步绩效与客户反馈，明确续签判断依据。", "本周内完成续签评估并记录风险观察点。"],
  wangwu: ["说明转正面谈目标是复盘试用期表现和下一阶段成长方向。", "询问试用期最有成就感的任务以及仍需支持的能力。", "结合导师反馈确认技能短板，给出 30 天成长计划。", "归档转正结论并安排导师后续跟进。"]
};

const fallbackTodos = [
  { id: "zhangsan", employeeKey: "zhangsan", priority: "P1", title: "张三绩效与压力沟通", badge: "高风险 · 今天", summary: "连续加班 5 天，绩效从 B+ 下滑到 C，30 天未沟通，建议今天完成一次 1 对 1。", tags: ["加班 28h", "绩效 B+ -> C", "30 天未沟通"], level: "high" },
  { id: "lisi", employeeKey: "lisi", priority: "P2", title: "李四合同续签评估", badge: "中风险 · 9 天", summary: "合同节点临近，近期考勤异常，需要结合绩效与稳定性完成续签判断。", tags: ["合同 9 天后到期", "本月迟到 4 次", "客户满意度稳定"], level: "medium" },
  { id: "wangwu", employeeKey: "wangwu", priority: "P3", title: "王五转正面谈", badge: "关键节点 · 本周", summary: "王五入职满 3 个月，试用期反馈尚未归档，建议本周内完成转正沟通。", tags: ["入职 92 天", "导师反馈待归档", "目标完成率 82%"], level: "low" }
];

const assistantHistory = [];

let archiveEmployees = Object.entries(employees).map(([key, employee]) => ({
  key,
  name: employee.name,
  employeeId: employee.employeeId,
  department: employee.department,
  role: employee.role,
  hireDate: employee.hireDate,
  manager: employee.manager,
  lifecycle: employee.lifecycle.stage,
  level: employee.level
}));

let communicationRecords = [
  { employee: "张三", date: "2026-06-29", type: "1 对 1", summary: "近期连续加班，需确认压力来源和目标优先级。", action: "今天完成绩效与压力沟通" },
  { employee: "李四", date: "2026-06-28", type: "合同续签", summary: "合同 9 天后到期，需结合考勤和续签意愿评估。", action: "本周完成续签评估" }
];

let smartTodos = [...fallbackTodos];
let selectedTodoId = "";

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
    const actionLike = /^(动作|建议|下一步|优先处理|风险原因)[:：]/.test(cleaned);
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

function syncEmployeesFromArchive(list = archiveEmployees) {
  Object.keys(employees).forEach((key) => delete employees[key]);
  list.forEach((employee) => {
    employees[employee.key] = {
      key: employee.key,
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
      role: employee.role,
      hireDate: employee.hireDate,
      manager: employee.manager,
      risk: employee.risk || 0,
      level: employee.level || "待分析",
      reason: employee.reason || "",
      evidence: employee.evidence || [],
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
      evidence: employee.evidence || [],
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
  syncEmployeesFromArchive(archiveEmployees);
  renderArchive();
  renderMetrics(payload.metrics || deriveDashboardMetrics());
  renderRiskTable(smartTodos);
  renderTodoWorkbench();
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
  if (!grid) return;
  grid.innerHTML = "";
  const source = Array.isArray(items) && items.length ? items : deriveDashboardMetrics();
  const normalized = source.slice(0, 4).map((item, index) => ({
    key: item.key || fallbackMetrics[index].key,
    label: item.label || fallbackMetrics[index].label,
    value: item.value || fallbackMetrics[index].value,
    detail: item.detail || fallbackMetrics[index].detail,
    tone: item.tone || fallbackMetrics[index].tone
  }));
  normalized.forEach((item) => {
    const card = document.createElement("article");
    card.className = `kpi ${item.tone || ""}`;
    card.innerHTML = `<strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.detail)}</small>`;
    grid.appendChild(card);
  });
  renderSignalBoard(normalized);
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
  const actionCount = Math.max(fallbackTodos.length, focusCount + communicationRecords.filter((record) => record.action).length);

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

function renderSignalBoard(items = fallbackMetrics) {
  const team = metricValue(items, "team", "12");
  const focus = metricValue(items, "focus", "3");
  const todo = metricValue(items, "todo", "7");
  const coverage = metricValue(items, "coverage", "76%");
  const teamNumber = Number.parseInt(team, 10) || 12;
  const focusNumber = Number.parseInt(focus, 10) || 3;
  const stableNumber = Math.max(teamNumber - focusNumber, 0);
  const stableRate = Math.round((stableNumber / teamNumber) * 100);
  const focusRate = Math.round((focusNumber / teamNumber) * 100);
  const coverageNumber = Number.parseInt(coverage, 10) || 76;
  const todoNumber = Number.parseInt(todo, 10) || 7;
  const health = Math.max(0, Math.min(100, Math.round(stableRate * 0.55 + coverageNumber * 0.35 - todoNumber * 1.2)));
  document.querySelector("[data-funnel-total]").textContent = team;
  document.querySelector("[data-funnel-stable]").textContent = String(stableNumber);
  document.querySelector("[data-funnel-focus]").textContent = focus;
  document.querySelector("[data-funnel-action]").textContent = todo;
  document.querySelector("[data-signal-health]").textContent = `${health}%`;
  document.querySelector("[data-signal-coverage]").textContent = coverage;
  document.querySelector("[data-signal-focus-rate]").textContent = `${focusRate}%`;
  document.querySelector("[data-signal-stable-bar]").style.width = `${stableRate}%`;
  document.querySelector("[data-signal-focus-bar]").style.width = `${focusRate}%`;
  document.querySelector("[data-signal-action-bar]").style.width = `${Math.min(todoNumber * 12, 100)}%`;
  document.querySelector("[data-signal-coverage-bar]").style.width = `${coverageNumber}%`;
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
  document.querySelector("[data-brief-title]").textContent = brief.title || fallbackBrief.title;
  document.querySelector("[data-brief-summary]").textContent = brief.summary || fallbackBrief.summary;
  const insights = document.querySelector("[data-brief-insights]");
  insights.innerHTML = "";
  (brief.insights || fallbackBrief.insights).slice(0, 3).forEach((item) => {
    const card = document.createElement("div");
    card.innerHTML = `<span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small>`;
    insights.appendChild(card);
  });
}

async function loadBrief() {
  renderBrief({ ...fallbackBrief, title: "正在生成今日研判..." });
  try {
    renderBrief(await postJson("/api/brief"));
  } catch {
    renderBrief(fallbackBrief);
  }
}

function renderAssistantActions(actions = []) {
  if (!actions.length) return "";
  return `<div class="assistant-actions">${actions.map((action) => `<button type="button" data-agent-action="${escapeHtml(action.type)}" data-agent-employee="${escapeHtml(action.employeeKey || "")}">${escapeHtml(action.label)}</button>`).join("")}</div>`;
}

function bindAssistantActions(scope) {
  scope.querySelectorAll("[data-agent-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.agentAction;
      const employeeKey = button.dataset.agentEmployee;
      if (type === "outline" && employeeKey) {
        generateOutlineInModal(employeeKey);
      }
      if (type === "profile" && employeeKey) {
        openEmployeeDrawer(employeeKey);
      }
      if (type === "todo" && employeeKey) {
        button.disabled = true;
        button.textContent = "已加入";
        try {
          const result = await postJson("/api/action-todo", { employeeKey });
          smartTodos = result.items || smartTodos;
          renderRiskTable(smartTodos);
          loadMetrics();
        } catch {
          button.textContent = "加入失败";
        }
      }
    });
  });
}

function addChatBubble(text, role, actions = []) {
  const chat = document.querySelector(".chat-preview");
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.innerHTML = role === "assistant" ? `${formatAssistantMessage(text)}${renderAssistantActions(actions)}` : escapeHtml(text);
  chat.appendChild(bubble);
  if (role === "assistant") bindAssistantActions(bubble);
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
    addChatBubble(result.reply || "建议优先查看风险画像，并生成 1 对 1 沟通提纲。", "assistant", result.actions || []);
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
  if (item.level === "high") return "今日处理";
  if (item.badge?.includes("9 天")) return "本周评估";
  if (item.badge?.includes("本周")) return "节点提醒";
  return "待处理";
}

function renderRiskTable(items) {
  const table = document.querySelector("[data-risk-table]");
  const header = table.querySelector(".table-head");
  table.innerHTML = "";
  table.appendChild(header);
  const source = (items && items.length ? items : smartTodos).slice(0, 5);
  if (!source.length) {
    const row = document.createElement("div");
    row.className = "person-row loading-row";
    row.innerHTML = `<span class="person"><b>AI</b><em>暂无待办</em></span><span>-</span><span>当前没有重点风险项</span><span>可先补充沟通记录并运行 AI 分析</span><span class="status-pill">稳定</span>`;
    table.appendChild(row);
    return;
  }
  source.forEach((item) => {
    const employeeKey = employees[item.employeeKey] ? item.employeeKey : Object.keys(employees)[0];
    if (!employeeKey) return;
    const employee = employees[employeeKey];
    const row = document.createElement("button");
    row.className = "person-row";
    row.type = "button";
    row.dataset.openEmployee = employeeKey;
    row.innerHTML = `<span class="person"><b>${escapeHtml(employee.name.slice(0, 1))}</b><em>${escapeHtml(employee.name)}</em></span><span class="risk-dots ${escapeHtml(item.level || "medium")}">${dotsForLevel(item.level)}</span><span>${escapeHtml((item.tags || []).slice(0, 2).join("、") || item.summary || employee.reason)}</span><span>${escapeHtml(item.title || employee.goal)}</span><span class="status-pill ${escapeHtml(item.level || "medium")}">${escapeHtml(todoStatus(item))}</span>`;
    row.addEventListener("click", () => openEmployeeDrawer(employeeKey));
    table.appendChild(row);
  });
}

function statusClass(status = "待处理") {
  if (status === "已完成") return "done";
  if (status === "处理中") return "active";
  if (status === "已忽略") return "muted";
  return "open";
}

function todoLevelLabel(level = "medium") {
  if (level === "high") return "高优先级";
  if (level === "low") return "低优先级";
  return "中优先级";
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
  if (!selectedTodoId && items.length) selectedTodoId = items[0].id;
  if (selectedTodoId && !todoById(selectedTodoId)) selectedTodoId = items[0]?.id || "";
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<div class="todo-empty">暂无待办，可先补充员工沟通记录或运行 AI 分析。</div>`;
    renderTodoDetail(null);
    return;
  }
  items.forEach((item) => {
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
    list.appendChild(button);
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
    <section class="todo-glass-section">
      <h3>最近沟通</h3>
      <div class="mini-records">${records.length ? records.map((record) => `<div><strong>${escapeHtml(record.date || "-")} · ${escapeHtml(record.type || "-")}</strong><span>${escapeHtml(record.summary || "-")}</span></div>`).join("") : "<p>暂无沟通记录，建议先完成一次管理沟通。</p>"}</div>
    </section>
    <div class="todo-actions">
      <button type="button" data-todo-status="处理中"><i data-lucide="play-circle"></i><span>开始处理</span></button>
      <button type="button" data-todo-outline><i data-lucide="wand-sparkles"></i><span>生成提纲</span></button>
      <button type="button" data-todo-complete><i data-lucide="check-circle-2"></i><span>记录沟通并完成</span></button>
      <button type="button" data-todo-status="已忽略"><i data-lucide="circle-slash"></i><span>忽略</span></button>
    </div>
  `;
  panel.querySelector("[data-todo-open-employee]")?.addEventListener("click", () => openEmployeeDrawer(item.employeeKey, item.id));
  panel.querySelector("[data-todo-outline]")?.addEventListener("click", () => generateOutlineInModal(item.employeeKey));
  panel.querySelector("[data-todo-complete]")?.addEventListener("click", () => openEmployeeDrawer(item.employeeKey, item.id));
  panel.querySelectorAll("[data-todo-status]").forEach((button) => {
    button.addEventListener("click", () => updateTodoStatus(item.id, button.dataset.todoStatus));
  });
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

async function loadRiskTable() {
  try {
    const result = await postJson("/api/todos");
    smartTodos = result.items || smartTodos;
    renderRiskTable(smartTodos);
    renderTodoWorkbench();
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

async function openEmployeeDrawer(employeeKey, todoId = "") {
  const employee = employees[employeeKey];
  if (!employee) return;
  const drawer = document.querySelector("[data-employee-drawer]");
  drawer.dataset.employee = employeeKey;
  drawer.dataset.todo = todoId || selectedTodoId || "";
  document.querySelector("[data-drawer-name]").textContent = employee.name;
  document.querySelector("[data-drawer-role]").textContent = employee.role;
  document.querySelector("[data-drawer-risk]").textContent = employee.risk || "--";
  document.querySelector("[data-drawer-level]").textContent = employee.level;
  renderEmployeeProfile(employeeKey, profileFallbacks[employeeKey]);
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

async function generateOutlineInModal(employeeKey) {
  openOutlineModal();
  renderOutline(employeeKey, ["正在读取员工风险原因、近期事件和建议目标..."], "生成中");
  try {
    const result = await postJson("/api/outline", { employeeKey });
    renderOutline(employeeKey, result.lines || fallbackOutlines[employeeKey], result.source || "DeepSeek");
  } catch {
    renderOutline(employeeKey, fallbackOutlines[employeeKey] || ["先确认员工当前状态。", "补充近期沟通记录。", "明确下一步管理动作。"], "本地智能模板");
  }
}

function showView(viewName) {
  document.querySelectorAll("[data-view]").forEach((view) => {
    const active = view.dataset.view === viewName;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
}

function renderArchiveEmployees() {
  const table = document.querySelector("[data-employee-table]");
  if (!table) return;
  document.querySelector("[data-employee-count]").textContent = `${archiveEmployees.length} 人`;
  table.innerHTML = `<div class="archive-row archive-row-head archive-employee-row"><span>姓名</span><span>工号</span><span>部门</span><span>职务</span><span>入职时间</span><span>系统分析</span><span>操作</span></div>${archiveEmployees.map((employee) => `<div class="archive-row archive-employee-row"><button class="archive-person" type="button" data-archive-employee="${escapeHtml(employee.key)}"><b>${escapeHtml(employee.name.slice(0, 1))}</b>${escapeHtml(employee.name)}</button><span>${escapeHtml(employee.employeeId || "-")}</span><span>${escapeHtml(employee.department || "-")}</span><span>${escapeHtml(employee.role || "-")}</span><span>${escapeHtml(employee.hireDate || "-")}</span><span class="status-pill ${employee.level === "高风险" ? "high" : employee.level === "中风险" ? "medium" : "low"}">${escapeHtml(employee.lifecycle?.stage || employee.lifecycle || "待分析")} · ${escapeHtml(employee.level || "待分析")}</span><button class="mini-action" type="button" data-analyze-employee="${escapeHtml(employee.key)}">${employee.analysisStatus === "已分析" ? "重新分析" : "AI分析"}</button></div>`).join("")}`;
  table.querySelectorAll("[data-archive-employee]").forEach((row) => {
    row.addEventListener("click", () => {
      if (employees[row.dataset.archiveEmployee]) openEmployeeDrawer(row.dataset.archiveEmployee);
    });
  });
  table.querySelectorAll("[data-analyze-employee]").forEach((button) => {
    button.addEventListener("click", () => analyzeEmployee(button.dataset.analyzeEmployee, button));
  });
}

function renderCommunicationRecords() {
  const table = document.querySelector("[data-communication-table]");
  if (!table) return;
  document.querySelector("[data-communication-count]").textContent = `${communicationRecords.length} 条`;
  table.innerHTML = `<div class="archive-row archive-row-head communication"><span>员工</span><span>日期</span><span>类型</span><span>摘要</span><span>动作</span></div>${communicationRecords.map((record) => `<div class="archive-row communication"><span>${escapeHtml(record.employee || "-")}</span><span>${escapeHtml(record.date || "-")}</span><span>${escapeHtml(record.type || "-")}</span><span>${escapeHtml(record.summary || "-")}</span><span>${escapeHtml(record.action || "-")}</span></div>`).join("")}`;
}

function updateCommunicationEmployeeOptions() {
  const select = document.querySelector("[data-communication-employee]");
  if (!select) return;
  select.innerHTML = archiveEmployees.map((employee) => `<option value="${escapeHtml(employee.name)}">${escapeHtml(employee.name)}</option>`).join("");
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
    openEmployeeDrawer(employeeKey);
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
    hireDate: row.hireDate || row.入职时间 || row["入职日期"] || "",
    manager: row.manager || row.直属主管 || row.主管 || "",
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
    const record = { employee: form.get("employee"), date: form.get("date") || new Date().toISOString().slice(0, 10), type: form.get("type"), summary: form.get("summary"), action: form.get("action") };
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.querySelector("span").textContent = "记录中";
    }
    communicationRecords.unshift(record);
    renderArchive();
    try {
      const result = await postJson("/api/communication", { record });
      event.currentTarget.reset();
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
}

function activateUi() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((button) => button.classList.remove("active"));
      item.classList.add("active");
      if (item.dataset.viewTarget) showView(item.dataset.viewTarget);
    });
  });
  document.querySelectorAll("[data-open-employee]").forEach((button) => button.addEventListener("click", () => openEmployeeDrawer(button.dataset.openEmployee)));
  document.querySelector("[data-close-drawer]")?.addEventListener("click", closeEmployeeDrawer);
  document.querySelector("[data-drawer-backdrop]")?.addEventListener("click", closeEmployeeDrawer);
  document.querySelector("[data-drawer-outline]")?.addEventListener("click", () => {
    const key = document.querySelector("[data-employee-drawer]").dataset.employee || "zhangsan";
    generateOutlineInModal(key);
  });
  document.querySelector("[data-drawer-analyze]")?.addEventListener("click", () => {
    const key = document.querySelector("[data-employee-drawer]").dataset.employee || "";
    analyzeEmployee(key, document.querySelector("[data-drawer-analyze]"));
  });
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
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initIcons();
  activateUi();
  activateArchive();
  activateChat();
  loadArchive();
  renderBrief(fallbackBrief);
  loadBrief();
});
