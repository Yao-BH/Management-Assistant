<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { CheckCircle2, X } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";

const store = useAgentStore();
const form = reactive({ date: "", type: "1 对 1", summary: "", action: "" });

const todo = computed(() => store.smartTodos.find((item) => item.id === store.todoCompletionTodoId));
const employee = computed(() => store.employees.find((item) => item.key === todo.value?.employeeKey));

function resetForm() {
  form.date = new Date().toISOString().slice(0, 10);
  form.type = "1 对 1";
  form.summary = "";
  form.action = "";
}

watch(
  () => store.todoCompletionModalOpen,
  (open) => {
    if (open) resetForm();
  }
);

async function submit() {
  if (!todo.value || !form.summary.trim()) return;
  await store.completeCommunication(
    {
      employee: todo.value.employee || employee.value?.name || "",
      employeeKey: todo.value.employeeKey || "",
      date: form.date,
      type: form.type,
      summary: form.summary,
      action: form.action
    },
    todo.value.id
  );
  resetForm();
}
</script>

<template>
  <div class="form-modal todo-completion-modal" :aria-hidden="store.todoCompletionModalOpen ? 'false' : 'true'">
    <div class="modal-backdrop" @click="store.closeTodoCompletion()"></div>
    <form class="archive-form form-modal-panel todo-completion-panel" @submit.prevent="submit">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Close Action</p>
          <h2>记录沟通并完成</h2>
        </div>
        <button type="button" aria-label="关闭待办闭环" @click="store.closeTodoCompletion()"><X /></button>
      </div>

      <div v-if="todo" class="todo-completion-summary">
        <strong>{{ todo.title || todo.action }}</strong>
        <span>{{ todo.employee || employee?.name || store.employeeName(todo.employeeKey) }} · {{ todo.priority || "待办" }}</span>
      </div>

      <label><span>沟通日期</span><input v-model="form.date" type="date" /></label>
      <label>
        <span>沟通类型</span>
        <select v-model="form.type">
          <option>1 对 1</option>
          <option>转正面谈</option>
          <option>绩效沟通</option>
          <option>合同续签</option>
          <option>风险确认</option>
        </select>
      </label>
      <label class="wide">
        <span>沟通记录</span>
        <textarea v-model="form.summary" required rows="4" placeholder="记录本次沟通结论、员工反馈、风险是否缓解"></textarea>
      </label>
      <label class="wide">
        <span>后续动作</span>
        <input v-model="form.action" placeholder="例如：两周后复盘目标进展，或同步 HR 跟进合同节点" />
      </label>
      <button class="primary-btn" type="submit" :disabled="!todo || !form.summary.trim()">
        <CheckCircle2 /><span>提交并完成待办</span>
      </button>
    </form>
  </div>
</template>
