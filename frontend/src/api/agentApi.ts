import { postJson } from "./http";
import type {
  AnalyzeResponse,
  ArchivePayload,
  Brief,
  ChatResponse,
  CommunicationSummaryResponse,
  EmployeeProfile,
  EmployeeSaveResponse,
  OutlineResponse,
  TodoPayload
} from "../types";

type ChatStreamHandlers = {
  onMeta?: (payload: ChatResponse) => void;
  onDelta?: (text: string) => void;
  onDone?: (payload: ChatResponse) => void;
};

async function postStream(url: string, payload: Record<string, unknown>, handlers: ChatStreamHandlers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${url} failed: ${detail || response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: ChatResponse = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ChatResponse & { type?: string; text?: string };
      if (event.type === "meta") handlers.onMeta?.(event);
      if (event.type === "delta" && event.text) handlers.onDelta?.(event.text);
      if (event.type === "done") {
        donePayload = event;
        handlers.onDone?.(event);
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as ChatResponse & { type?: string; text?: string };
    if (event.type === "done") donePayload = event;
  }

  return donePayload;
}

export const agentApi = {
  archive: () => postJson<ArchivePayload>("/api/archive"),
  brief: () => postJson<Brief>("/api/brief"),
  todos: () => postJson<TodoPayload>("/api/todos"),
  chat: (message: string, history: unknown[] = [], intent = "") =>
    postJson<ChatResponse>("/api/chat", { message, history, intent }),
  chatStream: (message: string, history: unknown[] = [], intent = "", handlers: ChatStreamHandlers = {}) =>
    postStream("/api/chat/stream", { message, history, intent }, handlers),
  profile: (employeeKey: string, employee?: unknown) =>
    postJson<EmployeeProfile>("/api/profile", { employeeKey, employee }),
  analyze: (employeeKey: string) => postJson<AnalyzeResponse>("/api/analyze", { employeeKey }),
  actionTodo: (employeeKey: string) => postJson<ArchivePayload>("/api/action-todo", { employeeKey }),
  outline: (employeeKey: string, employee?: unknown) =>
    postJson<OutlineResponse>("/api/outline", { employeeKey, employee }),
  saveEmployee: (employee: Record<string, unknown>) => postJson<EmployeeSaveResponse>("/api/employees", { employee }),
  importEmployees: (employees: Record<string, unknown>[]) =>
    postJson<ArchivePayload>("/api/employees/import", { employees }),
  deleteEmployee: (employeeKey: string) => postJson<ArchivePayload>("/api/employees/delete", { employeeKey }),
  saveCommunication: (record: Record<string, unknown>) => postJson<ArchivePayload>("/api/communication", { record }),
  updateCommunication: (recordId: string | number, record: Record<string, unknown>) =>
    postJson<ArchivePayload>("/api/communication/update", { recordId, record }),
  deleteCommunication: (recordId: string | number) =>
    postJson<ArchivePayload>("/api/communication/delete", { recordId }),
  completeCommunication: (record: Record<string, unknown>, todoId = "") =>
    postJson<ArchivePayload>("/api/communication/complete", { record, todoId }),
  communicationSummary: (employeeKey: string, todoId = "") =>
    postJson<CommunicationSummaryResponse>("/api/communication/summary", { employeeKey, todoId }),
  updateTodoStatus: (todoId: string, status: string) => postJson<ArchivePayload>("/api/todos/status", { todoId, status }),
  deleteTodo: (todoId: string) => postJson<ArchivePayload>("/api/todos/delete", { todoId })
};
