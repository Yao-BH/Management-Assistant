<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import {
  Bell,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UsersRound,
  BarChart3
} from "lucide-vue-next";
import DashboardView from "../../views/DashboardView.vue";
import InsightView from "../../views/InsightView.vue";
import TodoView from "../../views/TodoView.vue";
import EmployeeArchiveView from "../../views/EmployeeArchiveView.vue";
import AgentFeed from "../dashboard/AgentFeed.vue";
import { useAgentStore } from "../../stores/agentStore";

const store = useAgentStore();
const collapsed = ref(localStorage.getItem("employeeAssistantSidebarCollapsed") === "1");

watchEffect(() => {
  localStorage.setItem("employeeAssistantSidebarCollapsed", collapsed.value ? "1" : "0");
});

const currentView = computed(() => store.selectedView);
const navItems = [
  { key: "dashboard", label: "管理面板", icon: Home },
  { key: "insight", label: "统计洞察", icon: BarChart3 },
  { key: "todo-workbench", label: "待办任务", icon: ClipboardList },
  { key: "employee-archive", label: "员工档案", icon: UsersRound },
  { key: "reminder", label: "提醒中心", icon: Bell }
];
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="sidebar" aria-label="主导航">
      <button
        class="sidebar-toggle"
        type="button"
        :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
        :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="collapsed = !collapsed"
      >
        <PanelLeftOpen v-if="collapsed" />
        <PanelLeftClose v-else />
      </button>

      <div class="brand">
        <div class="brand-mark">EA</div>
        <strong>员工管理助手</strong>
      </div>

      <nav class="nav-list">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: currentView === item.key }"
          type="button"
          @click="store.selectedView = item.key"
        >
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="nav-group">
        <span>OTHER</span>
        <button class="nav-item" type="button"><Settings /><span>系统设置</span></button>
        <button class="nav-item" type="button"><CircleHelp /><span>帮助中心</span></button>
      </div>

      <div class="manager">
        <div class="manager-avatar">姚</div>
        <div>
          <strong>管理者视图</strong>
          <span>授权团队范围</span>
        </div>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <h1>Analytical board</h1>
        <div class="top-actions">
          <AgentFeed />
          <button class="icon-btn" type="button" aria-label="日历"><CalendarDays /></button>
        </div>
      </header>

      <DashboardView v-if="currentView === 'dashboard'" />
      <InsightView v-else-if="currentView === 'insight'" />
      <TodoView v-else-if="currentView === 'todo-workbench'" />
      <EmployeeArchiveView v-else-if="currentView === 'employee-archive'" />
      <section v-else class="view-panel active panel">
        <p class="eyebrow">Coming Soon</p>
        <h2>模块建设中</h2>
        <p>这个入口已经保留，后续可以独立拆成自己的 Vue 页面。</p>
      </section>
    </main>
  </div>
</template>
