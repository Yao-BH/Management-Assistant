import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./styles/tailwind.css";
import "./styles/legacy.css";
import "./styles/vue-overrides.css";

createApp(App).use(createPinia()).mount("#app");
