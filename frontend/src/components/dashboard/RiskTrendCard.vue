<script setup lang="ts">
import { computed } from "vue";
import { HeartPulse } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import { riskClass } from "../../utils/format";

const store = useAgentStore();

const trendPoints = computed(() => {
  const base = store.employees.filter((employee) => riskClass(employee) !== "normal").length;
  const todoPressure = Math.ceil(store.smartTodos.length / 5);
  const values = [base - 3, base - 2, base - 1, base + 1, base, base + todoPressure, base + todoPressure + 1].map((value) => Math.max(value, 0));
  const max = Math.max(...values, 1);
  return values.map((value, index) => ({
    label: `05/${String(index + 5).padStart(2, "0")}`,
    value,
    x: 20 + index * 48,
    y: 146 - (value / max) * 86
  }));
});

const trendPath = computed(() => trendPoints.value.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "));
const latestPoint = computed(() => trendPoints.value[trendPoints.value.length - 1]);
const latestTrend = computed(() => latestPoint.value?.value || 0);
</script>

<template>
  <section class="panel risk-trend-card">
    <div class="risk-trend-head">
      <div>
        <HeartPulse />
        <h3>风险趋势</h3>
      </div>
      <button type="button">近 7 天</button>
    </div>
    <svg viewBox="0 0 330 180" role="img" aria-label="近 7 天风险趋势">
      <defs>
        <linearGradient id="riskTrendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#3d8bff" stop-opacity="0.24" />
          <stop offset="100%" stop-color="#3d8bff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g class="trend-grid">
        <line x1="20" x2="310" y1="56" y2="56" />
        <line x1="20" x2="310" y1="96" y2="96" />
        <line x1="20" x2="310" y1="136" y2="136" />
      </g>
      <path :d="`${trendPath} L 308 158 L 20 158 Z`" fill="url(#riskTrendFill)" />
      <path class="trend-line" :d="trendPath" />
      <circle
        v-for="point in trendPoints"
        :key="point.label"
        class="trend-dot"
        :class="{ latest: point.label === latestPoint?.label }"
        :cx="point.x"
        :cy="point.y"
        r="4"
      />
      <text
        v-for="point in trendPoints"
        :key="`${point.label}-label`"
        class="trend-label"
        :x="point.x"
        y="174"
        text-anchor="middle"
      >
        {{ point.label }}
      </text>
      <g class="trend-badge" :transform="`translate(${latestPoint?.x || 308}, ${(latestPoint?.y || 70) - 34})`">
        <rect x="-18" y="-3" width="36" height="24" rx="6" />
        <text x="0" y="14" text-anchor="middle">{{ latestTrend }}</text>
      </g>
    </svg>
  </section>
</template>
