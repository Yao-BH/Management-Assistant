<script setup lang="ts">
import { FileUp, IdCard, MessageSquarePlus, MessagesSquare, Plus, Save, Trash2 } from "lucide-vue-next";
import { useAgentStore } from "../stores/agentStore";
import { riskClass } from "../utils/format";
import type { Employee } from "../types";

const store = useAgentStore();

function latestCommunicationText(employee: Employee) {
  const record = store.latestCommunication(employee.key);
  return record?.date || employee.communication || "暂无记录";
}

function normalizeEmployeeRecord(row: Record<string, unknown>) {
  const pick = (...keys: string[]) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== "");
  return {
    name: pick("姓名", "name", "员工姓名"),
    employeeId: pick("工号", "employeeId", "员工编号"),
    department: pick("部门", "department"),
    role: pick("岗位", "职务", "role"),
    hireDate: pick("入职时间", "入职日期", "hireDate"),
    manager: pick("主管", "直属主管", "manager"),
    performanceRating: pick("绩效", "当前绩效", "performanceRating"),
    performanceTrend: pick("绩效趋势", "performanceTrend"),
    goalCompletionRate: Number(pick("目标完成率", "goalCompletionRate") || 0),
    overtimeHours30d: Number(pick("30天加班", "30天加班h", "overtimeHours30d") || 0),
    lateCount30d: Number(pick("30天迟到", "lateCount30d") || 0),
    leaveDays30d: Number(pick("30天请假", "leaveDays30d") || 0),
    contractEndDate: pick("合同到期", "contractEndDate"),
    probationEndDate: pick("转正日期", "probationEndDate"),
    growthSummary: pick("成长", "成长摘要", "growthSummary"),
    awardsSummary: pick("获奖", "奖励", "awardsSummary"),
    keyEvents: pick("备注", "关键事件", "keyEvents")
  };
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = (lines.shift() || "").split(",").map((item) => item.trim());
  return lines.map((line) => {
    const values = line.split(",").map((item) => item.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const rows = file.name.toLowerCase().endsWith(".csv") ? parseCsv(await file.text()) : await parseWorkbook(file);
  await store.importEmployees(rows.map(normalizeEmployeeRecord).filter((row) => row.name));
  input.value = "";
}

async function parseWorkbook(file: File) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
}
</script>

<template>
  <section class="view-panel archive-view active">
    <div class="archive-head panel">
      <div>
        <p class="eyebrow">Employee Archive</p>
        <h2>员工档案</h2>
        <p>统一维护员工基本信息和沟通状况，为风险研判、智能待办和管理助手提供基础数据。</p>
      </div>
      <div class="archive-tabs" role="tablist" aria-label="员工档案切换">
        <button :class="{ active: store.archiveTab === 'basic' }" type="button" @click="store.archiveTab = 'basic'">
          <IdCard /><span>基本信息</span>
        </button>
        <button :class="{ active: store.archiveTab === 'communication' }" type="button" @click="store.archiveTab = 'communication'">
          <MessagesSquare /><span>沟通状况</span>
        </button>
      </div>
    </div>

    <section v-if="store.archiveTab === 'basic'" class="archive-tab-panel active">
      <article class="panel archive-form-card archive-toolbar-card">
        <div class="panel-title">
          <div>
            <p class="eyebrow">Basic Info</p>
            <h2>员工基本信息</h2>
          </div>
          <div class="archive-toolbar-actions">
            <button class="primary-btn" type="button" @click="store.employeeModalOpen = true"><Plus /><span>新增员工</span></button>
            <button class="select-btn" type="button" disabled><Save /><span>保存修改</span></button>
            <label class="upload-btn compact">
              <FileUp />
              <span>上传 Excel/CSV</span>
              <input type="file" accept=".xlsx,.xls,.csv" @change="handleUpload" />
            </label>
          </div>
        </div>
      </article>

      <article class="panel archive-table-card">
        <div class="section-head">
          <h2>员工概要</h2>
          <small>{{ store.employees.length }} 人</small>
        </div>
        <div class="archive-table employee-overview-table">
          <div class="archive-row archive-row-head archive-employee-row">
            <span>姓名</span>
            <span>工号</span>
            <span>部门</span>
            <span>岗位</span>
            <span>阶段</span>
            <span>风险等级</span>
            <span>最近沟通</span>
            <span>操作</span>
          </div>
          <div
            v-for="employee in store.employees"
            :key="employee.key"
            class="archive-row archive-employee-row"
            @dblclick="store.openEmployeeDrawer(employee.key, true)"
          >
            <span><strong>{{ employee.name }}</strong></span>
            <span>{{ employee.employeeId || employee.key }}</span>
            <span>{{ employee.department || "未填写" }}</span>
            <span>{{ employee.role || "未填写" }}</span>
            <span><em class="stage-pill">{{ employee.lifecycle?.stage || "待分析" }}</em></span>
            <span><em class="risk-badge" :class="riskClass(employee)">{{ employee.level || "待分析" }}</em></span>
            <span>{{ latestCommunicationText(employee) }}</span>
            <span class="row-actions">
              <button type="button" @click.stop="store.openEmployeeDrawer(employee.key, true)">详情</button>
              <button type="button" @click.stop="store.deleteEmployee(employee.key)"><Trash2 /></button>
            </span>
          </div>
        </div>
      </article>
    </section>

    <section v-else class="archive-tab-panel active">
      <article class="panel archive-form-card archive-toolbar-card">
        <div class="panel-title">
          <div>
            <p class="eyebrow">Communication</p>
            <h2>员工沟通状况</h2>
          </div>
          <button class="primary-btn" type="button" @click="store.communicationModalOpen = true">
            <MessageSquarePlus /><span>新增沟通记录</span>
          </button>
        </div>
      </article>

      <article class="panel archive-table-card">
        <div class="section-head">
          <h2>全体沟通记录</h2>
          <small>{{ store.communicationRecords.length }} 条</small>
        </div>
        <div class="archive-table">
          <div class="archive-row archive-row-head communication">
            <span>员工</span>
            <span>日期</span>
            <span>类型</span>
            <span>摘要</span>
          </div>
          <div v-for="record in store.communicationRecords" :key="record.id || `${record.employee}-${record.date}`" class="archive-row communication">
            <span>{{ record.employee || record.employeeName || store.employeeName(record.employeeKey) }}</span>
            <span>{{ record.date || "未记录" }}</span>
            <span>{{ record.type || "沟通" }}</span>
            <span>{{ record.summary || "未填写摘要" }}</span>
          </div>
        </div>
      </article>
    </section>
  </section>
</template>
