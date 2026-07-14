export type RiskLevel = "高风险" | "中风险" | "低风险" | "正常" | string;

export interface RiskSignal {
  id?: string | number;
  employeeKey?: string;
  label?: string;
  type?: string;
  value?: string;
  status?: string;
  severity?: string;
}

export interface Employee {
  key: string;
  name: string;
  employeeId?: string;
  department?: string;
  role?: string;
  jobLevel?: string;
  birthday?: string;
  birthDate?: string;
  hireDate?: string;
  manager?: string;
  performanceRating?: string;
  performanceTrend?: string;
  goalCompletionRate?: number;
  overtimeHours30d?: number;
  lateCount30d?: number;
  leaveDays30d?: number;
  contractEndDate?: string;
  probationEndDate?: string;
  mentor?: string;
  growthSummary?: string;
  awardsSummary?: string;
  keyEvents?: string;
  compensationSignal?: string;
  risk?: number;
  level?: RiskLevel;
  reason?: string;
  evidence?: string[];
  riskSignals?: RiskSignal[];
  riskFactors?: string[];
  goal?: string;
  lifecycle?: { stage?: string; detail?: string };
  performance?: string;
  attendance?: string;
  communication?: string;
  suggestedAction?: string;
  analysisStatus?: string;
  lastAnalyzedAt?: string;
  modelRequired?: boolean;
}

export interface CommunicationRecord {
  id?: string | number;
  employeeKey?: string;
  employee?: string;
  employeeName?: string;
  date?: string;
  type?: string;
  summary?: string;
  action?: string;
}

export interface TodoItem {
  id: string;
  employeeKey?: string;
  employee?: string;
  priority?: string;
  title?: string;
  badge?: string;
  summary?: string;
  tags?: string[];
  detail?: string;
  reason?: string;
  action?: string;
  level?: string;
  status?: string;
  dueDate?: string;
  source?: string;
}

export interface Brief {
  title?: string;
  summary?: string;
  insights?: Array<{ label?: string; value?: string; detail?: string }>;
  source?: string;
}

export interface ArchivePayload {
  employees?: Employee[];
  communicationRecords?: CommunicationRecord[];
  todos?: TodoItem[];
  items?: TodoItem[];
  riskSignals?: RiskSignal[];
  metrics?: MetricItem[];
  statistics?: TeamStatistics;
  source?: string;
}

export interface RiskTrendPoint {
  date?: string;
  key: string;
  high: number;
  medium: number;
  low: number;
  normal: number;
}

export interface TeamStatistics {
  riskTrend?: RiskTrendPoint[];
}

export interface TodoPayload {
  todos?: TodoItem[];
  items?: TodoItem[];
  source?: string;
}

export interface MetricItem {
  key?: string;
  label?: string;
  value?: string | number;
  detail?: string;
}

export interface ChatMessage {
  role: "assistant" | "user";
  text: string;
  source?: string;
  intent?: string;
  card?: ChatReplyCard | null;
  actions?: ChatAction[];
}

export interface ChatResponse {
  reply?: string;
  answer?: string;
  message?: string;
  source?: string;
  intent?: string;
  card?: ChatReplyCard | null;
  actions?: ChatAction[];
}

export interface ChatReplyCard {
  intent?: string;
  title?: string;
  conclusion?: string;
  evidence?: string[];
  action?: string;
  employeeKey?: string;
  tone?: "high" | "medium" | "low" | string;
}

export interface ChatAction {
  type?: "outline" | "todo" | "profile" | "add_todo" | string;
  label?: string;
  employeeKey?: string;
}

export interface EmployeeProfile {
  risk?: number;
  level?: string;
  riskSummary?: string;
  evidence?: string[];
  performance?: string;
  attendance?: string;
  communication?: string;
  suggestedAction?: string;
  lifecycleStage?: string;
  lifecycleDetail?: string;
  source?: string;
}

export interface AnalyzeResponse {
  employee?: Employee;
  profile?: EmployeeProfile;
  archive?: ArchivePayload;
  source?: string;
}

export interface EmployeeSaveResponse {
  employee?: Employee;
  archive?: ArchivePayload;
}

export interface OutlineResponse {
  lines?: string[];
  outline?: string[];
  source?: string;
}

export interface CommunicationSummaryResponse {
  lines?: string[];
  source?: string;
}
