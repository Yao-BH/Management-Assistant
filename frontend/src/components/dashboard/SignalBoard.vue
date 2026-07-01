<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";
import { riskClass } from "../../utils/format";

const store = useAgentStore();
const high = computed(() => store.employees.filter((employee) => riskClass(employee) === "high").length);
const medium = computed(() => store.employees.filter((employee) => riskClass(employee) === "medium").length);
const action = computed(() => store.smartTodos.length);
const stable = computed(() => Math.max(store.employees.length - high.value - medium.value, 0));
const max = computed(() => Math.max(store.employees.length, action.value, 1));
const width = (value: number) => `${Math.max(8, Math.round((value / max.value) * 100))}%`;
</script>

<template>
  <section class="panel funnel-panel signal-panel" aria-label="团队状态信号板">
    <div class="panel-title">
      <div>
        <p class="eyebrow">Team Signal Board</p>
        <h2>团队状态信号板</h2>
      </div>
      <button class="select-btn small" type="button">This week <ChevronDown /></button>
    </div>

    <div class="signal-board compact">
      <div class="signal-rings" aria-hidden="true">
        <span class="ring ring-one"></span>
        <span class="ring ring-two"></span>
        <span class="ring ring-three"></span>
        <i class="signal-dot high"></i>
        <i class="signal-dot medium"></i>
        <i class="signal-dot low"></i>
      </div>

      <div class="signal-bars">
        <div>
          <span>状态稳定</span>
          <em><b :style="{ width: width(stable) }"></b></em>
          <strong>{{ stable }}</strong>
        </div>
        <div>
          <span>重点关注</span>
          <em><b :style="{ width: width(high + medium) }"></b></em>
          <strong>{{ high + medium }}</strong>
        </div>
        <div>
          <span>智能待办</span>
          <em><b :style="{ width: width(action) }"></b></em>
          <strong>{{ action }}</strong>
        </div>
      </div>
    </div>

    <div class="kpi-strip compact">
      <article class="kpi">
        <strong>{{ store.employees.length }}</strong>
        <span><i></i>员工档案</span>
        <small>已录入基础信息</small>
      </article>
      <article class="kpi">
        <strong>{{ high + medium }}</strong>
        <span><i></i>重点关注</span>
        <small>系统识别对象</small>
      </article>
      <article class="kpi">
        <strong>{{ action }}</strong>
        <span><i></i>待办动作</span>
        <small>风险节点生成</small>
      </article>
    </div>
  </section>
</template>
