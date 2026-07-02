import { defineStore } from "pinia";
import { agentApi } from "../api/agentApi";
import type { ArchivePayload, Brief, ChatAction, ChatMessage, CommunicationRecord, Employee, EmployeeProfile, RiskSignal, TodoItem } from "../types";
import { formatEventTime, riskClass, signalText, todoAction, todoEvidence } from "../utils/format";

const emptyBrief: Brief = {
  title: "今日管理研判",
  summary: "正在读取员工档案、沟通记录和待办。",
  insights: []
};
const initialAssistantMessage: ChatMessage = {
  role: "assistant",
  text: "你可以问我：谁最需要关注、某位员工为什么有风险、今天应该先处理哪些管理动作。"
};
const maxAssistantHistory = 10;

function normalizeTodo(todo: TodoItem, employees: Employee[] = []): TodoItem {
  const employee = employees.find((item) => item.key === todo.employeeKey);
  return {
    ...todo,
    employee: todo.employee || employee?.name || todo.employeeKey,
    reason: todo.reason || todo.summary || todo.detail || (todo.tags || []).join("、"),
    action: todo.action || todo.title,
    status: todo.status || "待处理",
    level: todo.level || (todo.priority === "P1" ? "high" : todo.priority === "P3" ? "low" : "medium")
  };
}

function normalizeArchive(payload: ArchivePayload = {}) {
  const employees = payload.employees || [];
  const todos = (payload.todos || payload.items || []).map((todo) => normalizeTodo(todo, employees));
  return {
    employees,
    communicationRecords: payload.communicationRecords || [],
    smartTodos: todos,
    riskSignals: payload.riskSignals || []
  };
}

function archiveFromResponse(response: ArchivePayload & { archive?: ArchivePayload } = {}) {
  return response.archive || response;
}

export const useAgentStore = defineStore("agent", {
  state: () => ({
    employees: [] as Employee[],
    communicationRecords: [] as CommunicationRecord[],
    smartTodos: [] as TodoItem[],
    riskSignals: [] as RiskSignal[],
    currentBrief: emptyBrief as Brief,
    briefSource: "",
    todoSource: "",
    profileSourceByEmployee: {} as Record<string, string>,
    profileLoadingKey: "",
    selectedView: "dashboard",
    archiveTab: "basic",
    selectedTodoId: "",
    selectedEmployeeKey: "",
    drawerEditable: false,
    employeeDrawerOpen: false,
    employeeModalOpen: false,
    communicationModalOpen: false,
    todoCompletionModalOpen: false,
    todoCompletionTodoId: "",
    outlineModalOpen: false,
    outlineTitle: "1 对 1 沟通提纲",
    outlineEyebrow: "Generated Outline",
    outlineLines: [] as string[],
    outlineSource: "等待生成",
    assistantHistory: [initialAssistantMessage] as ChatMessage[],
    chatLoading: false,
    agentEvents: [] as { time: string; text: string }[],
    agentFeedSignature: "",
    loading: false
  }),
  getters: {
    employeesByKey(state) {
      return Object.fromEntries(state.employees.map((employee) => [employee.key, employee]));
    },
    selectedEmployee(state): Employee | undefined {
      return state.employees.find((employee) => employee.key === state.selectedEmployeeKey);
    },
    focusQueue(state): TodoItem[] {
      const todoItems = state.smartTodos.map((todo) => normalizeTodo(todo, state.employees));
      const employeeItems = state.employees
        .filter((employee) => ["high", "medium", "low"].includes(riskClass(employee)))
        .map((employee) =>
          normalizeTodo(
            {
              id: `focus-${employee.key}`,
              employeeKey: employee.key,
              employee: employee.name,
              title: employee.suggestedAction || employee.goal || "安排管理沟通",
              summary: employee.evidence?.join("；") || employee.reason,
              badge: employee.level,
              level: riskClass(employee),
              status: "待处理"
            },
            state.employees
          )
        );

      const merged = [...todoItems, ...employeeItems];
      const seen = new Set<string>();
      return merged.filter((item) => {
        const key = item.employeeKey || item.employee || item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    selectedTodo(state): TodoItem | undefined {
      return state.smartTodos.find((todo) => todo.id === state.selectedTodoId);
    }
  },
  actions: {
    employeeName(employeeKey?: string) {
      return this.employees.find((employee) => employee.key === employeeKey)?.name || employeeKey || "重点员工";
    },
    latestCommunication(employeeKey?: string) {
      const employee = this.employees.find((item) => item.key === employeeKey);
      return this.communicationRecords
        .filter((record) => record.employeeKey === employeeKey || record.employee === employee?.name || record.employeeName === employee?.name)
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
    },
    applyArchive(payload: ArchivePayload = {}) {
      const normalized = normalizeArchive(payload);
      this.employees = normalized.employees;
      this.communicationRecords = normalized.communicationRecords;
      this.smartTodos = normalized.smartTodos;
      this.riskSignals = normalized.riskSignals;
      this.refreshAgentFeed("AI 已根据最新数据刷新风险、待办和关注队列。");
    },
    async loadArchive() {
      this.loading = true;
      try {
        this.applyArchive(await agentApi.archive());
      } finally {
        this.loading = false;
      }
    },
    async loadBrief() {
      this.currentBrief = {
        title: "正在生成今日研判...",
        summary: "正在结合员工档案、风险信号、沟通记录和待办生成研判。",
        insights: []
      };
      const brief = await agentApi.brief();
      this.currentBrief = { ...emptyBrief, ...brief };
      this.briefSource = brief.source || "";
      await this.loadArchive();
      this.pushAgentEvent(`已生成今日管理研判${this.briefSource ? `：${this.briefSource}` : ""}。`);
    },
    async loadTodos() {
      const payload = await agentApi.todos();
      this.todoSource = payload.source || "";
      this.smartTodos = (payload.todos || payload.items || []).map((todo) => normalizeTodo(todo, this.employees));
      this.refreshAgentFeed(`AI 已重新编排 ${this.smartTodos.length} 条智能待办。`);
    },
    async sendChat(message: string, intent = "") {
      const text = message.trim();
      if (!text || this.chatLoading) return;
      this.assistantHistory.push({ role: "user", text });
      this.chatLoading = true;
      try {
        const history = this.assistantHistory.slice(0, -1).map((item) => ({
          role: item.role,
          content: item.text
        }));
        const assistantMessage: ChatMessage = {
          role: "assistant",
          text: "",
          intent,
          card: null,
          actions: []
        };
        this.assistantHistory.push(assistantMessage);
        const assistantIndex = this.assistantHistory.length - 1;
        const done = await agentApi.chatStream(text, history, intent, {
          onMeta: (payload) => {
            const current = this.assistantHistory[assistantIndex];
            if (!current) return;
            current.source = payload.source;
            current.intent = payload.intent || intent;
            current.card = payload.card;
            current.actions = payload.actions || [];
          },
          onDelta: (chunk) => {
            const current = this.assistantHistory[assistantIndex];
            if (current) current.text += chunk;
          },
          onDone: (payload) => {
            const current = this.assistantHistory[assistantIndex];
            if (!current) return;
            current.source = payload.source || current.source;
            current.intent = payload.intent || current.intent;
            current.card = payload.card || current.card;
            current.actions = payload.actions || current.actions || [];
          }
        });
        const current = this.assistantHistory[assistantIndex];
        if (current && !current.text.trim()) {
          current.text = done.reply || done.answer || done.message || "我暂时没有生成有效回复，请再试一次。";
        }
        this.assistantHistory = [this.assistantHistory[0], ...this.assistantHistory.slice(1).slice(-maxAssistantHistory)];
        this.pushAgentEvent(`Agent 已完成“${done.intent || intent || "团队问答"}”回复。`);
      } catch {
        const last = this.assistantHistory[this.assistantHistory.length - 1];
        if (last?.role === "assistant" && !last.text) {
          last.text = "我暂时无法连接模型服务，请稍后再试。";
        } else {
          this.assistantHistory.push({ role: "assistant", text: "我暂时无法连接模型服务，请稍后再试。" });
        }
        this.assistantHistory = [this.assistantHistory[0], ...this.assistantHistory.slice(1).slice(-maxAssistantHistory)];
      } finally {
        this.chatLoading = false;
      }
    },
    async performChatAction(action: ChatAction) {
      if (!action?.type) return;
      const employeeKey = action.employeeKey || this.focusQueue[0]?.employeeKey || "";
      if (action.type === "outline") {
        await this.generateOutline(employeeKey);
        return;
      }
      if (action.type === "profile") {
        if (employeeKey) this.openEmployeeDrawer(employeeKey);
        return;
      }
      if (action.type === "todo" || action.type === "add_todo") {
        await this.addActionTodo(employeeKey);
      }
    },
    async addActionTodo(employeeKey = this.focusQueue[0]?.employeeKey || "") {
      if (!employeeKey) return;
      this.applyArchive(archiveFromResponse(await agentApi.actionTodo(employeeKey)));
      this.pushAgentEvent(`已将 ${this.employeeName(employeeKey)} 加入管理待办。`);
    },
    openEmployeeDrawer(employeeKey: string, editable = false) {
      this.selectedEmployeeKey = employeeKey;
      this.drawerEditable = editable;
      this.employeeDrawerOpen = true;
      this.loadEmployeeProfile(employeeKey);
    },
    closeEmployeeDrawer() {
      this.employeeDrawerOpen = false;
      this.drawerEditable = false;
    },
    async analyzeSelectedEmployee() {
      if (!this.selectedEmployeeKey) return;
      const profile = await agentApi.analyze(this.selectedEmployeeKey);
      this.mergeProfile(this.selectedEmployeeKey, profile.profile || profile);
      if (profile.archive) this.applyArchive(profile.archive);
      else await this.loadArchive();
    },
    async loadEmployeeProfile(employeeKey: string) {
      if (!employeeKey || this.profileLoadingKey === employeeKey) return;
      this.profileLoadingKey = employeeKey;
      try {
        const employee = this.employees.find((item) => item.key === employeeKey);
        const profile = await agentApi.profile(employeeKey, employee);
        this.mergeProfile(employeeKey, profile);
        this.profileSourceByEmployee[employeeKey] = profile.source || "";
      } finally {
        this.profileLoadingKey = "";
      }
    },
    async generateOutline(employeeKey = this.selectedEmployeeKey) {
      if (!employeeKey) return;
      this.selectedEmployeeKey = employeeKey;
      this.outlineModalOpen = true;
      this.outlineTitle = `${this.employeeName(employeeKey)} 1 对 1 沟通提纲`;
      this.outlineEyebrow = "Generated Outline";
      this.outlineSource = "正在分析";
      this.outlineLines = ["正在结合员工画像、风险信号、待办事项和最近沟通记录生成提纲..."];
      const employee = this.employees.find((item) => item.key === employeeKey);
      try {
        const result = await agentApi.outline(employeeKey, employee);
        this.outlineLines = result.lines || result.outline || [];
        this.outlineSource = result.source || "已生成";
      } catch {
        this.outlineSource = "生成失败";
        this.outlineLines = ["暂时无法连接模型服务，请稍后重试。"];
      }
    },
    async generateCommunicationSummary(employeeKey = this.selectedTodo?.employeeKey || this.selectedEmployeeKey, todoId = this.selectedTodoId) {
      if (!employeeKey) return;
      this.selectedEmployeeKey = employeeKey;
      this.outlineModalOpen = true;
      this.outlineTitle = `${this.employeeName(employeeKey)} 沟通概要`;
      this.outlineEyebrow = "AI Communication Brief";
      this.outlineSource = "正在分析";
      this.outlineLines = ["正在独立分析员工画像、当前待办和最近沟通记录..."];
      try {
        const result = await agentApi.communicationSummary(employeeKey, todoId);
        this.outlineLines = result.lines || [];
        this.outlineSource = result.source || "已生成";
      } catch {
        this.outlineSource = "生成失败";
        this.outlineLines = ["暂时无法连接模型服务，请稍后重试。"];
      }
    },
    mergeProfile(employeeKey: string, profile: EmployeeProfile) {
      this.employees = this.employees.map((employee) =>
        employee.key === employeeKey
          ? {
              ...employee,
              risk: profile.risk ?? employee.risk,
              level: profile.level || employee.level,
              reason: profile.riskSummary || employee.reason,
              evidence: profile.evidence || employee.evidence,
              performance: profile.performance || employee.performance,
              attendance: profile.attendance || employee.attendance,
              communication: profile.communication || employee.communication,
              suggestedAction: profile.suggestedAction || employee.suggestedAction,
              lifecycle: {
                stage: profile.lifecycleStage || employee.lifecycle?.stage,
                detail: profile.lifecycleDetail || employee.lifecycle?.detail
              }
            }
          : employee
      );
      this.smartTodos = this.smartTodos.map((todo) => normalizeTodo(todo, this.employees));
    },
    async saveEmployee(employee: Record<string, unknown>) {
      const response = await agentApi.saveEmployee(employee);
      this.applyArchive(response.archive || response);
      this.employeeModalOpen = false;
      this.pushAgentEvent("已写入员工档案，并刷新风险识别。");
    },
    async importEmployees(rows: Record<string, unknown>[]) {
      if (!rows.length) return;
      this.applyArchive(archiveFromResponse(await agentApi.importEmployees(rows)));
      this.pushAgentEvent(`已导入 ${rows.length} 条员工档案，并刷新风险识别。`);
    },
    async deleteEmployee(employeeKey: string) {
      if (!employeeKey) return;
      this.applyArchive(archiveFromResponse(await agentApi.deleteEmployee(employeeKey)));
      this.pushAgentEvent("已删除员工档案，并同步关注队列。");
    },
    async saveCommunication(record: Record<string, unknown>) {
      this.applyArchive(archiveFromResponse(await agentApi.saveCommunication(record)));
      this.communicationModalOpen = false;
      this.pushAgentEvent("已记录沟通信息，并同步风险证据。");
    },
    openTodoCompletion(todoId: string) {
      this.todoCompletionTodoId = todoId;
      this.todoCompletionModalOpen = true;
    },
    closeTodoCompletion() {
      this.todoCompletionModalOpen = false;
      this.todoCompletionTodoId = "";
    },
    async completeCommunication(record: Record<string, unknown>, todoId = "") {
      this.applyArchive(archiveFromResponse(await agentApi.completeCommunication(record, todoId)));
      this.closeEmployeeDrawer();
      this.closeTodoCompletion();
      this.pushAgentEvent("已完成沟通闭环，并更新待办状态。");
    },
    async deleteCommunication(recordId: string | number) {
      this.applyArchive(archiveFromResponse(await agentApi.deleteCommunication(recordId)));
      this.pushAgentEvent("已删除沟通记录，并刷新员工风险证据。");
    },
    async updateTodoStatus(todoId: string, status: string) {
      this.applyArchive(archiveFromResponse(await agentApi.updateTodoStatus(todoId, status)));
      this.selectedTodoId = todoId;
    },
    async deleteTodo(todoId: string) {
      this.applyArchive(archiveFromResponse(await agentApi.deleteTodo(todoId)));
      if (this.selectedTodoId === todoId) this.selectedTodoId = this.smartTodos[0]?.id || "";
    },
    pushAgentEvent(text: string) {
      if (!text) return;
      this.agentEvents = [{ time: formatEventTime(), text }, ...this.agentEvents].slice(0, 8);
    },
    refreshAgentFeed(reason: string) {
      const signature = JSON.stringify({
        team: this.employees.length,
        todos: this.smartTodos.map((todo) => `${todo.id}:${todo.status}`).join("|"),
        signals: this.riskSignals.map((signal) => `${signal.id}:${signal.status}`).join("|")
      });
      if (!this.agentFeedSignature) {
        this.agentFeedSignature = signature;
        this.agentEvents = this.buildSnapshotEvents();
        return;
      }
      if (signature !== this.agentFeedSignature) {
        this.agentFeedSignature = signature;
        this.pushAgentEvent(reason);
      }
    },
    buildSnapshotEvents() {
      const focusCount = this.focusQueue.length;
      const events = [
        { time: formatEventTime(), text: `扫描 ${this.employees.length} 名员工，发现 ${focusCount} 个重点关注对象。` }
      ];
      this.riskSignals.slice(0, 2).forEach((signal) => {
        events.push({ time: formatEventTime(), text: `识别到 ${this.employeeName(signal.employeeKey)}：${signalText(signal)}。` });
      });
      events.push({ time: formatEventTime(), text: `已同步 ${this.smartTodos.length} 条管理待办。` });
      return events;
    },
    todoEvidence,
    todoAction
  }
});
