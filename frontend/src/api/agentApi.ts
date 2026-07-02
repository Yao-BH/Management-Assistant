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

export const agentApi = {
  archive: () => postJson<ArchivePayload>("/api/archive"),
  brief: () => postJson<Brief>("/api/brief"),
  todos: () => postJson<TodoPayload>("/api/todos"),
  chat: (message: string, history: unknown[] = [], intent = "") =>
    postJson<ChatResponse>("/api/chat", { message, history, intent }),
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
  completeCommunication: (record: Record<string, unknown>, todoId = "") =>
    postJson<ArchivePayload>("/api/communication/complete", { record, todoId }),
  communicationSummary: (employeeKey: string, todoId = "") =>
    postJson<CommunicationSummaryResponse>("/api/communication/summary", { employeeKey, todoId }),
  updateTodoStatus: (todoId: string, status: string) => postJson<ArchivePayload>("/api/todos/status", { todoId, status }),
  deleteTodo: (todoId: string) => postJson<ArchivePayload>("/api/todos/delete", { todoId })
};
