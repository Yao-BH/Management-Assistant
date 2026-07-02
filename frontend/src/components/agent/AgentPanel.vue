<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { SendHorizontal } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import { formatAssistantMessage } from "../../utils/format";
import aiOrb from "../../assets/ai-fluid-orb.png";

const store = useAgentStore();
const input = ref("");
const chatBox = ref<HTMLElement | null>(null);

const quickActions = [
  { label: "今日优先级", prompt: "今天我应该先关注谁？请结合风险、待办和关键节点给我一个简短判断。", intent: "today_priority" },
  { label: "生成管理动作", prompt: "基于当前团队状态，帮我生成最值得推进的管理动作。", intent: "management_actions" },
  { label: "解释风险原因", prompt: "帮我解释当前重点风险员工的主要原因，并给出下一步建议。", intent: "risk_reason" }
];

async function submit(message = input.value, intent = "") {
  const text = message.trim();
  if (!text) return;
  input.value = "";
  await store.sendChat(text, intent);
}

watch(
  () => store.assistantHistory.length,
  async () => {
    await nextTick();
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  }
);
</script>

<template>
  <aside class="panel copilot-card" :class="{ 'chat-active': store.assistantHistory.length > 1 }" aria-label="AI 管理助手">
    <div class="agent-copy">
      <h2>管理助手 Agent</h2>
    </div>
    <img class="ai-orb" :src="aiOrb" alt="3D 流体 AI 图标" />

    <div class="agent-capabilities" aria-label="助手能力">
      <span>员工画像</span>
      <span>风险研判</span>
      <span>待办编排</span>
      <span>沟通提纲</span>
    </div>

    <div ref="chatBox" class="chat-preview">
      <div
        v-for="(message, index) in store.assistantHistory"
        :key="`${message.role}-${index}`"
        class="bubble"
        :class="message.role"
      >
        <div v-if="message.role === 'assistant'" v-html="formatAssistantMessage(message.text)"></div>
        <template v-else>{{ message.text }}</template>
      </div>
      <div v-if="store.chatLoading" class="bubble assistant">正在解析数据，AI分析中...</div>
    </div>

    <div class="quick-actions" aria-label="AI 快捷动作">
      <button v-for="action in quickActions" :key="action.label" type="button" @click="submit(action.prompt, action.intent)">
        {{ action.label }}
      </button>
    </div>

    <label class="chat-input">
      <input v-model="input" type="text" placeholder="询问团队风险或员工状态" @keydown.enter="submit()" />
      <button type="button" aria-label="发送" @click="submit()"><SendHorizontal /></button>
    </label>
  </aside>
</template>
