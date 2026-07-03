<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, GraphicComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { graphic, init, use, type EChartsType } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import {
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

use([BarChart, CanvasRenderer, GraphicComponent, GridComponent, LegendComponent, LineChart, PieChart, TooltipComponent]);

const store = useAgentStore();
const selectedDepartment = ref("全部");
const trendRange = ref<7 | 30>(7);
const departmentMetric = ref<"total" | "risk">("total");
const riskTrendChartEl = ref<HTMLElement | null>(null);
const departmentChartEl = ref<HTMLElement | null>(null);
const riskDonutChartEl = ref<HTMLElement | null>(null);
const communicationChartEl = ref<HTMLElement | null>(null);
const riskTrendChart = shallowRef<EChartsType | null>(null);
const departmentChart = shallowRef<EChartsType | null>(null);
const riskDonutChart = shallowRef<EChartsType | null>(null);
const communicationChart = shallowRef<EChartsType | null>(null);

const riskPalette = {
  high: "#f05266",
  medium: "#f5ad2f",
  low: "#36c1a2",
  normal: "#3b82f6"
};

const riskLegend = [
  { key: "high", label: "高风险", color: riskPalette.high },
  { key: "medium", label: "中风险", color: riskPalette.medium },
  { key: "low", label: "低风险", color: riskPalette.low },
  { key: "normal", label: "稳定", color: riskPalette.normal }
] as const;

const chartTextColor = "#667085";
const chartAxisColor = "#e9eef6";

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
  const backendTrend = store.statistics.riskTrend || [];
  if (backendTrend.length) {
    return backendTrend.slice(-length).map((item) => ({
      key: item.key || String(item.date || "").slice(5, 10),
      high: Number(item.high || 0),
      medium: Number(item.medium || 0),
      low: Number(item.low || 0),
      normal: Number(item.normal || 0)
    }));
  }
  const baseline = riskSummary.value;
  const days = Array.from({ length }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (length - 1 - index));
    return {
      key: date.toISOString().slice(5, 10),
      high: baseline.high,
      medium: baseline.medium,
      low: baseline.low,
      normal: baseline.normal
    };
  });
  return days;
});

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

function tooltipShell(title: string, rows: string[], footer = "") {
  return `
    <div class="echart-tooltip">
      <strong>${title}</strong>
      ${rows.join("")}
      ${footer ? `<em>${footer}</em>` : ""}
    </div>
  `;
}

function tooltipRow(color: string, label: string, value: string) {
  return `<span><i style="background:${color}"></i>${label}<b>${value}</b></span>`;
}

function commonGrid() {
  return {
    top: 22,
    right: 16,
    bottom: 38,
    left: 24,
    containLabel: true
  };
}

function riskTrendOption() {
  const days = riskTrendDays.value;
  const maxValue = Math.max(...days.flatMap((item) => [item.high, item.medium, item.low, item.normal]), 1);
  const yMax = Math.max(8, Math.ceil(maxValue * 1.22));
  return {
    color: riskLegend.map((item) => item.color),
    animationDuration: 520,
    grid: commonGrid(),
    tooltip: {
      trigger: "axis",
      appendToBody: true,
      borderWidth: 0,
      padding: 0,
      backgroundColor: "transparent",
      axisPointer: {
        type: "line",
        lineStyle: { color: "#94a3b8", type: "dashed", width: 1 },
        label: { show: false }
      },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [];
        const title = String(list[0]?.axisValue || "");
        const rows = list.map((item: { color: string; seriesName: string; value: number }) =>
          tooltipRow(item.color, item.seriesName, `${item.value} 人`)
        );
        const total = list.reduce((sum: number, item: { value: number }) => sum + Number(item.value || 0), 0);
        return tooltipShell(title, rows, `合计 ${total} 人 · 当前档案快照`);
      }
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: days.map((item) => item.key),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartAxisColor } },
      axisLabel: { color: chartTextColor, fontSize: 11, margin: 14, hideOverlap: true }
    },
    yAxis: {
      type: "value",
      min: 0,
      max: yMax,
      splitNumber: 4,
      axisLabel: { color: chartTextColor, fontSize: 11 },
      splitLine: { lineStyle: { color: chartAxisColor } }
    },
    series: [
      { name: "高风险", key: "high", color: riskPalette.high },
      { name: "中风险", key: "medium", color: riskPalette.medium },
      { name: "低风险", key: "low", color: riskPalette.low },
      { name: "稳定", key: "normal", color: riskPalette.normal }
    ].map((series) => ({
      name: series.name,
      type: "line",
      smooth: 0.35,
      symbol: "circle",
      symbolSize: 8,
      showSymbol: true,
      lineStyle: { width: 3, color: series.color },
      itemStyle: { color: series.color, borderColor: "#fff", borderWidth: 2 },
      emphasis: { focus: "series", scale: 1.35 },
      data: days.map((item) => item[series.key as keyof typeof item])
    }))
  };
}

function departmentOption() {
  const rows = departmentStacks.value;
  return {
    color: riskLegend.map((item) => item.color),
    animationDuration: 520,
    grid: { ...commonGrid(), top: 20, bottom: 48 },
    tooltip: {
      trigger: "axis",
      appendToBody: true,
      borderWidth: 0,
      padding: 0,
      backgroundColor: "transparent",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(47, 109, 246, 0.08)" } },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [];
        const title = String(list[0]?.axisValue || "");
        const row = rows.find((item) => item.label === title);
        const total = row?.total || 0;
        const values = [
          { label: "高风险", value: row?.high || 0, color: riskPalette.high },
          { label: "中风险", value: row?.medium || 0, color: riskPalette.medium },
          { label: "低风险", value: row?.low || 0, color: riskPalette.low },
          { label: "稳定", value: row?.normal || 0, color: riskPalette.normal }
        ];
        return tooltipShell(
          title,
          values.map((item) => tooltipRow(item.color, item.label, `${item.value} 人 · ${ratio(item.value, total)}%`)),
          `合计 ${total} 人 · 点击筛选该部门`
        );
      }
    },
    xAxis: {
      type: "category",
      data: rows.map((item) => item.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartAxisColor } },
      axisLabel: { color: chartTextColor, fontSize: 11, interval: 0, margin: 14, hideOverlap: true }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: chartTextColor, fontSize: 11 },
      splitLine: { lineStyle: { color: chartAxisColor } }
    },
    series: riskLegend.map((item) => ({
      name: item.label,
      type: "bar",
      stack: "risk",
      barWidth: 28,
      emphasis: { focus: "series" },
      itemStyle: { borderRadius: item.key === "normal" ? [5, 5, 0, 0] : 0 },
      data: rows.map((row) => row[item.key])
    }))
  };
}

function riskDonutOption() {
  const total = riskSummary.value.total;
  return {
    color: riskDistribution.value.map((item) => item.color),
    animationDuration: 520,
    tooltip: {
      trigger: "item",
      appendToBody: true,
      borderWidth: 0,
      padding: 0,
      backgroundColor: "transparent",
      formatter: (item: { color: string; name: string; value: number }) =>
        tooltipShell(item.name, [tooltipRow(item.color, "人数占比", `${item.value} 人 · ${ratio(item.value, total)}%`)], `总人数 ${total} 人`)
    },
    legend: {
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemWidth: 9,
      itemHeight: 9,
      icon: "circle",
      itemGap: 10,
      textStyle: { color: chartTextColor, fontSize: 11, fontWeight: 700 },
      formatter: (name: string) => {
        const item = riskDistribution.value.find((row) => row.label === name);
        return `${name} ${item?.value || 0}人 ${ratio(item?.value || 0, total)}%`;
      }
    },
    graphic: [
      { type: "text", left: "center", top: "39%", style: { text: `${total}`, fill: "#111827", fontSize: 28, fontWeight: 900, textAlign: "center" } },
      { type: "text", left: "center", top: "53%", style: { text: "总人数", fill: chartTextColor, fontSize: 12, fontWeight: 800, textAlign: "center" } }
    ],
    series: [
      {
        name: "风险分布",
        type: "pie",
        radius: ["48%", "70%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        emphasis: { scale: true, scaleSize: 8 },
        data: riskDistribution.value.map((item) => ({ name: item.label, value: item.value }))
      }
    ]
  };
}

function communicationOption() {
  const days = communicationBars.value;
  return {
    color: ["#2f6df6"],
    animationDuration: 520,
    grid: { top: 20, right: 12, bottom: 34, left: 22, containLabel: true },
    tooltip: {
      trigger: "axis",
      appendToBody: true,
      borderWidth: 0,
      padding: 0,
      backgroundColor: "transparent",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(47, 109, 246, 0.08)" } },
      formatter: (params: unknown) => {
        const item = Array.isArray(params) ? params[0] : null;
        return tooltipShell(String(item?.axisValue || ""), [tooltipRow("#2f6df6", "主动沟通", `${Number(item?.value || 0)} 条`)]);
      }
    },
    xAxis: {
      type: "category",
      data: days.map((item) => item.key),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartAxisColor } },
      axisLabel: { color: chartTextColor, fontSize: 11, hideOverlap: true }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: chartTextColor, fontSize: 11 },
      splitLine: { lineStyle: { color: chartAxisColor } }
    },
    series: [
      {
        name: "主动沟通",
        type: "bar",
        barWidth: 22,
        itemStyle: {
          borderRadius: [5, 5, 2, 2],
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#2f6df6" },
            { offset: 1, color: "#75a7ff" }
          ])
        },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: "rgba(47, 109, 246, 0.22)" } },
        data: days.map((item) => item.value)
      }
    ]
  };
}

function ensureCharts() {
  if (riskTrendChartEl.value && !riskTrendChart.value) riskTrendChart.value = init(riskTrendChartEl.value);
  if (departmentChartEl.value && !departmentChart.value) {
    departmentChart.value = init(departmentChartEl.value);
    departmentChart.value.on("click", (params) => {
      if (typeof params.name === "string") selectedDepartment.value = params.name;
    });
  }
  if (riskDonutChartEl.value && !riskDonutChart.value) riskDonutChart.value = init(riskDonutChartEl.value);
  if (communicationChartEl.value && !communicationChart.value) communicationChart.value = init(communicationChartEl.value);
}

function renderCharts() {
  nextTick(() => {
    ensureCharts();
    riskTrendChart.value?.setOption(riskTrendOption(), true);
    departmentChart.value?.setOption(departmentOption(), true);
    riskDonutChart.value?.setOption(riskDonutOption(), true);
    communicationChart.value?.setOption(communicationOption(), true);
  });
}

function resizeCharts() {
  riskTrendChart.value?.resize();
  departmentChart.value?.resize();
  riskDonutChart.value?.resize();
  communicationChart.value?.resize();
}

onMounted(() => {
  renderCharts();
  window.addEventListener("resize", resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCharts);
  riskTrendChart.value?.dispose();
  departmentChart.value?.dispose();
  riskDonutChart.value?.dispose();
  communicationChart.value?.dispose();
});

watch([riskTrendDays, departmentStacks, riskDistribution, communicationBars], renderCharts, { deep: true });
</script>

<template>
  <section class="view-panel insight-view insight-stat-view active">
    <header class="insight-stat-header">
      <div>
        <h2>统计洞察</h2>
        <p>用数据洞察团队健康，帮助管理者精准识别风险与高效干预</p>
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
        <div ref="riskTrendChartEl" class="echart-panel risk-trend-chart" aria-label="风险趋势折线图"></div>
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
        <div ref="departmentChartEl" class="echart-panel department-chart" aria-label="各部门关注人数对比柱状图"></div>
      </article>
    </section>

    <section class="insight-stat-lower">
      <article class="panel stat-card risk-donut-panel">
        <div class="stat-card-head compact">
          <h3>风险分布</h3>
          <Download />
        </div>
        <div ref="riskDonutChartEl" class="echart-panel risk-donut-chart" aria-label="风险分布环形图"></div>
      </article>

      <article class="panel stat-card communication-panel">
        <div class="stat-card-head compact">
          <div>
            <h3>沟通脉搏（近7天）</h3>
            <p>每日主动沟通（条）</p>
          </div>
          <MessageSquareText />
        </div>
        <div ref="communicationChartEl" class="echart-panel communication-chart" aria-label="沟通脉搏柱状图"></div>
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
