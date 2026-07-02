<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import { employeeDisplayName, riskClass, todoAction, todoEvidence } from "../../utils/format";

const store = useAgentStore();

const topFocus = computed(() => store.focusQueue.slice(0, 5));
const watchCount = computed(() => store.focusQueue.length);
const highRiskCount = computed(() => store.employees.filter((employee) => riskClass(employee) === "high").length);
const coverage = computed(() => {
  if (!store.employees.length) return 0;
  const touched = new Set(store.communicationRecords.map((record) => record.employeeKey || record.employee || record.employeeName).filter(Boolean));
  return Math.round((touched.size / store.employees.length) * 100);
});

function riskLabel(level = "normal") {
  if (level === "high") return "较高";
  if (level === "medium") return "中等";
  if (level === "low") return "较低";
  return "稳定";
}
</script>

<template>
  <section class="focus-workspace panel focus-workspace-polished judgment-panel">
    <div class="judgment-head">
      <div>
        <p class="eyebrow">Today Management Brief</p>
        <h2>今日管理研判</h2>
        <p>
          团队 {{ store.employees.length }} 人中，{{ watchCount }} 人需要关注，{{ highRiskCount }} 人风险升高，
          沟通覆盖率 {{ coverage }}%，建议关注重点员工并推进闭环。
        </p>
      </div>
      <div class="focus-actions">
        <button class="select-btn" type="button" @click="store.loadArchive()"><RefreshCw /><span>刷新</span></button>
        <button class="primary-btn" type="button" @click="store.loadBrief()"><Sparkles /><span>生成研判</span></button>
        <button class="select-btn detail-link" type="button" @click="store.selectedView = 'todo-workbench'">
          <span>查看详细</span><ArrowRight />
        </button>
      </div>
    </div>

    <div class="judgment-table-card">
      <div class="section-head compact">
        <h3>今日关注 TOP5</h3>
        <button type="button" @click="store.selectedView = 'todo-workbench'">查看详细 <ArrowRight /></button>
      </div>

      <div class="judgment-table">
        <div class="table-head">
          <span>员工</span>
          <span>风险等级</span>
          <span>关注原因</span>
          <span>建议动作</span>
          <span>状态</span>
        </div>

        <button
          v-for="item in topFocus"
          :key="item.id"
          class="person-row judgment-row"
          type="button"
          @dblclick="item.employeeKey && store.openEmployeeDrawer(item.employeeKey, false)"
        >
          <span class="person">
            <b>{{ employeeDisplayName(item).slice(0, 1) }}</b>
            <em>{{ employeeDisplayName(item) }}</em>
          </span>
          <span class="risk-chip" :class="item.level || riskClass(store.employeesByKey[item.employeeKey || ''])">
            {{ riskLabel(item.level || riskClass(store.employeesByKey[item.employeeKey || ""])) }}
          </span>
          <span>{{ todoEvidence(item) }}</span>
          <span>{{ todoAction(item) }}</span>
          <span class="status-pill">{{ item.status || "待处理" }}</span>
        </button>

        <div v-if="!topFocus.length" class="person-row loading-row">
          <span class="person"><b>AI</b><em>暂无关注对象</em></span>
          <span class="risk-chip normal">稳定</span>
          <span>当前规则和模型未识别到重点风险。</span>
          <span>保持常规沟通节奏。</span>
          <span class="status-pill done">稳定</span>
        </div>
      </div>
    </div>
  </section>
</template>
