<script setup lang="ts">
import SignalBoard from "../components/dashboard/SignalBoard.vue";
import TodayFocus from "../components/dashboard/TodayFocus.vue";
import AgentPanel from "../components/agent/AgentPanel.vue";
import RiskTrendCard from "../components/dashboard/RiskTrendCard.vue";
</script>

<template>
  <section class="view-panel active" data-view="dashboard">
    <section class="hero-grid" aria-label="核心分析">
      <SignalBoard />
      <AgentPanel />
    </section>
    <section class="dashboard-lower-grid" aria-label="今日管理与风险趋势">
      <TodayFocus />
      <RiskTrendCard />
    </section>
  </section>
</template>
