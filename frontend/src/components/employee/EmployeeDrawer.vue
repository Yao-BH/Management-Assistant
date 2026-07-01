<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { AlertTriangle, CheckCircle2, MessageSquarePlus, Save, ScanSearch, WandSparkles, X } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import { riskClass, signalText } from "../../utils/format";

const store = useAgentStore();
const activeTab = ref("basic");
const editing = ref(false);
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
  { key: "events", label: "关键事件" }
];

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
      editing.value = false;
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
    if (!editable) editing.value = false;
  }
);

function enableEditing() {
  if (store.drawerEditable) editing.value = true;
}

async function saveBasicInfo() {
  if (!employee.value) return;
  await store.saveEmployee({ ...basicForm, key: employee.value.key });
  editing.value = false;
}

async function complete() {
  if (!employee.value || !form.summary.trim()) return;
  await store.completeCommunication(
    {
      employee: employee.value.name,
      employeeKey: employee.value.key,
      date: form.date,
      type: form.type,
      summary: form.summary,
      action: form.action
    },
    store.selectedTodoId
  );
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

      <section v-if="editing && store.drawerEditable" class="drawer-section editable-basic-section">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Database Fields</p>
            <h3>编辑数据库基础信息</h3>
          </div>
          <button class="primary-btn small" type="button" @click="saveBasicInfo"><Save /><span>保存修改</span></button>
        </div>
        <div class="editable-basic-grid">
          <label><span>姓名</span><input v-model="basicForm.name" /></label>
          <label><span>工号</span><input v-model="basicForm.employeeId" /></label>
          <label><span>部门</span><input v-model="basicForm.department" /></label>
          <label><span>岗位</span><input v-model="basicForm.role" /></label>
          <label><span>职级</span><input v-model="basicForm.jobLevel" /></label>
          <label><span>直属主管</span><input v-model="basicForm.manager" /></label>
          <label><span>入职日期</span><input v-model="basicForm.hireDate" type="date" /></label>
          <label><span>合同到期</span><input v-model="basicForm.contractEndDate" type="date" /></label>
          <label><span>转正日期</span><input v-model="basicForm.probationEndDate" type="date" /></label>
          <label><span>当前绩效</span><input v-model="basicForm.performanceRating" /></label>
          <label><span>绩效趋势</span><input v-model="basicForm.performanceTrend" /></label>
          <label><span>目标完成率</span><input v-model.number="basicForm.goalCompletionRate" type="number" min="0" max="100" /></label>
          <label><span>30天加班</span><input v-model.number="basicForm.overtimeHours30d" type="number" min="0" /></label>
          <label><span>30天迟到</span><input v-model.number="basicForm.lateCount30d" type="number" min="0" /></label>
          <label><span>30天请假</span><input v-model.number="basicForm.leaveDays30d" type="number" min="0" step="0.5" /></label>
          <label><span>导师</span><input v-model="basicForm.mentor" /></label>
          <label class="wide"><span>成长摘要</span><textarea v-model="basicForm.growthSummary" rows="2"></textarea></label>
          <label class="wide"><span>获奖记录</span><textarea v-model="basicForm.awardsSummary" rows="2"></textarea></label>
          <label class="wide"><span>关键事件</span><textarea v-model="basicForm.keyEvents" rows="2"></textarea></label>
        </div>
      </section>

      <section class="profile-tab-card">
        <nav class="employee-detail-tabs" aria-label="员工详情分类">
          <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
            {{ tab.label }}
          </button>
        </nav>

        <div v-if="activeTab === 'basic'" class="profile-info-grid" @dblclick="enableEditing">
          <div><span>入职日期</span><strong>{{ employee.hireDate || "未填写" }}</strong></div>
          <div><span>合同到期日</span><strong>{{ employee.contractEndDate || "未填写" }}</strong></div>
          <div><span>转正日期</span><strong>{{ employee.probationEndDate || "未填写" }}</strong></div>
          <div><span>生命周期阶段</span><strong>{{ employee.lifecycle?.stage || "待分析" }}</strong></div>
          <div><span>风险等级</span><strong>{{ employee.level || "待分析" }}</strong></div>
          <div><span>最近沟通日期</span><strong>{{ latestRecord?.date || employee.communication || "暂无记录" }}</strong></div>
        </div>

        <div v-else-if="activeTab === 'performance'" class="profile-info-grid" @dblclick="enableEditing">
          <div><span>当前绩效</span><strong>{{ employee.performanceRating || employee.performance || "待分析" }}</strong></div>
          <div><span>绩效趋势</span><strong>{{ employee.performanceTrend || "未填写" }}</strong></div>
          <div><span>目标完成率</span><strong>{{ employee.goalCompletionRate || 0 }}%</strong></div>
          <div class="wide"><span>AI 绩效判断</span><strong>{{ employee.reason || "暂无 AI 绩效判断" }}</strong></div>
        </div>

        <div v-else-if="activeTab === 'growth'" class="profile-info-grid" @dblclick="enableEditing">
          <div><span>导师</span><strong>{{ employee.mentor || "未填写" }}</strong></div>
          <div><span>成长阶段</span><strong>{{ employee.lifecycle?.stage || "待分析" }}</strong></div>
          <div class="wide"><span>成长摘要</span><strong>{{ employee.growthSummary || employee.lifecycle?.detail || "暂无成长摘要" }}</strong></div>
        </div>

        <div v-else-if="activeTab === 'awards'" class="profile-info-grid" @dblclick="enableEditing">
          <div class="wide"><span>获奖记录</span><strong>{{ employee.awardsSummary || "暂无获奖记录" }}</strong></div>
        </div>

        <div v-else-if="activeTab === 'attendance'" class="profile-info-grid" @dblclick="enableEditing">
          <div><span>30天加班</span><strong>{{ employee.overtimeHours30d || 0 }} 小时</strong></div>
          <div><span>30天迟到</span><strong>{{ employee.lateCount30d || 0 }} 次</strong></div>
          <div><span>30天请假</span><strong>{{ employee.leaveDays30d || 0 }} 天</strong></div>
          <div class="wide"><span>AI 考勤摘要</span><strong>{{ employee.attendance || "待分析" }}</strong></div>
        </div>

        <div v-else class="profile-info-grid" @dblclick="enableEditing">
          <div class="wide"><span>关键事件</span><strong>{{ employee.keyEvents || "暂无关键事件" }}</strong></div>
          <div class="wide"><span>风险证据</span><strong>{{ evidence.join("；") || "暂无风险证据" }}</strong></div>
        </div>
      </section>

      <section class="drawer-section">
        <h3>沟通记录</h3>
        <button v-if="store.drawerEditable" class="select-btn small profile-add-record" type="button" @click="store.communicationModalOpen = true">
          <MessageSquarePlus /><span>新增沟通</span>
        </button>
        <div class="drawer-list profile-communication-list">
          <article v-for="record in records" :key="record.id || record.summary">
            <strong>{{ record.date || "未记录日期" }} · {{ record.type || "沟通" }}</strong>
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
        <h3>记录沟通并闭环</h3>
        <form class="drawer-communication-form" @submit.prevent="complete">
          <input v-model="form.date" name="date" type="date" />
          <select v-model="form.type" name="type">
            <option>1 对 1</option>
            <option>转正面谈</option>
            <option>绩效沟通</option>
            <option>合同续签</option>
          </select>
          <textarea v-model="form.summary" name="summary" rows="3" placeholder="记录本次沟通重点、员工状态和阻塞点"></textarea>
          <input v-model="form.action" name="action" placeholder="后续动作，例如：两周后复盘目标进展" />
          <button type="submit"><CheckCircle2 /><span>记录并完成待办</span></button>
        </form>
      </section>

      <div class="drawer-actions">
        <button type="button" @click="store.generateOutline(employee.key)"><WandSparkles /><span>生成沟通提纲</span></button>
        <button v-if="store.drawerEditable" type="button" @click="store.analyzeSelectedEmployee()"><ScanSearch /><span>重新分析</span></button>
      </div>
    </template>
  </aside>
</template>
