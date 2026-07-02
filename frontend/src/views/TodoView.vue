<script setup lang="ts">
import { computed } from "vue";
import { CheckCircle2, FileText, MessageSquareText, Play, RefreshCw, Trash2, UserRoundSearch } from "lucide-vue-next";
import { useAgentStore } from "../stores/agentStore";
import { signalText, todoAction, todoEvidence, todoLevelLabel, todoStatusClass } from "../utils/format";

const store = useAgentStore();
const selectedTodo = computed(() => store.smartTodos.find((todo) => todo.id === store.selectedTodoId));
const selectedEmployee = computed(() => store.employees.find((employee) => employee.key === selectedTodo.value?.employeeKey));
const selectedEvidence = computed(() => {
  const employee = selectedEmployee.value;
  if (!employee) return selectedTodo.value?.tags || [];
  const signalEvidence = (employee.riskSignals || []).map(signalText).filter(Boolean);
  return signalEvidence.length ? signalEvidence : employee.evidence || selectedTodo.value?.tags || [];
});
const latestRecords = computed(() =>
  selectedTodo.value?.employeeKey
    ? store.communicationRecords
        .filter((record) => record.employeeKey === selectedTodo.value?.employeeKey || record.employee === selectedEmployee.value?.name)
        .slice(0, 3)
    : []
);
const isDone = (status = "") => status.includes("完成") || status.includes("关闭");
const isDoing = (status = "") => status === "处理中" || status === "进行中";
const groups = computed(() => [
  { label: "今日待办", items: store.smartTodos.filter((todo) => !isDoing(todo.status) && !isDone(todo.status)) },
  { label: "处理中", items: store.smartTodos.filter((todo) => isDoing(todo.status)) },
  { label: "历史待办", items: store.smartTodos.filter((todo) => isDone(todo.status)) }
]);
</script>

<template>
  <section class="view-panel todo-view active">
    <div class="archive-head panel liquid-head">
      <div>
        <p class="eyebrow">Action Loop</p>
        <h2>待办任务工作台</h2>
        <p>从风险识别进入管理动作：选择待办、查看员工画像、生成沟通提纲，完成沟通后自动回写状态。</p>
      </div>
      <button class="primary-btn" type="button" @click="store.loadTodos()"><RefreshCw /><span>刷新待办</span></button>
    </div>

    <section class="todo-workbench-grid todo-workbench-polished">
      <article class="panel todo-list-panel">
        <div class="section-head">
          <h2>智能待办队列</h2>
          <small>{{ store.smartTodos.length }} 项</small>
        </div>
        <div class="todo-list">
          <div v-for="group in groups" :key="group.label" class="todo-group">
            <h3 v-if="group.items.length" class="todo-section-title">{{ group.label }}</h3>
            <button
              v-for="todo in group.items"
              :key="todo.id"
              class="todo-card"
              :class="{ selected: store.selectedTodoId === todo.id, done: todoStatusClass(todo.status) === 'done' }"
              type="button"
              @click="store.selectedTodoId = todo.id"
            >
              <span class="todo-priority" :class="todo.level || 'medium'">{{ todo.priority || todoLevelLabel(todo.level) }}</span>
              <strong>{{ todo.title || todo.action }}</strong>
              <small>{{ todo.employee || store.employeeName(todo.employeeKey) }} · {{ todoLevelLabel(todo.level) }}</small>
              <em :class="todoStatusClass(todo.status)">{{ todo.status || "待处理" }}</em>
            </button>
          </div>
        </div>
      </article>

      <article class="panel todo-detail-panel selected-action-panel">
        <div v-if="!selectedTodo" class="empty-detail">
          <MessageSquareText />
          <h2>选择一项待办</h2>
          <p>这里会展示员工风险、建议动作和完成闭环入口。</p>
        </div>
        <template v-else>
          <div class="selected-action-head">
            <div>
              <p class="eyebrow">Selected Action</p>
              <h2>{{ selectedTodo.title || selectedTodo.action }}</h2>
            </div>
            <span class="status-pill" :class="todoStatusClass(selectedTodo.status)">{{ selectedTodo.status || "待处理" }}</span>
          </div>

          <section class="todo-person-strip">
            <b>{{ (selectedTodo.employee || selectedEmployee?.name || "员").slice(0, 1) }}</b>
            <div>
              <strong>{{ selectedTodo.employee || selectedEmployee?.name || store.employeeName(selectedTodo.employeeKey) }}</strong>
              <span>{{ selectedEmployee?.department || "团队成员" }} · {{ selectedEmployee?.jobLevel || selectedEmployee?.role || "岗位待补充" }}</span>
            </div>
            <button type="button" @click="selectedTodo.employeeKey && store.openEmployeeDrawer(selectedTodo.employeeKey, false)">
              <UserRoundSearch /><span>查看画像</span>
            </button>
          </section>

          <section class="todo-profile-snapshot">
            <article>
              <h3>AI 风险解释</h3>
              <p>{{ selectedEmployee?.reason || todoEvidence(selectedTodo) }}</p>
            </article>
            <article>
              <h3>关键证据</h3>
              <div class="drawer-tags">
                <span v-for="item in selectedEvidence.slice(0, 4)" :key="item">{{ item }}</span>
                <span v-if="!selectedEvidence.length">暂无关键证据</span>
              </div>
            </article>
            <article>
              <h3>生命周期</h3>
              <p><strong>{{ selectedEmployee?.lifecycle?.stage || "待分析" }}</strong>：{{ selectedEmployee?.lifecycle?.detail || "等待 AI 结合入职、合同、转正和沟通记录判断。" }}</p>
            </article>
          </section>

          <section class="todo-glass-section next-action-section">
            <h3>下一步最佳动作</h3>
            <p>{{ todoAction(selectedTodo) }}</p>
            <small>建议完成后记录沟通结果，系统会同步更新员工画像、关注队列和后续待办。</small>
          </section>

          <section class="todo-glass-section">
            <h3>最近沟通</h3>
            <div class="mini-records">
              <div v-for="record in latestRecords" :key="record.id || record.summary">
                <strong>{{ record.date || "未记录日期" }} · {{ record.type || "沟通" }}</strong>
                <span>{{ record.summary || "未填写摘要" }}</span>
              </div>
              <p v-if="!latestRecords.length">暂无沟通记录，建议本次处理后补充沟通结论。</p>
            </div>
          </section>

          <div class="todo-actions">
            <button type="button" @click="store.updateTodoStatus(selectedTodo.id, '处理中')">
              <Play /><span>开始处理</span>
            </button>
            <button type="button" @click="store.openTodoCompletion(selectedTodo.id)">
              <CheckCircle2 /><span>记录沟通并完成</span>
            </button>
            <button type="button" @click="store.deleteTodo(selectedTodo.id)"><Trash2 /><span>删除</span></button>
            <button type="button" @click="selectedTodo.employeeKey && store.generateCommunicationSummary(selectedTodo.employeeKey, selectedTodo.id)">
              <FileText /><span>生成沟通概要</span>
            </button>
          </div>
        </template>
      </article>
    </section>
  </section>
</template>
