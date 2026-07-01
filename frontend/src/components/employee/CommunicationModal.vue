<script setup lang="ts">
import { reactive } from "vue";
import { MessageSquarePlus, X } from "lucide-vue-next";
import { useAgentStore } from "../../stores/agentStore";

const store = useAgentStore();
const form = reactive({ employee: "", date: "", summary: "" });

async function submit() {
  await store.saveCommunication({ ...form });
  form.employee = "";
  form.date = "";
  form.summary = "";
}
</script>

<template>
  <div class="form-modal" :aria-hidden="store.communicationModalOpen ? 'false' : 'true'">
    <div class="modal-backdrop" @click="store.communicationModalOpen = false"></div>
    <form class="archive-form form-modal-panel" @submit.prevent="submit">
      <div class="modal-head">
        <div>
          <p class="eyebrow">New Communication</p>
          <h2>新增沟通记录</h2>
        </div>
        <button type="button" aria-label="关闭新增沟通" @click="store.communicationModalOpen = false"><X /></button>
      </div>
      <label>
        <span>员工姓名</span>
        <input v-model="form.employee" list="employee-name-options" required placeholder="输入姓名，支持下拉提示" />
      </label>
      <datalist id="employee-name-options">
        <option v-for="employee in store.employees" :key="employee.key" :value="employee.name"></option>
      </datalist>
      <label><span>沟通日期</span><input v-model="form.date" type="date" /></label>
      <label class="wide"><span>沟通摘要</span><textarea v-model="form.summary" rows="3" placeholder="记录本次沟通重点、员工状态和阻塞点"></textarea></label>
      <button class="primary-btn" type="submit"><MessageSquarePlus /><span>记录沟通</span></button>
    </form>
  </div>
</template>
