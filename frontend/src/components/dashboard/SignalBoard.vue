<script setup lang="ts">
import { computed, ref } from "vue";
import { Cake, CalendarClock, CheckCircle2, ClipboardList, MessageCircle, ShieldCheck, Sparkles } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import type { Employee } from "../../types";
import { riskClass } from "../../utils/format";

const store = useAgentStore();
const reminderTab = ref<"birthday" | "anniversary" | "contract">("birthday");

const highRisk = computed(() => store.employees.filter((employee) => riskClass(employee) === "high").length);
const mediumRisk = computed(() => store.employees.filter((employee) => riskClass(employee) === "medium").length);
const watchCount = computed(() => highRisk.value + mediumRisk.value);
const pendingTodos = computed(() => store.smartTodos.filter((todo) => !String(todo.status || "").includes("完成")).length);
const doneTodos = computed(() => Math.max(store.smartTodos.length - pendingTodos.value, 0));
const communicationCoverage = computed(() => {
  if (!store.employees.length) return 0;
  const touched = new Set(
    store.communicationRecords
      .map((record) => record.employeeKey || record.employee || record.employeeName)
      .filter(Boolean)
  );
  return Math.round((touched.size / store.employees.length) * 100);
});
const closureRate = computed(() => {
  if (!store.smartTodos.length) return 0;
  return Math.round((doneTodos.value / store.smartTodos.length) * 100);
});

const riskSummary = computed(() => {
  if (highRisk.value > 0) return `团队有 ${highRisk.value} 名高风险员工，建议优先确认阻塞点。`;
  if (watchCount.value > 0) return `${watchCount.value} 名员工需要持续关注，适合安排本周跟进。`;
  return "团队风险处于可控区间，保持正常沟通节奏。";
});

const communicationSummary = computed(() => {
  if (communicationCoverage.value < 70) return "沟通覆盖仍有缺口，建议补齐重点员工的最近记录。";
  if (closureRate.value < 50 && store.smartTodos.length) return "沟通覆盖不错，但待办闭环偏慢，需要推进动作完成。";
  return "沟通与闭环节奏稳定，适合沉淀为可复用管理动作。";
});

function daysUntil(monthDay?: string) {
  if (!monthDay) return Number.POSITIVE_INFINITY;
  const raw = String(monthDay);
  const now = new Date();
  const fullDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (fullDate) {
    const target = new Date(Number(fullDate[1]), Number(fullDate[2]) - 1, Number(fullDate[3]));
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
  }
  const parts = raw.split("-").map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return Number.POSITIVE_INFINITY;
  const target = new Date(now.getFullYear(), parts[0] - 1, parts[1]);
  if (target < now) target.setFullYear(now.getFullYear() + 1);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function monthDay(value?: string) {
  if (!value) return "";
  const match = String(value).match(/(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function employeeBirthday(employee: Employee) {
  const raw = (employee as Employee & { birthday?: string; birthDate?: string }).birthday || (employee as Employee & { birthDate?: string }).birthDate;
  return monthDay(raw);
}

const reminderItems = computed(() => {
  const employees = store.employees;
  if (reminderTab.value === "birthday") {
    return employees
      .map((employee) => ({ employee, date: employeeBirthday(employee), type: "生日", action: "准备祝福与近况关怀" }))
      .filter((item) => item.date)
      .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
      .slice(0, 3);
  }
  if (reminderTab.value === "anniversary") {
    return employees
      .map((employee) => ({ employee, date: monthDay(employee.hireDate), type: "入职周年", action: "回顾成长节点与下一步目标" }))
      .filter((item) => item.date)
      .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
      .slice(0, 3);
  }
  return employees
    .map((employee) => ({ employee, date: employee.contractEndDate || employee.probationEndDate || "", type: employee.contractEndDate ? "合同提醒" : "试用期提醒", action: "确认续约、转正或沟通安排" }))
    .filter((item) => item.date)
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
    .slice(0, 3);
});

const reminderEmptyText = computed(() => {
  if (reminderTab.value === "birthday") return "暂无可用生日信息，导入员工生日后会自动提醒。";
  if (reminderTab.value === "anniversary") return "暂无入职日期信息，补充后可查看周年提醒。";
  return "暂无合同或试用期节点，后续补充后会在这里呈现。";
});
</script>

<template>
  <section class="panel signal-panel team-insight-panel" aria-label="AI 团队洞察">
    <div class="team-insight-head">
      <div class="team-insight-title">
        <span class="insight-mark"><Sparkles /></span>
        <div>
          <h2>AI 团队洞察</h2>
          <p>基于员工档案、沟通记录、风险信号和待办闭环生成今日建议</p>
        </div>
      </div>
    </div>

    <div class="team-analysis-grid">
      <article class="team-analysis-card risk-card">
        <header>
          <span><ShieldCheck /></span>
          <div>
            <h3>团队风险分析</h3>
            <small>较昨日</small>
          </div>
        </header>
        <div class="analysis-metrics">
          <div>
            <strong>{{ watchCount }}</strong>
            <span>重点关注员工</span>
          </div>
          <div>
            <strong>{{ highRisk }}</strong>
            <span>高风险员工</span>
          </div>
          <div>
            <strong>{{ pendingTodos }}</strong>
            <span>待处理动作</span>
          </div>
        </div>
        <p class="analysis-note">{{ riskSummary }}</p>
      </article>

      <article class="team-analysis-card communication-card">
        <header>
          <span><MessageCircle /></span>
          <div>
            <h3>沟通与闭环分析</h3>
            <small>较昨日</small>
          </div>
        </header>
        <div class="analysis-metrics">
          <div>
            <strong>{{ communicationCoverage }}%</strong>
            <span>沟通覆盖率</span>
          </div>
          <div>
            <strong>{{ pendingTodos }}</strong>
            <span>待办动作</span>
          </div>
          <div>
            <strong>{{ closureRate }}%</strong>
            <span>闭环完成率</span>
          </div>
        </div>
        <p class="analysis-note">{{ communicationSummary }}</p>
      </article>
    </div>

    <section class="reminder-dock" aria-label="员工提醒">
      <div class="reminder-dock-head">
        <h3>员工节点提醒</h3>
        <div class="reminder-tabs">
          <button type="button" :class="{ active: reminderTab === 'birthday' }" @click="reminderTab = 'birthday'"><Cake />生日</button>
          <button type="button" :class="{ active: reminderTab === 'anniversary' }" @click="reminderTab = 'anniversary'"><CalendarClock />周年</button>
          <button type="button" :class="{ active: reminderTab === 'contract' }" @click="reminderTab = 'contract'"><ClipboardList />合同</button>
        </div>
      </div>

      <div class="reminder-list">
        <button
          v-for="item in reminderItems"
          :key="`${item.employee.key}-${item.type}`"
          class="reminder-item"
          type="button"
          @click="store.openEmployeeDrawer(item.employee.key, false)"
        >
          <span class="reminder-avatar">{{ item.employee.name.slice(0, 1) }}</span>
          <span>
            <strong>{{ item.employee.name }}</strong>
            <small>{{ item.type }} · {{ item.date }}</small>
          </span>
          <em>{{ item.action }}</em>
        </button>
        <div v-if="!reminderItems.length" class="reminder-empty">
          <CheckCircle2 />
          <span>{{ reminderEmptyText }}</span>
        </div>
      </div>
    </section>
  </section>
</template>
