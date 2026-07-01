<script setup lang="ts">
import { X } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";

const store = useAgentStore();
</script>

<template>
  <div class="outline-modal-backdrop" :class="{ active: store.outlineModalOpen }" @click="store.outlineModalOpen = false"></div>
  <section class="outline-modal panel" :aria-hidden="store.outlineModalOpen ? 'false' : 'true'">
    <div class="panel-title">
      <div>
        <p class="eyebrow">Generated Outline</p>
        <h2>{{ store.selectedEmployee?.name || "员工" }} 1 对 1 沟通提纲</h2>
      </div>
      <button class="icon-btn" type="button" aria-label="关闭沟通提纲" @click="store.outlineModalOpen = false"><X /></button>
    </div>
    <div class="outline-meta"><span>生成状态</span><strong>{{ store.outlineSource }}</strong></div>
    <ol class="outline-list">
      <li v-for="line in store.outlineLines" :key="line">{{ line }}</li>
    </ol>
  </section>
</template>
