<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { AlertTriangle, CheckCircle2, MessageSquarePlus, ScanSearch, WandSparkles, X } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import { riskClass, signalText } from "../../utils/format";

const store = useAgentStore();
const activeTab = ref("basic");
const editingField = ref("");
const form = reactive({ date: "", type: "1 对 1", summary: "", action: "" });
const basicForm = reactive<Record<string, string | number>>({});

const employee = computed(() => store.selectedEmployee);
const employeeTodos = computed(() => store.smartTodos.filter((todo) => todo.employeeKey === employee.value?.key));
const records = computed(() =>
  store.communicationRecords
    .filter((record) => record.employeeKey === employee.value?.key || record.employee === employee.value?.name || record.employeeName === employee.value?.name)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
);
const latestRecord = computed(() => records.value[0]);
const evidence = computed(() => {
  const item = employee.value;
  if (!item) return [];
  const signalEvidence = (item.riskSignals || []).map(signalText).filter(Boolean);
  return signalEvidence.length ? signalEvidence : item.evidence || [];
});
const tabs = [
  { key: "basic", label: "基本信息" },
  { key: "performance", label: "绩效" },
  { key: "growth", label: "成长" },
  { key: "awards", label: "获奖" },
  { key: "attendance", label: "考勤" },
  { key: "events", label: "状态" }
];

interface ProfileField {
  label: string;
  field?: string;
  value?: string;
  type?: string;
  suffix?: string;
  wide?: boolean;
  multiline?: boolean;
}

function syncBasicForm() {
  const item = employee.value;
  if (!item) return;
  Object.assign(basicForm, {
    key: item.key,
    name: item.name || "",
    employeeId: item.employeeId || "",
    department: item.department || "",
    role: item.role || "",
    jobLevel: item.jobLevel || "",
    hireDate: item.hireDate || "",
    manager: item.manager || "",
    contractEndDate: item.contractEndDate || "",
    probationEndDate: item.probationEndDate || "",
    performanceRating: item.performanceRating || "",
    performanceTrend: item.performanceTrend || "",
    goalCompletionRate: item.goalCompletionRate || 0,
    overtimeHours30d: item.overtimeHours30d || 0,
    lateCount30d: item.lateCount30d || 0,
    leaveDays30d: item.leaveDays30d || 0,
    mentor: item.mentor || "",
    growthSummary: item.growthSummary || "",
    awardsSummary: item.awardsSummary || "",
    keyEvents: item.keyEvents || "",
    compensationSignal: item.compensationSignal || ""
  });
}

watch(
  () => store.employeeDrawerOpen,
  (open) => {
    if (open) {
      activeTab.value = "basic";
      editingField.value = "";
      syncBasicForm();
      form.date = new Date().toISOString().slice(0, 10);
      form.type = "1 对 1";
      form.summary = "";
      form.action = "";
    }
  }
);

watch(employee, syncBasicForm);

watch(
  () => store.drawerEditable,
  (editable) => {
    if (!editable) editingField.value = "";
  }
);

const tabFields = computed<ProfileField[]>(() => {
  const item = employee.value;
  if (!item) return [];
  const common = {
    lifecycleStage: item.lifecycle?.stage || "待分析",
    lifecycleDetail: item.lifecycle?.detail || "等待 AI 结合入职、合同、转正和沟通记录判断。",
    evidenceText: evidence.value.join("；") || "暂无风险证据"
  };
  if (activeTab.value === "basic") {
    return [
      { label: "入职日期", field: "hireDate", type: "date" },
      { label: "合同到期日", field: "contractEndDate", type: "date" },
      { label: "转正日期", field: "probationEndDate", type: "date" },
      { label: "生命周期阶段", value: common.lifecycleStage },
      { label: "风险等级", value: item.level || "待分析" },
      { label: "最近沟通日期", value: latestRecord.value?.date || item.communication || "暂无记录" }
    ];
  }
  if (activeTab.value === "performance") {
    return [
      { label: "当前绩效", field: "performanceRating" },
      { label: "绩效趋势", field: "performanceTrend" },
      { label: "目标完成率", field: "goalCompletionRate", type: "number", suffix: "%" },
      { label: "AI 绩效判断", value: item.reason || "暂无 AI 绩效判断", wide: true }
    ];
  }
  if (activeTab.value === "growth") {
    return [
      { label: "导师", field: "mentor" },
      { label: "成长阶段", value: common.lifecycleStage },
      { label: "成长摘要", field: "growthSummary", wide: true, multiline: true }
    ];
  }
  if (activeTab.value === "awards") {
    return [{ label: "获奖记录", field: "awardsSummary", wide: true, multiline: true }];
  }
  if (activeTab.value === "attendance") {
    return [
      { label: "30天加班", field: "overtimeHours30d", type: "number", suffix: " 小时" },
      { label: "30天迟到", field: "lateCount30d", type: "number", suffix: " 次" },
      { label: "30天请假", field: "leaveDays30d", type: "number", suffix: " 天" },
      { label: "AI 考勤摘要", value: item.attendance || "待分析", wide: true }
    ];
  }
  return [
    { label: "状态备注", field: "keyEvents", wide: true, multiline: true },
    { label: "风险证据", value: common.evidenceText, wide: true }
  ];
});

function startInlineEdit(field?: string) {
  if (!field || !store.drawerEditable) return;
  editingField.value = field;
}

function fieldDisplay(item: { field?: string; value?: string; suffix?: string }) {
  if (!item.field) return item.value || "未填写";
  const value = basicForm[item.field];
  const text = value === "" || value === undefined || value === null ? "未填写" : String(value);
  return item.suffix && text !== "未填写" ? `${text}${item.suffix}` : text;
}

async function saveInlineEdit() {
  if (!employee.value || !editingField.value) return;
  editingField.value = "";
  await store.saveEmployee({ ...basicForm, key: employee.value.key });
}

function commitWithEnter(event: KeyboardEvent) {
  (event.target as HTMLElement).blur();
}

async function saveQuickCommunication() {
  if (!employee.value || !form.summary.trim()) return;
  await store.saveCommunication({
    employee: employee.value.name,
    employeeKey: employee.value.key,
    date: form.date,
    type: form.type,
    summary: form.summary,
    action: form.action
  });
  form.date = new Date().toISOString().slice(0, 10);
  form.type = "1 对 1";
  form.summary = "";
  form.action = "";
}
</script>

<template>
  <div class="drawer-backdrop" :class="{ active: store.employeeDrawerOpen }" @click="store.closeEmployeeDrawer()"></div>
  <aside class="employee-drawer employee-profile-drawer" :aria-hidden="store.employeeDrawerOpen ? 'false' : 'true'">
    <template v-if="employee">
      <div class="profile-risk-strip" :class="riskClass(employee)">
        <AlertTriangle />
        <strong>{{ employee.level || "待分析" }}</strong>
        <span>{{ evidence[0] || employee.reason || "等待 AI 更新风险依据" }}</span>
        <em>{{ employee.lifecycle?.stage || "阶段待分析" }}</em>
      </div>

      <section class="profile-hero-card">
        <div class="employee-detail-avatar">{{ employee.name.slice(0, 1) }}</div>
        <div class="profile-hero-main">
          <h2>{{ employee.name }}</h2>
          <p>{{ employee.employeeId || employee.key }} · {{ employee.department || "未填写部门" }} · {{ employee.role || "岗位待补充" }}</p>
          <span>职级：{{ employee.jobLevel || "未填写" }}</span>
        </div>
        <div class="profile-hero-actions">
          <button v-if="store.drawerEditable" type="button" @click="store.analyzeSelectedEmployee()"><ScanSearch /><span>重新分析</span></button>
          <button type="button" aria-label="关闭员工画像" @click="store.closeEmployeeDrawer()"><X /></button>
        </div>
      </section>

      <section class="profile-tab-card">
        <nav class="employee-detail-tabs" aria-label="员工详情分类">
          <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
            {{ tab.label }}
          </button>
        </nav>

        <div class="profile-info-grid">
          <div
            v-for="item in tabFields"
            :key="item.label"
            :class="{ wide: item.wide, editable: Boolean(item.field && store.drawerEditable), editing: editingField === item.field }"
            @dblclick="startInlineEdit(item.field)"
          >
            <span>{{ item.label }}</span>
            <textarea
              v-if="item.field && editingField === item.field && item.multiline"
              v-model="basicForm[item.field]"
              rows="3"
              @blur="saveInlineEdit"
              @keydown.enter.ctrl="commitWithEnter"
            ></textarea>
            <input
              v-else-if="item.field && editingField === item.field"
              v-model="basicForm[item.field]"
              :type="item.type || 'text'"
              @blur="saveInlineEdit"
              @keydown.enter="commitWithEnter"
            />
            <strong v-else>{{ fieldDisplay(item) }}</strong>
          </div>
        </div>
      </section>

      <section class="drawer-section">
        <h3>沟通记录</h3>
        <button v-if="store.drawerEditable" class="select-btn small profile-add-record" type="button" @click="store.communicationModalOpen = true">
          <MessageSquarePlus /><span>新增沟通</span>
        </button>
        <div class="drawer-list profile-communication-list">
          <article v-for="record in records" :key="record.id || record.summary">
            <strong class="communication-record-name">{{ record.employee || record.employeeName || employee.name }}</strong>
            <small>{{ record.date || "未记录日期" }} · {{ record.type || "沟通" }}</small>
            <span>{{ record.summary || "未填写摘要" }}</span>
          </article>
          <p v-if="!records.length">暂无沟通记录。</p>
        </div>
      </section>

      <section class="drawer-section">
        <h3>关联待办</h3>
        <div class="drawer-list">
          <article v-for="todo in employeeTodos" :key="todo.id">
            <strong>{{ todo.title }}</strong>
            <span>{{ todo.priority || "P" }} · {{ todo.status || "待处理" }}</span>
          </article>
          <p v-if="!employeeTodos.length">暂无关联待办。</p>
        </div>
      </section>

      <section v-if="store.drawerEditable" class="drawer-section">
        <h3>快速记录沟通</h3>
        <form class="drawer-communication-form" @submit.prevent="saveQuickCommunication">
          <input v-model="form.date" name="date" type="date" />
          <select v-model="form.type" name="type">
            <option>1 对 1</option>
            <option>转正面谈</option>
            <option>绩效沟通</option>
            <option>合同续签</option>
          </select>
          <textarea v-model="form.summary" name="summary" rows="3" placeholder="记录本次沟通重点、员工状态和阻塞点"></textarea>
          <input v-model="form.action" name="action" placeholder="后续动作，例如：两周后复盘目标进展" />
          <button type="submit"><CheckCircle2 /><span>仅记录沟通</span></button>
        </form>
      </section>

      <div class="drawer-actions">
        <button type="button" @click="store.generateOutline(employee.key)"><WandSparkles /><span>生成沟通提纲</span></button>
        <button v-if="store.drawerEditable" type="button" @click="store.analyzeSelectedEmployee()"><ScanSearch /><span>重新分析</span></button>
      </div>
    </template>
  </aside>
</template>
