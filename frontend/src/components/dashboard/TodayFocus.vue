<script setup lang="ts">
import { RefreshCw, Sparkles } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import { riskClass } from "../../utils/format";

const store = useAgentStore();
</script>

<template>
  <section class="focus-workspace panel focus-workspace-polished">
    <div class="focus-head">
      <div>
        <p class="eyebrow">Today Focus</p>
        <h2>{{ store.currentBrief.title || "今日重点关注" }}</h2>
        <p>{{ store.currentBrief.summary || "正在读取数据。" }}</p>
        <small class="analysis-state-line">{{ store.loading ? "正在同步团队数据..." : "已根据最新团队数据更新研判" }}</small>
      </div>
      <div class="focus-actions">
        <button class="select-btn" type="button" @click="store.loadArchive()"><RefreshCw /><span>刷新</span></button>
        <button class="primary-btn" type="button" @click="store.loadBrief()"><Sparkles /><span>生成研判</span></button>
      </div>
    </div>

    <div class="focus-grid">
      <section class="risk-table-section">
        <div class="section-head compact">
          <h2>关注队列</h2>
          <small>双击员工查看画像</small>
        </div>

        <div class="risk-table">
          <div class="table-head">
            <span>员工</span>
            <span>风险依据</span>
            <span>建议动作</span>
            <span>状态</span>
          </div>

          <button
            v-for="item in store.focusQueue"
            :key="item.id"
            class="person-row"
            type="button"
            @dblclick="item.employeeKey && store.openEmployeeDrawer(item.employeeKey, false)"
          >
            <span class="person">
              <b>{{ item.employee?.slice(0, 1) || "员" }}</b>
              <em>{{ item.employee || store.employeeName(item.employeeKey) }}</em>
            </span>
            <span>{{ item.reason || item.detail || item.summary || "等待 AI 补充风险依据" }}</span>
            <span>{{ item.title || item.action || "安排跟进动作" }}</span>
            <span class="status-pill" :class="riskClass(store.employeesByKey[item.employeeKey || ''])">{{ item.status || "今日处理" }}</span>
          </button>

          <div v-if="!store.focusQueue.length" class="person-row loading-row">
            <span class="person"><b>AI</b><em>暂无关注对象</em></span>
            <span>当前规则和模型未识别到重点风险。</span>
            <span>保持常规沟通节奏</span>
            <span class="status-pill">稳定</span>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
