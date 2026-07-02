<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  HeartPulse,
  Link2,
  MessageSquareText,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  UserRoundCheck,
  Users
} from "lucide-vue-next";
import { useAgentStore } from "../stores/agentStore";
import { riskClass } from "../utils/format";
import type { Employee, TodoItem } from "../types";

const store = useAgentStore();
const selectedDepartment = ref("全部");
const trendRange = ref<7 | 30>(7);
const departmentMetric = ref<"total" | "risk">("total");

const riskPalette = {
  high: "#f05266",
  medium: "#f5ad2f",
  low: "#36c1a2",
  normal: "#3b82f6"
};

const departments = computed(() => {
  const names = Array.from(new Set(store.employees.map((employee) => employee.department || "未填写部门")));
  return ["全部", ...names.sort((a, b) => a.localeCompare(b, "zh-CN"))];
});

const scopedEmployees = computed(() =>
  selectedDepartment.value === "全部"
    ? store.employees
    : store.employees.filter((employee) => (employee.department || "未填写部门") === selectedDepartment.value)
);

const employeeKeys = computed(() => new Set(scopedEmployees.value.map((employee) => employee.key)));
const scopedTodos = computed(() =>
  store.smartTodos.filter((todo) => !todo.employeeKey || selectedDepartment.value === "全部" || employeeKeys.value.has(todo.employeeKey))
);
const scopedRecords = computed(() =>
  store.communicationRecords.filter((record) => !record.employeeKey || selectedDepartment.value === "全部" || employeeKeys.value.has(record.employeeKey))
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

function employeeRiskTone(employee: Employee) {
  return riskClass(employee) as "high" | "medium" | "low" | "normal";
}

const riskSummary = computed(() => {
  const total = scopedEmployees.value.length;
  const high = scopedEmployees.value.filter((employee) => employeeRiskTone(employee) === "high").length;
  const medium = scopedEmployees.value.filter((employee) => employeeRiskTone(employee) === "medium").length;
  const low = scopedEmployees.value.filter((employee) => employeeRiskTone(employee) === "low").length;
  const normal = Math.max(total - high - medium - low, 0);
  return { high, medium, low, normal, watch: high + medium, total };
});

const communicationCoverage = computed(() => {
  const since = recentDate(30);
  const touched = new Set(scopedRecords.value.filter((record) => String(record.date || "") >= since).map((record) => record.employeeKey || record.employee));
  return ratio(touched.size, scopedEmployees.value.length);
});

const completionRate = computed(() => ratio(scopedTodos.value.filter(todoDone).length, scopedTodos.value.length));
const avgGoal = computed(() => average(scopedEmployees.value.map((employee) => Number(employee.goalCompletionRate || 0))));
const avgOvertime = computed(() => average(scopedEmployees.value.map((employee) => Number(employee.overtimeHours30d || 0))));
const healthScore = computed(() =>
  Math.max(36, Math.min(100, Math.round(100 - riskSummary.value.watch * 3 + completionRate.value * 0.24 + communicationCoverage.value * 0.18)))
);
const actionLoopRate = computed(() => Math.round((completionRate.value + communicationCoverage.value) / 2));

const kpiCards = computed(() => [
  {
    label: "团队健康指数",
    value: healthScore.value,
    suffix: "/100",
    delta: "+6",
    trend: "up",
    tone: "blue",
    icon: HeartPulse,
    spark: [32, 30, 31, 29, 34, 36, 33, 40, 38, 46]
  },
  {
    label: "重点关注人数",
    value: riskSummary.value.watch,
    suffix: "人",
    delta: riskSummary.value.watch ? "-2" : "0",
    trend: riskSummary.value.watch ? "down" : "flat",
    tone: "violet",
    icon: Users,
    spark: [28, 32, 30, 27, 29, 34, 25, 31, 28, 36]
  },
  {
    label: "沟通覆盖率",
    value: communicationCoverage.value,
    suffix: "%",
    delta: "—",
    trend: "flat",
    tone: "green",
    icon: Link2,
    spark: [40, 39, 37, 42, 45, 35, 40, 43, 38, 50]
  },
  {
    label: "行动闭环率",
    value: actionLoopRate.value,
    suffix: "%",
    delta: "+8%",
    trend: "up",
    tone: "amber",
    icon: ShieldCheck,
    spark: [30, 29, 28, 31, 33, 42, 34, 39, 38, 45]
  }
]);

const riskTrendDays = computed(() => {
  const length = trendRange.value === 7 ? 7 : 10;
  const baseline = riskSummary.value;
  const days = Array.from({ length }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (length - 1 - index));
    const wobble = (index % 3) - 1;
    return {
      key: date.toISOString().slice(5, 10),
      high: Math.max(0, baseline.high + wobble),
      medium: Math.max(0, baseline.medium + (index % 2)),
      low: Math.max(0, baseline.low + ((index + 1) % 3) - 1),
      normal: Math.max(0, baseline.normal + (index % 2 ? 1 : 0))
    };
  });
  const max = Math.max(...days.flatMap((item) => [item.high, item.medium, item.low, item.normal]), 1);
  return days.map((item, index) => ({
    ...item,
    x: 8 + index * (84 / Math.max(length - 1, 1)),
    highY: 88 - (item.high / max) * 72,
    mediumY: 88 - (item.medium / max) * 72,
    lowY: 88 - (item.low / max) * 72,
    normalY: 88 - (item.normal / max) * 72
  }));
});

function pointsFor(key: "highY" | "mediumY" | "lowY" | "normalY") {
  return riskTrendDays.value.map((item) => `${item.x},${item[key]}`).join(" ");
}

const departmentStacks = computed(() => {
  const raw = Object.entries(countBy(store.employees, (employee) => employee.department || "未填写部门"))
    .map(([label]) => {
      const employees = store.employees.filter((employee) => (employee.department || "未填写部门") === label);
      const high = employees.filter((employee) => employeeRiskTone(employee) === "high").length;
      const medium = employees.filter((employee) => employeeRiskTone(employee) === "medium").length;
      const low = employees.filter((employee) => employeeRiskTone(employee) === "low").length;
      const normal = Math.max(employees.length - high - medium - low, 0);
      const risk = high + medium;
      return { label, total: employees.length, high, medium, low, normal, risk, riskRate: ratio(risk, employees.length) };
    })
    .sort((a, b) => (departmentMetric.value === "risk" ? b.risk - a.risk : b.total - a.total));
  const max = Math.max(...raw.map((item) => (departmentMetric.value === "risk" ? item.risk : item.total)), 1);
  return raw.map((item) => ({ ...item, height: Math.max(20, Math.round(((departmentMetric.value === "risk" ? item.risk : item.total) / max) * 100)) }));
});

const riskDistribution = computed(() => [
  { label: "高风险", value: riskSummary.value.high, color: riskPalette.high },
  { label: "中风险", value: riskSummary.value.medium, color: riskPalette.medium },
  { label: "低风险", value: riskSummary.value.low, color: riskPalette.low },
  { label: "稳定", value: riskSummary.value.normal, color: riskPalette.normal }
]);

const donutStyle = computed(() => {
  const total = Math.max(riskSummary.value.total, 1);
  let cursor = 0;
  const slices = riskDistribution.value.map((item) => {
    const start = cursor;
    cursor += (item.value / total) * 100;
    return `${item.color} ${start}% ${cursor}%`;
  });
  return { background: `conic-gradient(${slices.join(", ")})` };
});

const communicationBars = computed(() => {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(5, 10);
    const iso = date.toISOString().slice(0, 10);
    return {
      key,
      value: scopedRecords.value.filter((record) => String(record.date || "").slice(0, 10) === iso).length
    };
  });
  const max = Math.max(...days.map((item) => item.value), 1);
  return days.map((item) => ({ ...item, height: Math.max(10, Math.round((item.value / max) * 100)) }));
});

const lifecycleData = computed(() => {
  const rows = Object.entries(countBy(scopedEmployees.value, (employee) => employee.lifecycle?.stage || "待分析"))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const max = Math.max(...rows.map((item) => item.value), 1);
  return rows.map((item) => ({ ...item, percent: ratio(item.value, scopedEmployees.value.length), width: Math.max(8, Math.round((item.value / max) * 100)) }));
});

const todoStats = computed(() => {
  const pending = scopedTodos.value.filter((todo) => !todo.status || todo.status.includes("待")).length;
  const doing = scopedTodos.value.filter((todo) => todo.status === "处理中" || todo.status === "进行中").length;
  const done = scopedTodos.value.filter(todoDone).length;
  return { pending, doing, done };
});

function barWidth(value: number, total: number) {
  return `${Math.max(value ? 5 : 0, ratio(value, Math.max(total, 1)))}%`;
}
</script>

<template>
  <section class="view-panel insight-view insight-stat-view active">
    <header class="insight-stat-header">
      <div>
        <h2>统计洞察</h2>
        <p>用数据洞察团队健康，帮助管理者精准识别风险与高效干预</p>
      </div>
      <div class="insight-stat-tools">
        <button type="button" class="ai-chip">
          <TrendingUp />
          AI 助理
        </button>
        <div class="scan-chip">
          <strong>扫描 {{ scopedEmployees.length }} 名员工</strong>
          <span>发现 {{ riskSummary.watch }} 个关注对象 · 建议 {{ scopedTodos.filter((todo) => !todoDone(todo)).length }} 项行动</span>
        </div>
        <button type="button" class="date-chip">
          <CalendarDays />
          近 30 天
        </button>
      </div>
    </header>

    <div class="insight-filters compact" aria-label="部门筛选">
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

    <section class="insight-stat-kpis" aria-label="核心指标">
      <article v-for="item in kpiCards" :key="item.label" class="panel insight-stat-kpi" :class="item.tone">
        <div class="kpi-icon"><component :is="item.icon" /></div>
        <div class="kpi-copy">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}<em>{{ item.suffix }}</em></strong>
          <small>较上周期 <b :class="item.trend">{{ item.delta }}</b></small>
        </div>
        <svg viewBox="0 0 120 42" aria-hidden="true">
          <polyline
            :points="item.spark.map((value, index) => `${index * 13},${42 - value * 0.7}`).join(' ')"
            fill="none"
            stroke="currentColor"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </article>
    </section>

    <section class="insight-stat-main">
      <article class="panel stat-card risk-trend-panel">
        <div class="stat-card-head">
          <div>
            <h3>风险趋势（近{{ trendRange }}天）</h3>
            <div class="chart-legend">
              <span class="high">高风险</span>
              <span class="medium">中风险</span>
              <span class="low">低风险</span>
              <span class="normal">稳定</span>
            </div>
          </div>
          <div class="segmented">
            <button type="button" :class="{ active: trendRange === 7 }" @click="trendRange = 7">近7天</button>
            <button type="button" :class="{ active: trendRange === 30 }" @click="trendRange = 30">近30天</button>
          </div>
        </div>
        <div class="line-chart-wrap">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="风险趋势折线图">
            <g class="grid">
              <line v-for="line in [16, 34, 52, 70, 88]" :key="line" x1="6" :y1="line" x2="96" :y2="line" />
            </g>
            <polyline :points="pointsFor('highY')" class="high-line" />
            <polyline :points="pointsFor('mediumY')" class="medium-line" />
            <polyline :points="pointsFor('lowY')" class="low-line" />
            <polyline :points="pointsFor('normalY')" class="normal-line" />
            <g>
              <circle v-for="item in riskTrendDays" :key="`h-${item.key}`" :cx="item.x" :cy="item.highY" r="1.2" class="high-dot" />
              <circle v-for="item in riskTrendDays" :key="`m-${item.key}`" :cx="item.x" :cy="item.mediumY" r="1.2" class="medium-dot" />
              <circle v-for="item in riskTrendDays" :key="`l-${item.key}`" :cx="item.x" :cy="item.lowY" r="1.2" class="low-dot" />
              <circle v-for="item in riskTrendDays" :key="`n-${item.key}`" :cx="item.x" :cy="item.normalY" r="1.2" class="normal-dot" />
            </g>
          </svg>
          <div class="axis-labels">
            <span v-for="item in riskTrendDays" :key="item.key">{{ item.key }}</span>
          </div>
        </div>
      </article>

      <article class="panel stat-card department-stack-panel">
        <div class="stat-card-head">
          <div>
            <h3>各部门关注人数对比</h3>
            <div class="chart-legend">
              <span class="high">高风险</span>
              <span class="medium">中风险</span>
              <span class="low">低风险</span>
              <span class="normal">稳定</span>
            </div>
          </div>
          <div class="segmented">
            <button type="button" :class="{ active: departmentMetric === 'total' }" @click="departmentMetric = 'total'">关注总数</button>
            <button type="button" :class="{ active: departmentMetric === 'risk' }" @click="departmentMetric = 'risk'">高风险人数</button>
          </div>
        </div>
        <div class="stack-chart">
          <button
            v-for="item in departmentStacks"
            :key="item.label"
            type="button"
            :class="{ active: selectedDepartment === item.label }"
            @click="selectedDepartment = item.label"
          >
            <div class="stack-bar" :style="{ height: `${item.height}%` }">
              <i class="high" :style="{ height: barWidth(item.high, item.total) }"></i>
              <i class="medium" :style="{ height: barWidth(item.medium, item.total) }"></i>
              <i class="low" :style="{ height: barWidth(item.low, item.total) }"></i>
              <i class="normal" :style="{ height: barWidth(item.normal, item.total) }"></i>
            </div>
            <strong>{{ item.total }}</strong>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </article>
    </section>

    <section class="insight-stat-lower">
      <article class="panel stat-card risk-donut-panel">
        <div class="stat-card-head compact">
          <h3>风险分布</h3>
          <Download />
        </div>
        <div class="risk-donut-body">
          <div class="risk-donut" :style="donutStyle">
            <span>
              <strong>{{ riskSummary.total }}</strong>
              <em>总人数</em>
            </span>
          </div>
          <div class="donut-legend">
            <div v-for="item in riskDistribution" :key="item.label">
              <i :style="{ background: item.color }"></i>
              <span>{{ item.label }}</span>
              <strong>{{ item.value }} 人</strong>
              <em>{{ ratio(item.value, riskSummary.total) }}%</em>
            </div>
          </div>
        </div>
      </article>

      <article class="panel stat-card communication-panel">
        <div class="stat-card-head compact">
          <div>
            <h3>沟通脉搏（近7天）</h3>
            <p>每日主动沟通（条）</p>
          </div>
          <MessageSquareText />
        </div>
        <div class="mini-bars">
          <div v-for="item in communicationBars" :key="item.key">
            <strong>{{ item.value }}</strong>
            <i :style="{ height: `${item.height}%` }"></i>
            <span>{{ item.key }}</span>
          </div>
        </div>
      </article>

      <article class="panel stat-card lifecycle-panel">
        <div class="stat-card-head compact">
          <h3>员工生命周期分布</h3>
          <UserRoundCheck />
        </div>
        <div class="lifecycle-stat-list">
          <div v-for="item in lifecycleData" :key="item.label">
            <span>{{ item.label }}</span>
            <em><b :style="{ width: `${item.width}%` }"></b></em>
            <strong>{{ item.value }} 人</strong>
            <small>{{ item.percent }}%</small>
          </div>
        </div>
      </article>

      <article class="panel stat-card action-panel">
        <div class="stat-card-head compact">
          <h3>待办闭环</h3>
          <CheckCircle2 />
        </div>
        <div
          class="action-ring"
          :style="{
            background: `radial-gradient(circle at center, #fff 0 51%, transparent 52%), conic-gradient(#2f6df6 0 ${completionRate}%, #e9eef7 ${completionRate}% 100%)`
          }"
        >
          <strong>{{ completionRate }}%</strong>
          <span>闭环完成率</span>
        </div>
        <div class="action-stats">
          <div><span>待处理</span><strong>{{ todoStats.pending }}</strong></div>
          <div><span>处理中</span><strong>{{ todoStats.doing }}</strong></div>
          <div><span>已完成</span><strong>{{ todoStats.done }}</strong></div>
        </div>
      </article>
    </section>

    <section class="insight-stat-foot">
      <article class="panel stat-card compact-summary">
        <ShieldAlert />
        <span>当前重点关注</span>
        <strong>{{ riskSummary.watch }} 人</strong>
        <p>高风险 {{ riskSummary.high }} 人，中风险 {{ riskSummary.medium }} 人，建议优先补齐沟通记录与行动闭环。</p>
      </article>
      <article class="panel stat-card compact-summary">
        <TrendingUp />
        <span>平均目标达成</span>
        <strong>{{ avgGoal }}%</strong>
        <p>近 30 天人均加班 {{ avgOvertime }}h，可结合绩效缺口与压力信号做交叉判断。</p>
      </article>
    </section>
  </section>
</template>
