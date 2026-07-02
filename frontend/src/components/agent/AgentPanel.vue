<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Bot, CalendarCheck2, SendHorizontal, ShieldQuestion, Sparkles } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import { formatAssistantMessage } from "../../utils/format";
import aiOrb from "../../assets/ai-fluid-orb.png";

const store = useAgentStore();
const input = ref("");
const chatBox = ref<HTMLElement | null>(null);

const quickActions = [
  { label: "今日优先级", icon: CalendarCheck2, prompt: "今天我应该先关注谁？请结合风险、待办和关键节点给我一个简短判断。", intent: "today_priority" },
  { label: "生成管理动作", icon: Sparkles, prompt: "基于当前团队状态，帮我生成最值得推进的管理动作。", intent: "management_actions" },
  { label: "解释风险原因", icon: ShieldQuestion, prompt: "帮我解释当前重点风险员工的主要原因，并给出下一步建议。", intent: "risk_reason" }
];

const visibleMessages = computed(() => (store.assistantHistory.length > 1 ? store.assistantHistory.slice(1) : []));
const isChatActive = computed(() => visibleMessages.value.length > 0 || store.chatLoading);

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
  <aside class="agent-side-stack" aria-label="AI 管理助手">
    <section class="panel copilot-card agent-home-card" :class="{ 'chat-active': isChatActive }">
      <header class="agent-home-head">
        <div>
          <span class="agent-mini-icon"><Bot /></span>
          <strong>管理助手 Agent</strong>
        </div>
        <em>在线</em>
      </header>

      <div v-if="!isChatActive" class="agent-hero">
        <img class="ai-orb" :src="aiOrb" alt="小达 AI 图标" />
        <div>
          <h2>你好，我是小达，今天有什么计划？</h2>
        </div>
      </div>

      <div class="agent-compose">
        <div v-if="isChatActive" ref="chatBox" class="chat-preview agent-chat-thread">
          <div
            v-for="(message, index) in visibleMessages"
            :key="`${message.role}-${index}`"
            class="bubble"
            :class="message.role"
          >
            <div v-if="message.role === 'assistant'" v-html="formatAssistantMessage(message.text)"></div>
            <template v-else>{{ message.text }}</template>
          </div>
          <div v-if="store.chatLoading" class="bubble assistant">正在解析团队数据...</div>
        </div>

        <div class="quick-actions" aria-label="AI 快捷动作">
          <button v-for="action in quickActions" :key="action.label" type="button" @click="submit(action.prompt, action.intent)">
            <component :is="action.icon" />
            <span>{{ action.label }}</span>
          </button>
        </div>

        <label class="chat-input">
          <input v-model="input" type="text" placeholder="询问团队风险或员工状态..." @keydown.enter="submit()" />
          <button type="button" aria-label="发送" @click="submit()"><SendHorizontal /></button>
        </label>
      </div>
    </section>
  </aside>
</template>
