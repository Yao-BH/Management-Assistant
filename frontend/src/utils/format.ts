import type { Employee, RiskSignal, TodoItem } from "../types";

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineAssistantFormat(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function riskClass(employee?: Pick<Employee, "level" | "risk">) {
  const level = employee?.level || "";
  const score = Number(employee?.risk || 0);
  if (level.includes("高") || score >= 70) return "high";
  if (level.includes("中") || score >= 45) return "medium";
  if (level.includes("低") || score > 0) return "low";
  return "normal";
}

export function signalText(signal?: RiskSignal) {
  if (!signal) return "";
  const label = signal.label || signal.type || "";
  const value = signal.value || "";
  return value && value !== label ? `${label}：${value}` : label;
}

export function formatEventTime(date = new Date()) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function todoStatusClass(status = "待处理") {
  if (status.includes("完成") || status.includes("关闭")) return "done";
  if (status.includes("处理") || status.includes("进行")) return "doing";
  return "pending";
}

export function todoLevelLabel(level = "medium") {
  if (level === "high") return "高优先";
  if (level === "low") return "低优先";
  return "中优先";
}

export function todoEvidence(todo?: TodoItem) {
  return todo?.reason || todo?.summary || todo?.detail || (todo?.tags || []).join("、") || "暂无详细数据。";
}

export function todoAction(todo?: TodoItem) {
  return todo?.action || todo?.title || "建议先安排 1 对 1 沟通，确认状态和阻塞点。";
}

export function employeeDisplayName(item?: TodoItem | Employee) {
  if (!item) return "员工";
  const value = item as Partial<TodoItem & Employee>;
  return value.employee || value.name || value.employeeKey || "员工";
}

export function formatAssistantMessage(text: string) {
  const lines = String(text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "";
  const blocks: string[] = [];
  let listItems: string[] = [];
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ol>${listItems.map((item) => `<li>${inlineAssistantFormat(item)}</li>`).join("")}</ol>`);
    listItems = [];
  };

  lines.forEach((line) => {
    const heading = line.match(/^#{1,6}\s*(.*)$/);
    if (heading) {
      flushList();
      blocks.push(`<p class="assistant-heading">${inlineAssistantFormat(heading[1])}</p>`);
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
    blocks.push(`<p class="${actionLike ? "assistant-action" : ""}">${inlineAssistantFormat(cleaned)}</p>`);
  });
  flushList();
  return blocks.join("");
}
