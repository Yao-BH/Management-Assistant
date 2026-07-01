<script setup lang="ts">
import { computed } from "vue";
import { Sparkles } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import { signalText } from "../../utils/format";

const store = useAgentStore();

const latestSignal = computed(() => store.riskSignals[0]);
const topFocus = computed(() => store.focusQueue[0]);
const foundText = computed(() => {
  if (!latestSignal.value) return "暂无新的高强度信号";
  return `${store.employeeName(latestSignal.value.employeeKey)} · ${signalText(latestSignal.value)}`;
});
const nextText = computed(() => {
  if (!topFocus.value) return "保持常规沟通节奏";
  return `${topFocus.value.employee || store.employeeName(topFocus.value.employeeKey)}：${topFocus.value.title}`;
});
const latestEvent = computed(() => store.agentEvents[0]);
</script>

<template>
  <section class="agent-feed" aria-label="AI 动态">
    <div class="agent-feed-head">
      <Sparkles />
      <span>AI 动态</span>
    </div>
    <div class="agent-feed-list">
      <div class="agent-status-item scan"><b>扫描</b><span>{{ store.employees.length }} 名员工</span></div>
      <div class="agent-status-item found"><b>发现</b><span>{{ store.focusQueue.length }} 个关注对象 · {{ foundText }}</span></div>
      <div class="agent-status-item next"><b>建议</b><span>{{ nextText }}</span></div>
      <div class="agent-status-ticker">
        <time>{{ latestEvent?.time || "--:--" }}</time>
        <span>{{ latestEvent?.text || "等待 AI 同步团队数据..." }}</span>
      </div>
    </div>
  </section>
</template>
