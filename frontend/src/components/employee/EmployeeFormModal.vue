<script setup lang="ts">
import { reactive } from "vue";
import { Plus, X } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";

const store = useAgentStore();
const form = reactive({
  name: "",
  employeeId: "",
  department: "",
  role: "",
  birthday: "",
  hireDate: "",
  manager: "",
  performanceRating: "",
  overtimeHours30d: "",
  lateCount30d: "",
  leaveDays30d: "",
  contractEndDate: "",
  probationEndDate: "",
  keyEvents: ""
});

async function submit() {
  await store.saveEmployee({ ...form });
  Object.keys(form).forEach((key) => ((form as Record<string, string>)[key] = ""));
}
</script>

<template>
  <div class="form-modal" :aria-hidden="store.employeeModalOpen ? 'false' : 'true'">
    <div class="modal-backdrop" @click="store.employeeModalOpen = false"></div>
    <form class="archive-form form-modal-panel" @submit.prevent="submit">
      <div class="modal-head">
        <div>
          <p class="eyebrow">New Employee</p>
          <h2>新增员工</h2>
        </div>
        <button type="button" aria-label="关闭新增员工" @click="store.employeeModalOpen = false"><X /></button>
      </div>
      <label><span>姓名</span><input v-model="form.name" required placeholder="例如：赵六" /></label>
      <label><span>工号</span><input v-model="form.employeeId" placeholder="例如：E2026012" /></label>
      <label><span>部门</span><input v-model="form.department" placeholder="例如：研发部" /></label>
      <label><span>职务</span><input v-model="form.role" required placeholder="例如：后端工程师 · P5" /></label>
      <label><span>生日</span><input v-model="form.birthday" type="date" /></label>
      <label><span>入职时间</span><input v-model="form.hireDate" type="date" /></label>
      <label><span>直属主管</span><input v-model="form.manager" placeholder="例如：姚老师" /></label>
      <label><span>当前绩效</span><input v-model="form.performanceRating" placeholder="例如：B+" /></label>
      <label><span>30天加班</span><input v-model="form.overtimeHours30d" type="number" min="0" step="0.5" /></label>
      <label><span>30天迟到</span><input v-model="form.lateCount30d" type="number" min="0" /></label>
      <label><span>30天请假</span><input v-model="form.leaveDays30d" type="number" min="0" step="0.5" /></label>
      <label><span>合同到期</span><input v-model="form.contractEndDate" type="date" /></label>
      <label><span>转正日期</span><input v-model="form.probationEndDate" type="date" /></label>
      <label><span>状态备注</span><input v-model="form.keyEvents" placeholder="补充心理状态、性格特点、管理备注" /></label>
      <button class="primary-btn" type="submit"><Plus /><span>新增员工</span></button>
    </form>
  </div>
</template>
