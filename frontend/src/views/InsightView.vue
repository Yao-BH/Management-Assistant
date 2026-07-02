<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Activity,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Gauge,
  MessageSquareText,
  Network,
  Radar,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  UserRoundCheck
} from "lucide-vue-next";
import { useAgentStore } from "../stores/agentStore";
import { riskClass } from "../utils/format";
import type { Employee, TodoItem } from "../types";

const store = useAgentStore();
const selectedDepartment = ref("全部");
const focusMode = ref<"risk" | "performance" | "communication">("risk");

const departments = computed(() => {
  const names = Array.from(new Set(store.employees.map((employee) => employee.department || "未填写部门")));
  return ["全部", ...names.sort((a, b) => a.localeCompare(b, "zh-CN"))];
});

const scopedEmployees = computed(() =>
  selectedDepartment.value === "全部"
    ? store.employees
    : store.employees.filter((employee) => (employee.department || "未填写部门") === selectedDepartment.value)
);

function countBy<T>(items: T[], keyGetter: (item: T) => string) {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = keyGetter(item) || "未填写";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

function todoDone(todo: TodoItem) {
  return String(todo.status || "").includes("完成") || String(todo.status || "").includes("关闭");
}

function recentDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const employeeKeys = computed(() => new Set(scopedEmployees.value.map((employee) => employee.key)));
const scopedTodos = computed(() =>
  store.smartTodos.filter((todo) => !todo.employeeKey || selectedDepartment.value === "全部" || employeeKeys.value.has(todo.employeeKey))
);
const scopedRecords = computed(() =>
  store.communicationRecords.filter((record) => !record.employeeKey || selectedDepartment.value === "全部" || employeeKeys.value.has(record.employeeKey))
);

const riskSummary = computed(() => {
  const total = scopedEmployees.value.length;
  const high = scopedEmployees.value.filter((employee) => riskClass(employee) === "high").length;
  const medium = scopedEmployees.value.filter((employee) => riskClass(employee) === "medium").length;
  const low = scopedEmployees.value.filter((employee) => riskClass(employee) === "low").length;
  const normal = Math.max(total - high - medium - low, 0);
  return { high, medium, low, normal, watch: high + medium };
});

const communicationCoverage = computed(() => {
  const since = recentDate(30);
  const touched = new Set(scopedRecords.value.filter((record) => String(record.date || "") >= since).map((record) => record.employeeKey || record.employee));
  return ratio(touched.size, scopedEmployees.value.length);
});

const completionRate = computed(() => ratio(scopedTodos.value.filter(todoDone).length, scopedTodos.value.length));
const avgGoal = computed(() => average(scopedEmployees.value.map((employee) => Number(employee.goalCompletionRate || 0))));
const avgOvertime = computed(() => average(scopedEmployees.value.map((employee) => Number(employee.overtimeHours30d || 0))));
const intelligenceScore = computed(() =>
  Math.max(36, Math.min(96, Math.round(100 - riskSummary.value.watch * 3 + completionRate.value * 0.28 + communicationCoverage.value * 0.24)))
);

const kpis = computed(() => [
  {
    label: "团队人数",
    value: scopedEmployees.value.length,
    suffix: "人",
    hint: `${departments.value.length - 1} 个部门已入库`,
    tone: "blue",
    icon: Users
  },
  {
    label: "重点关注率",
    value: ratio(riskSummary.value.watch, scopedEmployees.value.length),
    suffix: "%",
    hint: `${riskSummary.value.watch} 人高/中风险`,
    tone: "pink",
    icon: ShieldAlert
  },
  {
    label: "沟通覆盖",
    value: communicationCoverage.value,
    suffix: "%",
    hint: "近 30 天有记录员工",
    tone: "cyan",
    icon: MessageSquareText
  },
  {
    label: "闭环完成率",
    value: completionRate.value,
    suffix: "%",
    hint: `${scopedTodos.value.filter(todoDone).length}/${scopedTodos.value.length || 0} 项待办完成`,
    tone: "green",
    icon: CheckCircle2
  },
  {
    label: "平均目标达成",
    value: avgGoal.value,
    suffix: "%",
    hint: "员工目标完成率均值",
    tone: "amber",
    icon: TrendingUp
  },
  {
    label: "30天人均加班",
    value: avgOvertime.value,
    suffix: "h",
    hint: "压力与交付负荷指标",
    tone: "violet",
    icon: CalendarClock
  }
]);

const riskBars = computed(() => [
  { label: "高风险", value: riskSummary.value.high, tone: "high" },
  { label: "中风险", value: riskSummary.value.medium, tone: "medium" },
  { label: "低风险", value: riskSummary.value.low, tone: "low" },
  { label: "稳定", value: riskSummary.value.normal, tone: "normal" }
]);

const lifecycleData = computed(() =>
  Object.entries(countBy(scopedEmployees.value, (employee) => employee.lifecycle?.stage || "待分析"))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
);

const levelData = computed(() =>
  Object.entries(countBy(scopedEmployees.value, (employee) => employee.jobLevel || "未填写"))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"))
);

const departmentData = computed(() =>
  Object.entries(countBy(store.employees, (employee) => employee.department || "未填写部门"))
    .map(([label, value]) => {
      const employees = store.employees.filter((employee) => (employee.department || "未填写部门") === label);
      const risky = employees.filter((employee) => ["high", "medium"].includes(riskClass(employee))).length;
      return { label, value, risky, riskRate: ratio(risky, value) };
    })
    .sort((a, b) => b.value - a.value)
);

const trendDays = computed(() => {
  const days = Array.from({ length: 10 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (9 - index));
    const key = date.toISOString().slice(5, 10);
    const iso = date.toISOString().slice(0, 10);
    return {
      key,
      value: scopedRecords.value.filter((record) => String(record.date || "").slice(0, 10) === iso).length
    };
  });
  const max = Math.max(...days.map((item) => item.value), 1);
  return days.map((item) => ({ ...item, height: Math.max(8, Math.round((item.value / max) * 100)) }));
});

const topEmployees = computed(() => {
  const ranked = [...scopedEmployees.value];
  if (focusMode.value === "performance") {
    return ranked
      .sort((a, b) => Number(a.goalCompletionRate || 0) - Number(b.goalCompletionRate || 0))
      .slice(0, 6)
      .map((employee) => ({
        employee,
        score: Number(employee.goalCompletionRate || 0),
        label: `${employee.goalCompletionRate || 0}% 目标达成`,
        detail: employee.performance || employee.performanceTrend || "绩效待补充"
      }));
  }
  if (focusMode.value === "communication") {
    return ranked
      .sort((a, b) => communicationCount(a) - communicationCount(b))
      .slice(0, 6)
      .map((employee) => ({
        employee,
        score: communicationCount(employee),
        label: `${communicationCount(employee)} 条沟通`,
        detail: employee.communication || "需要补充沟通记录"
      }));
  }
  return ranked
    .sort((a, b) => Number(b.risk || 0) - Number(a.risk || 0))
    .slice(0, 6)
    .map((employee) => ({
      employee,
      score: Number(employee.risk || 0),
      label: `${employee.risk || 0} 风险分`,
      detail: employee.reason || "等待风险解释"
    }));
});

function communicationCount(employee: Employee) {
  return store.communicationRecords.filter((record) => record.employeeKey === employee.key || record.employee === employee.name).length;
}

function maxValue(items: Array<{ value: number }>) {
  return Math.max(...items.map((item) => item.value), 1);
}

function barWidth(value: number, max: number) {
  return `${Math.max(5, Math.round((value / max) * 100))}%`;
}
</script>

<template>
  <section class="view-panel insight-view active">
    <section class="insight-hero panel">
      <div class="insight-hero-copy">
        <p class="eyebrow">Intelligence Dashboard</p>
        <h2>组织智能驾驶舱</h2>
        <p>基于员工档案、生命周期、职级、沟通记录、风险信号和待办闭环，实时扫描团队健康度和管理动作进展。</p>
        <div class="insight-filters" aria-label="部门筛选">
          <button
            v-for="department in departments"
            :key="department"
            type="button"
            :class="{ active: selectedDepartment === department }"
            @click="selectedDepartment = department"
          >
            {{ department }}
          </button>
        </div>
      </div>

      <div class="command-orb" :style="{ '--score': `${intelligenceScore}%` }">
        <div>
          <BrainCircuit />
          <strong>{{ intelligenceScore }}</strong>
          <span>AI 健康指数</span>
        </div>
      </div>
    </section>

    <section class="insight-kpi-grid">
      <article v-for="item in kpis" :key="item.label" class="insight-kpi-card panel" :class="item.tone">
        <component :is="item.icon" />
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}<em>{{ item.suffix }}</em></strong>
        <small>{{ item.hint }}</small>
      </article>
    </section>

    <section class="insight-main-grid">
      <article class="panel risk-command-card">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Risk Radar</p>
            <h2>风险结构雷达</h2>
          </div>
          <Radar />
        </div>

        <div class="risk-orbit" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <i class="hot"></i>
          <i class="warm"></i>
          <i class="safe"></i>
        </div>

        <div class="risk-bar-stack">
          <div v-for="item in riskBars" :key="item.label" :class="item.tone">
            <span>{{ item.label }}</span>
            <em><b :style="{ width: barWidth(item.value, scopedEmployees.length || 1) }"></b></em>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </article>

      <article class="panel heatmap-card">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Department Matrix</p>
            <h2>部门热力矩阵</h2>
          </div>
          <Network />
        </div>
        <div class="department-heatmap">
          <button
            v-for="item in departmentData"
            :key="item.label"
            type="button"
            :class="{ active: selectedDepartment === item.label }"
            :style="{ '--heat': `${Math.max(18, item.riskRate)}%` }"
            @click="selectedDepartment = item.label"
          >
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }} 人</span>
            <em>关注率 {{ item.riskRate }}%</em>
          </button>
        </div>
      </article>

      <article class="panel trend-card">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Communication Pulse</p>
            <h2>近 10 天沟通脉冲</h2>
          </div>
          <Activity />
        </div>
        <div class="pulse-chart">
          <div v-for="item in trendDays" :key="item.key">
            <i :style="{ height: `${item.height}%` }"></i>
            <strong>{{ item.value }}</strong>
            <span>{{ item.key }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="insight-lower-grid">
      <article class="panel lifecycle-card">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Lifecycle</p>
            <h2>生命周期分布</h2>
          </div>
          <UserRoundCheck />
        </div>
        <div class="lifecycle-lanes">
          <div v-for="item in lifecycleData" :key="item.label">
            <span>{{ item.label }}</span>
            <em><b :style="{ width: barWidth(item.value, maxValue(lifecycleData)) }"></b></em>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </article>

      <article class="panel level-card">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Job Level</p>
            <h2>职级梯队</h2>
          </div>
          <Gauge />
        </div>
        <div class="level-rings">
          <div v-for="item in levelData" :key="item.label">
            <strong>{{ item.label }}</strong>
            <span :style="{ height: `${Math.max(22, Math.round((item.value / maxValue(levelData)) * 100))}%` }"></span>
            <em>{{ item.value }}</em>
          </div>
        </div>
      </article>

      <article class="panel focus-rank-card">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">AI Focus Rank</p>
            <h2>智能关注榜</h2>
          </div>
          <Sparkles />
        </div>
        <div class="focus-mode-switch">
          <button type="button" :class="{ active: focusMode === 'risk' }" @click="focusMode = 'risk'">风险优先</button>
          <button type="button" :class="{ active: focusMode === 'performance' }" @click="focusMode = 'performance'">绩效缺口</button>
          <button type="button" :class="{ active: focusMode === 'communication' }" @click="focusMode = 'communication'">沟通空白</button>
        </div>
        <div class="focus-rank-list">
          <button
            v-for="item in topEmployees"
            :key="item.employee.key"
            type="button"
            @dblclick="store.openEmployeeDrawer(item.employee.key, false)"
          >
            <b>{{ item.employee.name.slice(0, 1) }}</b>
            <span>
              <strong>{{ item.employee.name }}</strong>
              <small>{{ item.employee.department || "未填写部门" }} · {{ item.employee.jobLevel || "未填写职级" }}</small>
            </span>
            <em>{{ item.label }}</em>
            <p>{{ item.detail }}</p>
          </button>
        </div>
      </article>

      <article class="panel todo-closure-card">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Action Closure</p>
            <h2>待办闭环结构</h2>
          </div>
          <ClipboardList />
        </div>
        <div class="closure-meter">
          <span :style="{ width: `${completionRate}%` }"></span>
          <strong>{{ completionRate }}%</strong>
        </div>
        <div class="closure-stats">
          <div><span>待处理</span><strong>{{ scopedTodos.filter((todo) => !todo.status || todo.status.includes("待")).length }}</strong></div>
          <div><span>处理中</span><strong>{{ scopedTodos.filter((todo) => todo.status === "处理中" || todo.status === "进行中").length }}</strong></div>
          <div><span>已完成</span><strong>{{ scopedTodos.filter(todoDone).length }}</strong></div>
        </div>
      </article>
    </section>
  </section>
</template>
