<script setup lang="ts">
import SignalBoard from "../components/dashboard/SignalBoard.vue";
import TodayFocus from "../components/dashboard/TodayFocus.vue";
import AgentPanel from "../components/agent/AgentPanel.vue";
</script>

<template>
  <section class="view-panel active" data-view="dashboard">
    <section class="hero-grid" aria-label="核心分析">
      <SignalBoard />
      <AgentPanel />
    </section>
    <TodayFocus />
  </section>
</template>
