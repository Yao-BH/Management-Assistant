<script setup lang="ts">
import { onMounted } from "vue";
import AppLayout from "./components/layout/AppLayout.vue";
import EmployeeDrawer from "./components/employee/EmployeeDrawer.vue";
import EmployeeFormModal from "./components/employee/EmployeeFormModal.vue";
import CommunicationModal from "./components/employee/CommunicationModal.vue";
import OutlineModal from "./components/employee/OutlineModal.vue";
import TodoCompletionModal from "./components/todo/TodoCompletionModal.vue";
import { useAgentStore } from "./stores/agentStore";

const store = useAgentStore();

onMounted(async () => {
  await store.loadArchive();
  await store.loadBrief();
});
</script>

<template>
  <AppLayout />
  <EmployeeDrawer />
  <EmployeeFormModal />
  <CommunicationModal />
  <TodoCompletionModal />
  <OutlineModal />
</template>
